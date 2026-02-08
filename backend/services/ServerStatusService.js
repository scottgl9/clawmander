class ServerStatusService {
  constructor(sseManager) {
    this.sse = sseManager;
    this.state = {
      connection: 'disconnected',
      connectedAt: null,
      openClawUrl: null,
      serverVersion: null,
      serverHost: null,
      uptimeMs: null,
      sessionDefaults: null,
      presence: [],
      statusSummary: null,
      lastHeartbeat: null,
      lastUpdated: null,
      lastStatusFetch: null,
    };
  }

  update(partial) {
    Object.assign(this.state, partial, { lastUpdated: new Date().toISOString() });
    this.sse.broadcast('server.status', this.state);
  }

  getStatus() {
    return { ...this.state };
  }
}

module.exports = ServerStatusService;
