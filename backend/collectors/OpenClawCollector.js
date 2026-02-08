const WebSocket = require('ws');
const config = require('../config/config');

class OpenClawCollector {
  constructor(agentService, sseManager, serverStatusService) {
    this.agentService = agentService;
    this.sse = sseManager;
    this.serverStatus = serverStatusService;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.running = false;
    this._reqId = 0;
    this._pendingRequests = new Map();
    this._periodicTimer = null;
  }

  start() {
    this.running = true;
    this._connect();
  }

  stop() {
    this.running = false;
    this._stopPeriodicFetch();
    this._clearPending('collector stopped');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _connect() {
    if (!this.running) return;

    const url = config.openClaw.wsUrl;
    console.log(`[OpenClaw] Connecting to ${url}...`);

    if (this.serverStatus) {
      this.serverStatus.update({ connection: 'connecting', openClawUrl: url });
    }

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.log(`[OpenClaw] Connection failed: ${err.message}`);
      if (this.serverStatus) {
        this.serverStatus.update({ connection: 'disconnected' });
      }
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[OpenClaw] Connected');
      this.reconnectDelay = 1000;

      // Send protocol v3 connect frame
      this._sendRaw({
        type: 'req',
        id: this._nextId(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'cli',
            version: '1.0.0',
            platform: process.platform,
            mode: 'operator',
          },
          role: 'operator',
          scopes: ['operator.read'],
          auth: { token: config.openClaw.token || '' },
        },
      });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleMessage(msg);
      } catch (err) {
        console.error('[OpenClaw] Parse error:', err.message);
      }
    });

    this.ws.on('close', () => {
      console.log('[OpenClaw] Disconnected');
      this._stopPeriodicFetch();
      this._clearPending('disconnected');
      this.sse.broadcast('system.health', { openClaw: 'disconnected' });
      if (this.serverStatus) {
        this.serverStatus.update({
          connection: 'disconnected',
          connectedAt: null,
          presence: [],
          statusSummary: null,
          lastHeartbeat: null,
        });
      }
      this._scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error(`[OpenClaw] Error: ${err.message}`);
    });
  }

  _scheduleReconnect() {
    if (!this.running) return;
    console.log(`[OpenClaw] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    setTimeout(() => this._connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  _nextId() {
    return String(++this._reqId);
  }

  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 10000);
      this._pendingRequests.set(id, { resolve, reject, timeout });
      this._sendRaw({ type: 'req', id, method, params });
    });
  }

  _clearPending(reason) {
    for (const [id, entry] of this._pendingRequests) {
      clearTimeout(entry.timeout);
      entry.reject(new Error(reason));
    }
    this._pendingRequests.clear();
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'hello-ok':
        this._handleHelloOk(msg);
        break;
      case 'res':
        this._handleResponse(msg);
        break;
      case 'event':
        this._handleEvent(msg);
        break;
      default:
        break;
    }
  }

  _handleHelloOk(msg) {
    console.log('[OpenClaw] Handshake accepted');
    const now = new Date().toISOString();

    this.sse.broadcast('system.health', { openClaw: 'connected' });

    if (this.serverStatus) {
      this.serverStatus.update({
        connection: 'connected',
        connectedAt: now,
        serverVersion: msg.serverVersion || null,
        serverHost: msg.serverHost || null,
        uptimeMs: msg.uptimeMs || null,
        sessionDefaults: msg.sessionDefaults || null,
        presence: msg.presence || [],
      });
    }

    this._startPeriodicFetch();
  }

  _handleResponse(msg) {
    const entry = this._pendingRequests.get(msg.id);
    if (entry) {
      clearTimeout(entry.timeout);
      this._pendingRequests.delete(msg.id);
      if (msg.error) {
        console.error('[OpenClaw] Response error:', msg.error.code, msg.error.message);
        entry.reject(new Error(msg.error.message || 'RPC error'));
      } else {
        entry.resolve(msg.result);
      }
    }
  }

  _handleEvent(msg) {
    const { event, payload } = msg;
    switch (event) {
      case 'agent':
      case 'presence':
        this._handleAgentEvent(payload || {});
        break;
      case 'health':
        this.sse.broadcast('system.health', payload || {});
        break;
      case 'heartbeat':
      case 'tick':
        this._handleHeartbeat(payload || {});
        break;
      default:
        break;
    }
  }

  _handleAgentEvent(data) {
    if (data.agentId || data.id) {
      this.agentService.upsert({
        id: data.agentId || data.id,
        name: data.name || data.agentId || data.id,
        status: this._mapStatus(data.status || data.state),
        currentTask: data.currentTask || null,
        metadata: data.metadata || {},
      });
    }
  }

  _handleHeartbeat(data) {
    if (data.agentId || data.id) {
      this.agentService.upsert({
        id: data.agentId || data.id,
        name: data.name || data.agentId || data.id,
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
      });
    }
  }

  _mapStatus(status) {
    const map = { running: 'active', connected: 'active', idle: 'idle', disconnected: 'offline', error: 'error' };
    return map[status] || status || 'offline';
  }

  _startPeriodicFetch() {
    this._stopPeriodicFetch();
    this._doPeriodicFetch();
    this._periodicTimer = setInterval(() => this._doPeriodicFetch(), 30000);
  }

  _stopPeriodicFetch() {
    if (this._periodicTimer) {
      clearInterval(this._periodicTimer);
      this._periodicTimer = null;
    }
  }

  async _doPeriodicFetch() {
    try {
      const [statusResult, presenceResult, heartbeatResult] = await Promise.allSettled([
        this._sendRequest('status'),
        this._sendRequest('system-presence'),
        this._sendRequest('last-heartbeat'),
      ]);

      const updates = { lastStatusFetch: new Date().toISOString() };

      if (statusResult.status === 'fulfilled') {
        updates.statusSummary = statusResult.value;
      }
      if (presenceResult.status === 'fulfilled') {
        updates.presence = presenceResult.value || [];
      }
      if (heartbeatResult.status === 'fulfilled') {
        updates.lastHeartbeat = heartbeatResult.value;
      }

      if (this.serverStatus) {
        this.serverStatus.update(updates);
      }
    } catch (err) {
      console.error('[OpenClaw] Periodic fetch error:', err.message);
    }
  }
}

module.exports = OpenClawCollector;
