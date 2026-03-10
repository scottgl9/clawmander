const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CronService {
  constructor(sseManager, openClawHome, taskService = null) {
    this.sseManager = sseManager;
    this.openClawHome = openClawHome;
    this.taskService = taskService;
    this.cronDir = path.join(openClawHome, 'cron');
    this.jobsFile = path.join(this.cronDir, 'jobs.json');
    this.runsDir = path.join(this.cronDir, 'runs');
    this.scriptRunsFile = path.join(this.cronDir, 'script-runs.jsonl');
    this._lastLineCounts = {};
    this._watcherInterval = null;
  }

  getJobs() {
    try {
      const raw = fs.readFileSync(this.jobsFile, 'utf8');
      const data = JSON.parse(raw);
      return (data.jobs || []).map(job => ({
        id: job.id,
        name: job.name,
        agentId: job.agentId,
        enabled: job.enabled,
        schedule: job.schedule,
        lastRun: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
        nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
        lastStatus: job.state?.lastStatus || null,
        lastDurationMs: job.state?.lastDurationMs || null,
        consecutiveErrors: job.state?.consecutiveErrors || 0,
        lastDelivered: job.state?.lastDelivered || false,
        lastDeliveryStatus: job.state?.lastDeliveryStatus || null,
      }));
    } catch (err) {
      console.error('[CronService] Failed to read jobs.json:', err.message);
      return [];
    }
  }

  getRunHistory(jobId, limit = 20) {
    const filePath = path.join(this.runsDir, `${jobId}.jsonl`);
    try {
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
      const runs = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      return runs.slice(-limit).reverse().map(run => this._formatRun(run));
    } catch (err) {
      return [];
    }
  }

  getAllRuns(limit = 50, offset = 0, agentFilter = null) {
    const jobs = this.getJobs();
    const jobAgentMap = {};
    jobs.forEach(j => { jobAgentMap[j.id] = j.agentId; });

    let allRuns = [];
    try {
      const files = fs.readdirSync(this.runsDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const jobId = file.replace('.jsonl', '');
        const filePath = path.join(this.runsDir, file);
        try {
          const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const run = JSON.parse(line);
              run._agentId = jobAgentMap[run.jobId] || run.jobId;
              allRuns.push(run);
            } catch {}
          }
        } catch {}
      }
    } catch {}

    if (agentFilter) {
      allRuns = allRuns.filter(r => r._agentId === agentFilter);
    }

    allRuns.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const paginated = allRuns.slice(offset, offset + limit);

    // Look up job names
    const jobNameMap = {};
    jobs.forEach(j => { jobNameMap[j.id] = j.name; });

    return {
      total: allRuns.length,
      offset,
      limit,
      runs: paginated.map(run => ({
        ...this._formatRun(run),
        agentId: run._agentId,
        jobName: jobNameMap[run.jobId] || null,
      })),
    };
  }

  getSystemCrons() {
    const result = { crontab: [], scriptRuns: [] };

    // Parse crontab -l
    try {
      const crontabOutput = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
      result.crontab = crontabOutput.trim().split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const parts = line.split(/\s+/);
          return {
            schedule: parts.slice(0, 5).join(' '),
            command: parts.slice(5).join(' '),
          };
        });
    } catch {}

    // Read script-runs.jsonl
    try {
      if (fs.existsSync(this.scriptRunsFile)) {
        const lines = fs.readFileSync(this.scriptRunsFile, 'utf8').trim().split('\n').filter(Boolean);
        result.scriptRuns = lines.slice(-50).reverse().map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
      }
    } catch {}

    return result;
  }

  startWatcher() {
    // Initialize line counts
    this._snapshotLineCounts();

    this._watcherInterval = setInterval(() => {
      this._checkForNewRuns();
    }, 60000);

    console.log('[CronService] File watcher started (60s poll)');
  }

  stopWatcher() {
    if (this._watcherInterval) {
      clearInterval(this._watcherInterval);
      this._watcherInterval = null;
    }
  }

  _snapshotLineCounts() {
    try {
      const files = fs.readdirSync(this.runsDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(this.runsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this._lastLineCounts[file] = content.trim().split('\n').filter(Boolean).length;
        } catch {}
      }
    } catch {}
  }

  _checkForNewRuns() {
    try {
      const files = fs.readdirSync(this.runsDir).filter(f => f.endsWith('.jsonl'));
      const jobs = this.getJobs();
      const jobNameMap = {};
      const jobAgentMap = {};
      jobs.forEach(j => { jobNameMap[j.id] = j.name; jobAgentMap[j.id] = j.agentId; });

      for (const file of files) {
        const filePath = path.join(this.runsDir, file);
        try {
          const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
          const currentCount = lines.length;
          const prevCount = this._lastLineCounts[file] || 0;

          if (currentCount > prevCount) {
            const newLines = lines.slice(prevCount);
            for (const line of newLines) {
              try {
                const run = JSON.parse(line);
                const jobId = file.replace('.jsonl', '');
                const agentId = jobAgentMap[jobId] || jobId;
                this.sseManager.broadcast('feed.new', {
                  ...this._formatRun(run),
                  agentId,
                  jobName: jobNameMap[jobId] || null,
                });
                // Reconcile any stuck in_progress task for this run
                this._reconcileTask(run, agentId);
              } catch {}
            }
            this._lastLineCounts[file] = currentCount;
          }
        } catch {}
      }

      // Also broadcast cron status update
      this.sseManager.broadcast('cron.status', { jobs: this.getJobs() });
    } catch {}
  }

  // Called at startup: mark any in_progress cron tasks done/blocked if their run already finished.
  reconcileStuckTasks() {
    if (!this.taskService) return;
    try {
      const tasks = this.taskService.getAll();
      const stuckCronTasks = tasks.filter(
        (t) => t.status === 'in_progress' && t.sessionKey && t.sessionKey.includes(':cron:')
      );
      if (stuckCronTasks.length === 0) return;

      for (const task of stuckCronTasks) {
        // sessionKey format: agent:<agentId>:cron:<jobId>:run:<runId>  or  agent:<agentId>:cron:<jobId>
        const jobIdMatch = task.sessionKey.match(/:cron:([^:]+)/);
        if (!jobIdMatch) continue;
        const jobId = jobIdMatch[1];
        const runFilePath = path.join(this.runsDir, `${jobId}.jsonl`);
        try {
          const lines = fs.readFileSync(runFilePath, 'utf8').trim().split('\n').filter(Boolean);
          // Find the run matching this task's runId (or just the last run)
          let matchedRun = null;
          for (const line of lines) {
            try {
              const run = JSON.parse(line);
              if (task.runId && run.sessionId === task.runId) { matchedRun = run; break; }
              if (!task.runId) matchedRun = run; // fallback: use last
            } catch {}
          }
          if (!matchedRun) matchedRun = lines.length ? (() => { try { return JSON.parse(lines[lines.length - 1]); } catch { return null; } })() : null;
          if (matchedRun && matchedRun.action === 'finished') {
            const newStatus = matchedRun.status === 'ok' ? 'done' : 'blocked';
            this.taskService.update(task.id, { status: newStatus, progress: newStatus === 'done' ? 100 : task.progress });
            console.log(`[CronService] Reconciled stuck task ${task.id} (${task.title}) → ${newStatus}`);
          }
        } catch {}
      }
    } catch (err) {
      console.error('[CronService] reconcileStuckTasks error:', err.message);
    }
  }

  // Reconcile a single task after a new run is detected
  _reconcileTask(run, agentId) {
    if (!this.taskService || run.action !== 'finished') return;
    try {
      const tasks = this.taskService.getAll();
      const match = tasks.find(
        (t) =>
          t.status === 'in_progress' &&
          t.sessionKey &&
          t.sessionKey.includes(':cron:') &&
          (t.agentId === agentId || t.sessionKey.includes(run.jobId)) &&
          (run.sessionId ? (t.runId === run.sessionId || !t.runId) : true)
      );
      if (match) {
        const newStatus = run.status === 'ok' ? 'done' : 'blocked';
        this.taskService.update(match.id, { status: newStatus, progress: newStatus === 'done' ? 100 : match.progress });
        console.log(`[CronService] Reconciled task ${match.id} (${match.title}) → ${newStatus}`);
      }
    } catch {}
  }

  _formatRun(run) {
    return {
      ts: run.ts ? new Date(run.ts).toISOString() : null,
      tsMs: run.ts || null,
      jobId: run.jobId,
      status: run.status || 'unknown',
      error: run.error || null,
      summary: run.summary || null,
      sessionId: run.sessionId || null,
      durationMs: run.durationMs || null,
      model: run.model || null,
      provider: run.provider || null,
      alias: run.alias || null,
      usage: run.usage || null,
      delivered: run.delivered || false,
      deliveryStatus: run.deliveryStatus || null,
    };
  }
}

module.exports = CronService;
