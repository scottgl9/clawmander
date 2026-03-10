const WebSocket = require('ws');
const config = require('../config/config');
const { parseSessionKey } = require('../models/Task');
const { identity: deviceIdentity, buildAuthPayloadV3, sign: signPayload, publicKeyRawBase64Url } = require('../services/DeviceIdentity');

class OpenClawCollector {
  constructor(agentService, sseManager, serverStatusService, taskService) {
    this.agentService = agentService;
    this.sse = sseManager;
    this.serverStatus = serverStatusService;
    this.taskService = taskService;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.running = false;
    this._reqId = 0;
    this._pendingRequests = new Map();
    this._periodicTimer = null;
    this._connectReqId = null;
    this._challengeTimer = null;
    this._handshakeComplete = false;
  }

  start() {
    this.running = true;
    this._connect();
  }

  stop() {
    this.running = false;
    this._stopPeriodicFetch();
    this._clearPending('collector stopped');
    if (this._challengeTimer) {
      clearTimeout(this._challengeTimer);
      this._challengeTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _connect() {
    if (!this.running) return;

    const url = config.openClaw.wsUrl;
    console.log(`[OpenClaw] Connecting to ${url}...`);
    this._handshakeComplete = false;
    this._connectReqId = null;

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
      console.log('[OpenClaw] Connected, waiting for challenge...');
      this.reconnectDelay = 1000;

      // Wait for challenge from Gateway. If none arrives within 2s
      // (e.g. localhost connections where challenge is optional), send connect anyway.
      this._challengeTimer = setTimeout(() => {
        this._challengeTimer = null;
        if (!this._handshakeComplete && !this._connectReqId) {
          console.log('[OpenClaw] No challenge received, sending connect frame...');
          this._sendConnectFrame(null);
        }
      }, 2000);
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
      if (this._challengeTimer) {
        clearTimeout(this._challengeTimer);
        this._challengeTimer = null;
      }
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

  _sendConnectFrame(nonce) {
    const id = this._nextId();
    this._connectReqId = id;

    const scopes = ['operator.read'];
    const role = 'operator';
    const token = config.openClaw.token || '';
    const signedAtMs = Date.now();

    const clientId = 'gateway-client';
    const clientMode = 'backend';

    const device = (() => {
      if (!nonce) return undefined;
      const payload = buildAuthPayloadV3({
        deviceId: deviceIdentity.deviceId,
        clientId,
        clientMode,
        role,
        scopes,
        signedAtMs,
        token,
        nonce,
        platform: process.platform,
        deviceFamily: 'node',
      });
      return {
        id: deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64Url(deviceIdentity.publicKeyPem),
        signature: signPayload(deviceIdentity.privateKeyPem, payload),
        signedAt: signedAtMs,
        nonce,
      };
    })();

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: '1.0.0',
        platform: process.platform,
        mode: clientMode,
        deviceFamily: 'node',
      },
      role,
      scopes,
      auth: { token },
      ...(device ? { device } : {}),
    };

    this._sendRaw({ type: 'req', id, method: 'connect', params });
  }

  _handleChallenge(payload) {
    console.log('[OpenClaw] Received challenge, responding with connect frame...');
    if (this._challengeTimer) {
      clearTimeout(this._challengeTimer);
      this._challengeTimer = null;
    }
    const nonce = (typeof payload?.nonce === 'string' && payload.nonce.trim()) ? payload.nonce.trim() : null;
    this._sendConnectFrame(nonce);
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
    // Handle pre-connect challenge (first message before handshake)
    // Gateway sends: {type: "event", event: "connect.challenge", payload: {nonce, ts}}
    if (!this._handshakeComplete && !this._connectReqId &&
        msg.type === 'event' && msg.event === 'connect.challenge') {
      this._handleChallenge(msg.payload || msg);
      return;
    }

    // Handle connect response: Gateway wraps hello-ok inside a res message
    // Response format: {type: "res", id, ok: true, payload: {type: "hello-ok", protocol, server, ...}}
    if (!this._handshakeComplete && msg.type === 'res' && msg.id === this._connectReqId) {
      if (msg.ok === true) {
        this._handleHelloOk(msg.payload || msg.result || msg);
      } else if (msg.error) {
        console.error('[OpenClaw] Connect rejected:', msg.error.code, msg.error.message);
      }
      return;
    }

    switch (msg.type) {
      case 'hello-ok':
        // Backward compatibility: bare hello-ok message
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
    this._handshakeComplete = true;
    console.log('[OpenClaw] Handshake accepted');
    const now = new Date().toISOString();

    this.sse.broadcast('system.health', { openClaw: 'connected' });

    // Gateway nests most data inside msg.snapshot; server info is at msg.server
    const server = msg.server || {};
    const snapshot = msg.snapshot || {};
    if (this.serverStatus) {
      this.serverStatus.update({
        connection: 'connected',
        connectedAt: now,
        serverVersion: server.version || msg.serverVersion || null,
        serverHost: server.host || msg.serverHost || null,
        uptimeMs: snapshot.uptimeMs || msg.uptimeMs || null,
        sessionDefaults: snapshot.sessionDefaults || msg.sessionDefaults || null,
        presence: snapshot.presence || msg.presence || [],
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
        entry.resolve(msg.payload || msg.result);
      }
    }
  }

  _extractAgentIdFromSession(sessionKey) {
    if (!sessionKey) return null;
    const parts = sessionKey.split(':');
    // agent:<agentId>:... or clawmander:<agentId>:...
    if (parts.length >= 2 && (parts[0] === 'agent' || parts[0] === 'clawmander')) {
      return parts[1];
    }
    return null;
  }

  _handleEvent(msg) {
    const { event, payload } = msg;
    switch (event) {
      case 'agent': {
        const p = payload || {};
        // Gateway sends agent events as lifecycle stream: {runId, stream, data:{phase}, sessionKey}
        // The payload has NO direct agentId — extract from sessionKey
        if (p.stream === 'lifecycle' && p.data?.phase) {
          const agentId = this._extractAgentIdFromSession(p.sessionKey);
          if (agentId) {
            const synth = { agentId, runId: p.runId, sessionKey: p.sessionKey, name: agentId };
            if (p.data.phase === 'start') this._handleRunStart(synth);
            else if (p.data.phase === 'end') this._handleRunEnd(synth);
            else if (p.data.phase === 'error') this._handleRunError({ ...synth, error: p.data.error });
          }
        } else {
          // Legacy format with direct agentId field
          this._handleAgentEvent(p);
        }
        break;
      }
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
      case 'start':
        this._handleRunStart(payload || {});
        break;
      case 'end':
        this._handleRunEnd(payload || {});
        break;
      case 'error':
        this._handleRunError(payload || {});
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
    const agentId = data.agentId || data.id;
    if (agentId) {
      this.agentService.upsert({
        id: agentId,
        name: data.name || agentId,
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
      });
      // Only register the agent as known; don't override isWorking if a run is active
      const inProgress = this.taskService
        ? this.taskService.getAll({ agentId, status: 'in_progress' }).length > 0
        : false;
      this.sse.broadcast('agent.status', {
        agentId,
        name: data.name || agentId,
        isWorking: inProgress,
      });
    }
  }

  _handleRunStart(data) {
    if (!this.taskService) return;
    const agentId = data.agentId || data.id;
    if (!agentId) return;

    const parsed = parseSessionKey(data.sessionKey);
    const agentType = parsed.isSubagent ? 'subagent' : 'main';

    // Build a meaningful title from session key instead of raw runId
    let title = data.title;
    if (!title) {
      if (parsed.isSubagent && parsed.subagentId) {
        title = `Subagent: ${parsed.subagentId}`;
      } else if (parsed.agentId) {
        title = `Agent: ${parsed.agentId}`;
      } else {
        title = agentId;
      }
    }

    this.taskService.upsert({
      title,
      agentId,
      sessionKey: data.sessionKey || null,
      runId: data.runId || null,
      status: 'in_progress',
      agentType,
      metadata: { ...(data.metadata || {}), runId: data.runId },
    });

    this.agentService.upsert({
      id: agentId,
      name: data.name || agentId,
      status: 'active',
    });

    this.sse.broadcast('agent.status', {
      agentId,
      name: data.name || agentId,
      isWorking: true,
      runId: data.runId || null,
      sessionKey: data.sessionKey || null,
    });
  }

  _handleRunEnd(data) {
    if (!this.taskService) return;
    const agentId = data.agentId || data.id;
    if (!agentId) return;

    const tasks = this.taskService.getAll({ agentId });
    const match = tasks.find(
      (t) => t.sessionKey === data.sessionKey && t.runId === data.runId && t.status !== 'done'
    );
    if (match) {
      this.taskService.update(match.id, { status: 'done', progress: 100 });
    }

    // Clean up done tasks from previous days opportunistically
    this.taskService.cleanupDoneTasks();

    const remaining = this.taskService.getAll({ agentId, status: 'in_progress' });
    const stillWorking = remaining.length > 0;
    this.agentService.upsert({
      id: agentId,
      name: data.name || agentId,
      status: stillWorking ? 'active' : 'idle',
    });

    this.sse.broadcast('agent.status', {
      agentId,
      name: data.name || agentId,
      isWorking: stillWorking,
      runId: data.runId || null,
      sessionKey: data.sessionKey || null,
    });
  }

  _handleRunError(data) {
    if (!this.taskService) return;
    const agentId = data.agentId || data.id;
    if (!agentId) return;

    const tasks = this.taskService.getAll({ agentId });
    const match = tasks.find(
      (t) => t.sessionKey === data.sessionKey && t.runId === data.runId && t.status !== 'done'
    );
    if (match) {
      this.taskService.update(match.id, {
        status: 'blocked',
        metadata: { ...match.metadata, error: data.error || data.message || 'Unknown error' },
      });
    }

    this.agentService.upsert({
      id: agentId,
      name: data.name || agentId,
      status: 'error',
    });

    this.sse.broadcast('agent.status', {
      agentId,
      name: data.name || agentId,
      isWorking: false,
      runId: data.runId || null,
      sessionKey: data.sessionKey || null,
    });
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

      if (statusResult.status === 'fulfilled' && statusResult.value) {
        updates.statusSummary = this._normalizeStatus(statusResult.value);
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

  // Normalize the Gateway's status response into the shape the frontend expects
  _normalizeStatus(raw) {
    const result = { ...raw };

    // heartbeat.agents: Gateway returns array, frontend expects object keyed by agentId
    if (raw.heartbeat && Array.isArray(raw.heartbeat.agents)) {
      const agentsObj = {};
      for (const agent of raw.heartbeat.agents) {
        agentsObj[agent.agentId] = {
          enabled: agent.enabled,
          interval: agent.everyMs ? agent.everyMs / 1000 : null,
          every: agent.every,
        };
      }
      result.heartbeat = { ...raw.heartbeat, agents: agentsObj };
    }

    // sessions: Gateway has sessions.defaults.model, frontend expects sessions.defaultModel
    if (raw.sessions) {
      result.sessions = {
        ...raw.sessions,
        total: raw.sessions.total ?? raw.sessions.count,
        defaultModel: raw.sessions.defaultModel || raw.sessions.defaults?.model || null,
      };
    }

    // channelSummary: Gateway returns array of strings, frontend expects object with count
    if (Array.isArray(raw.channelSummary)) {
      result.channelSummary = { count: raw.channelSummary.length, items: raw.channelSummary };
    }

    return result;
  }
}

module.exports = OpenClawCollector;
