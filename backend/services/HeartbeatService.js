const FileStore = require('../storage/FileStore');
const { createHeartbeat } = require('../models/Heartbeat');

class HeartbeatService {
  constructor(sseManager, agentService) {
    this.store = new FileStore('heartbeats.json');
    this.sse = sseManager;
    this.agentService = agentService;
  }

  getAll() {
    return this.store.read();
  }

  getByAgent(agentId) {
    return this.store.findAll((h) => h.agentId === agentId);
  }

  getHeartbeatTimings() {
    const agents = this.agentService.getAll();
    return agents.map((agent) => {
      const now = Date.now();
      const lastBeat = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).getTime() : null;
      const interval = (agent.heartbeatInterval || 300) * 1000;
      const nextBeat = lastBeat ? lastBeat + interval : null;
      const secondsUntilNext = nextBeat ? Math.round((nextBeat - now) / 1000) : null;
      return {
        agentId: agent.id,
        agentName: agent.name,
        lastHeartbeat: agent.lastHeartbeat,
        nextHeartbeat: nextBeat ? new Date(nextBeat).toISOString() : null,
        secondsUntilNext,
        overdue: secondsUntilNext !== null && secondsUntilNext < 0,
        heartbeatInterval: agent.heartbeatInterval,
      };
    });
  }

  record(data) {
    const heartbeat = createHeartbeat(data);
    this.store.insert(heartbeat);

    // Update agent's last heartbeat and status
    const now = new Date();
    const interval = data.heartbeatInterval || 300;
    const nextHeartbeat = new Date(now.getTime() + interval * 1000).toISOString();
    this.agentService.upsert({
      id: data.agentId,
      name: data.agentName || data.agentId,
      status: data.status === 'ALERT' ? 'error' : 'active',
      lastHeartbeat: now.toISOString(),
      nextHeartbeat,
      heartbeatInterval: interval,
    });

    this.sse.broadcast('heartbeat.received', heartbeat);
    return heartbeat;
  }
}

module.exports = HeartbeatService;
