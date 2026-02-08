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
}

module.exports = TaskService;
