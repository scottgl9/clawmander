const WebSocket = require('ws');
const config = require('../config/config');

class OpenClawCollector {
  constructor(agentService, sseManager) {
    this.agentService = agentService;
    this.sse = sseManager;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.running = false;
  }

  start() {
    this.running = true;
    this._connect();
  }

  stop() {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _connect() {
    if (!this.running) return;

    const url = config.openClaw.wsUrl;
    console.log(`[OpenClaw] Connecting to ${url}...`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.log(`[OpenClaw] Connection failed: ${err.message}`);
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[OpenClaw] Connected');
      this.reconnectDelay = 1000;

      // Send handshake
      this.ws.send(JSON.stringify({
        type: 'connect',
        token: config.openClaw.token,
        subscribe: ['agent', 'health', 'heartbeat', 'tick', 'presence'],
      }));

      this.sse.broadcast('system.health', { openClaw: 'connected' });
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
      this.sse.broadcast('system.health', { openClaw: 'disconnected' });
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

  _handleMessage(msg) {
    switch (msg.type) {
      case 'agent':
      case 'presence':
        this._handleAgentEvent(msg);
        break;
      case 'health':
        this.sse.broadcast('system.health', msg.data || msg);
        break;
      case 'heartbeat':
      case 'tick':
        this._handleHeartbeat(msg);
        break;
      default:
        break;
    }
  }

  _handleAgentEvent(msg) {
    const data = msg.data || msg;
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

  _handleHeartbeat(msg) {
    const data = msg.data || msg;
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
}

module.exports = OpenClawCollector;
