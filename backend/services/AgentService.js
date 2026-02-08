const FileStore = require('../storage/FileStore');
const { createAgent } = require('../models/Agent');

class AgentService {
  constructor(sseManager) {
    this.store = new FileStore('agents.json');
    this.sse = sseManager;
  }

  getAll() {
    return this.store.read();
  }

  getById(id) {
    return this.store.findById(id);
  }

  upsert(data) {
    const existing = this.store.findById(data.id);
    if (existing) {
      const oldStatus = existing.status;
      const updated = this.store.update(data.id, data);
      if (data.status && data.status !== oldStatus) {
        this.sse.broadcast('agent.status_changed', {
          agentId: data.id,
          from: oldStatus,
          to: data.status,
          agent: updated,
        });
      }
      return updated;
    }
    const agent = createAgent(data);
    this.store.insert(agent);
    this.sse.broadcast('agent.status_changed', {
      agentId: agent.id,
      from: null,
      to: agent.status,
      agent,
    });
    return agent;
  }

  updateStatus(id, status, extra = {}) {
    return this.upsert({ id, status, ...extra });
  }
}

module.exports = AgentService;
