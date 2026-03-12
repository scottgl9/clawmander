const FileStore = require('../storage/FileStore');
const { createTask, VALID_STATUSES } = require('../models/Task');

class TaskService {
  constructor(sseManager) {
    this.store = new FileStore('tasks.json');
    this.sse = sseManager;
  }

  getAll(filters = {}) {
    return this.store.findAll((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.agentId && task.agentId !== filters.agentId) return false;
      if (filters.agentType && task.agentType !== filters.agentType) return false;
      return true;
    });
  }

  getById(id) {
    return this.store.findById(id);
  }

  getStats() {
    const tasks = this.store.read();
    const byStatus = { queued: 0, in_progress: 0, done: 0, blocked: 0 };
    const byPriority = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const t of tasks) {
      if (byStatus[t.status] !== undefined) byStatus[t.status]++;
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    }
    return { total: tasks.length, byStatus, byPriority };
  }

  create(data) {
    const task = createTask(data);
    this.store.insert(task);
    this.sse.broadcast('task.created', task);
    return task;
  }

  update(id, updates) {
    const existing = this.store.findById(id);
    if (!existing) return null;
    const statusChanged = updates.status && updates.status !== existing.status;
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      throw new Error(`Invalid status: ${updates.status}`);
    }
    if (updates.progress !== undefined) {
      updates.progress = Math.min(100, Math.max(0, updates.progress));
    }
    const updated = this.store.update(id, updates);
    this.sse.broadcast('task.updated', updated);
    if (statusChanged) {
      this.sse.broadcast('task.status_changed', {
        taskId: id,
        from: existing.status,
        to: updated.status,
        task: updated,
      });
    }
    return updated;
  }

  upsert(data) {
    const { agentId, sessionKey, runId } = data;
    if (agentId && sessionKey && runId) {
      const existing = this.store.findBy(
        (t) => t.agentId === agentId && t.sessionKey === sessionKey && t.runId === runId
      );
      if (existing) {
        const { id, createdAt, ...rest } = data;
        const updated = this.store.update(existing.id, rest);
        this.sse.broadcast('task.updated', updated);
        return { task: updated, created: false };
      }
    }
    const task = this.create(data);
    return { task, created: true };
  }

  delete(id) {
    const task = this.store.findById(id);
    if (!task) return false;
    const removed = this.store.remove(id);
    if (removed) this.sse.broadcast('task.deleted', { taskId: id });
    return removed;
  }

  // Midnight CST cleanup: if no tasks are in_progress, wipe all tasks.
  // Otherwise only remove done tasks from previous days.
  midnightCleanup() {
    const tasks = this.store.read();
    const hasActive = tasks.some((t) => t.status === 'in_progress');

    if (!hasActive) {
      // No active tasks — clear everything
      let removed = 0;
      for (const t of tasks) {
        this.store.remove(t.id);
        removed++;
      }
      if (removed > 0) {
        console.log(`[TaskService] Midnight cleanup: cleared all ${removed} task(s) (no active tasks)`);
      }
      return removed;
    }

    // Active tasks exist — only remove done tasks from previous days (CST = UTC-6)
    const nowUtc = Date.now();
    const CST_OFFSET_MS = 6 * 60 * 60 * 1000;
    const todayStartUtc = Math.floor((nowUtc - CST_OFFSET_MS) / 86400000) * 86400000 + CST_OFFSET_MS;
    const toDelete = tasks.filter(
      (t) => t.status === 'done' && new Date(t.updatedAt).getTime() < todayStartUtc
    );
    let removed = 0;
    for (const t of toDelete) {
      this.store.remove(t.id);
      removed++;
    }
    if (removed > 0) {
      console.log(`[TaskService] Midnight cleanup: removed ${removed} stale done task(s) from previous days`);
    }
    return removed;
  }

  // Remove any task (any status) older than 24 hours
  cleanupOldTasks() {
    const tasks = this.store.read();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const toDelete = tasks.filter((t) => new Date(t.createdAt).getTime() < cutoff);
    let removed = 0;
    for (const t of toDelete) {
      this.store.remove(t.id);
      removed++;
    }
    if (removed > 0) {
      console.log(`[TaskService] Removed ${removed} task(s) older than 24 hours`);
    }
    return removed;
  }

  // Alias kept for startup call
  cleanupDoneTasks() {
    return this.midnightCleanup();
  }

  // Mark tasks stuck in_progress for more than maxAgeMs as done
  reconcileStale(maxAgeMs = 2 * 60 * 60 * 1000) {
    const tasks = this.store.read();
    const cutoff = Date.now() - maxAgeMs;
    let reconciled = 0;
    for (const t of tasks) {
      if (t.status === 'in_progress' && new Date(t.updatedAt).getTime() < cutoff) {
        this.update(t.id, { status: 'done', progress: 100 });
        reconciled++;
      }
    }
    if (reconciled > 0) {
      console.log(`[TaskService] Reconciled ${reconciled} stale in_progress task(s) → done`);
    }
    return reconciled;
  }
}

module.exports = TaskService;
