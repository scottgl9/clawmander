const fs = require('fs');
const path = require('path');

const AGENT_PATHS = {
  'work-agent': '~/.openclaw/workspace/memory',
  'personal-agent': '~/.openclaw/workspace-personal/memory',
  'sentinel-work': '~/.openclaw/workspace/agents/sentinel-work/memory',
  'budget': '~/.openclaw/workspace-personal/agents/budget/memory',
  'job-search': '~/.openclaw/workspace-personal/agents/job-search/memory',
  'work-code-reviewer': '~/.openclaw/workspace/agents/work-code-reviewer/memory',
  'jira-agent': '~/.openclaw/workspace/agents/jira-agent/memory',
};

class MemoryService {
  constructor() {
    this.agentPaths = {};
    const home = require('os').homedir();
    for (const [agent, p] of Object.entries(AGENT_PATHS)) {
      this.agentPaths[agent] = p.replace('~', home);
    }
  }

  getAvailableWeeks(limit = 12) {
    const weekSet = new Map(); // weekId -> Set of agents

    for (const [agent, memoryPath] of Object.entries(this.agentPaths)) {
      const weeksDir = path.join(memoryPath, 'weeks');
      try {
        const dirs = fs.readdirSync(weeksDir).filter(d => /^\d{4}-W\d{2}$/.test(d));
        for (const weekId of dirs) {
          const weekMdPath = path.join(weeksDir, weekId, 'WEEK.md');
          if (fs.existsSync(weekMdPath)) {
            if (!weekSet.has(weekId)) weekSet.set(weekId, []);
            weekSet.get(weekId).push(agent);
          }
        }
      } catch {}
    }

    const weeks = Array.from(weekSet.entries())
      .map(([weekId, agents]) => ({ weekId, agents, agentCount: agents.length }))
      .sort((a, b) => b.weekId.localeCompare(a.weekId))
      .slice(0, limit);

    return weeks;
  }

  getWeekSummaries(weekId) {
    const summaries = {};

    for (const [agent, memoryPath] of Object.entries(this.agentPaths)) {
      const weekMdPath = path.join(memoryPath, 'weeks', weekId, 'WEEK.md');
      try {
        if (fs.existsSync(weekMdPath)) {
          summaries[agent] = fs.readFileSync(weekMdPath, 'utf8');
        }
      } catch {}
    }

    return {
      weekId,
      agents: Object.keys(summaries),
      summaries,
    };
  }

  getWeekMd(agent, weekId) {
    const memoryPath = this.agentPaths[agent];
    if (!memoryPath) return null;

    const weekMdPath = path.join(memoryPath, 'weeks', weekId, 'WEEK.md');
    try {
      if (fs.existsSync(weekMdPath)) {
        return fs.readFileSync(weekMdPath, 'utf8');
      }
    } catch {}
    return null;
  }
}

module.exports = MemoryService;
