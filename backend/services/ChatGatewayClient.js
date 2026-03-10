/**
 * ChatGatewayClient - Bidirectional WebSocket client to OpenClaw gateway.
 * Separate from OpenClawCollector (read-only) because chat requires write/admin scopes.
 */

const WebSocket = require('ws');
const config = require('../config/config');
const { identity: deviceIdentity, buildAuthPayloadV3, sign: signPayload, publicKeyRawBase64Url } = require('./DeviceIdentity');

class ChatGatewayClient {
  constructor(sseManager, taskService) {
    this.sse = sseManager;
    this.taskService = taskService || null;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.running = false;
    this._reqId = 0;
    this._pendingRequests = new Map();
    this._connectReqId = null;
    this._challengeTimer = null;
    this._handshakeComplete = false;
    this._connected = false;

    // Agent activity tracking
    // _knownAgents: agentId -> { id, name, lastSeen }
    // _activeRuns:  agentId -> { runId, sessionKey, startedAt }
    this._knownAgents = new Map();
    this._activeRuns = new Map();
  }

  get connected() {
    return this._connected;
  }

  // Returns array of all known agents merged with their current working state
  getAgentStatuses() {
    const agents = [];
    for (const [agentId, info] of this._knownAgents) {
      const run = this._activeRuns.get(agentId);
      agents.push({
        id: agentId,
        name: info.name || agentId,
        lastSeen: info.lastSeen,
        isWorking: !!run,
        runId: run?.runId || null,
        sessionKey: run?.sessionKey || null,
      });
    }
    // Also include any agents working that aren't in knownAgents yet
    for (const [agentId, run] of this._activeRuns) {
      if (!this._knownAgents.has(agentId)) {
        agents.push({
          id: agentId,
          name: agentId,
          lastSeen: new Date().toISOString(),
          isWorking: true,
          runId: run.runId,
          sessionKey: run.sessionKey,
        });
      }
    }
    return agents;
  }

  start() {
    this.running = true;
    this._connect();
  }

  stop() {
    this.running = false;
    this._clearPending('client stopped');
    if (this._challengeTimer) {
      clearTimeout(this._challengeTimer);
      this._challengeTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this._handshakeComplete = false;
  }

  _connect() {
    if (!this.running) return;

    const url = config.openClaw.wsUrl;
    console.log(`[Chat] Connecting to ${url}...`);
    this._handshakeComplete = false;
    this._connected = false;
    this._connectReqId = null;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.log(`[Chat] Connection failed: ${err.message}`);
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[Chat] Connected, waiting for challenge...');
      this.reconnectDelay = 1000;

      this._challengeTimer = setTimeout(() => {
        this._challengeTimer = null;
        if (!this._handshakeComplete && !this._connectReqId) {
          console.log('[Chat] No challenge received, sending connect frame...');
          this._sendConnectFrame(null);
        }
      }, 2000);
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleMessage(msg);
      } catch (err) {
        console.error('[Chat] Parse error:', err.message);
      }
    });

    this.ws.on('close', () => {
      console.log('[Chat] Disconnected');
      this._connected = false;
      this._handshakeComplete = false;
      this._clearPending('disconnected');
      if (this._challengeTimer) {
        clearTimeout(this._challengeTimer);
        this._challengeTimer = null;
      }
      this._scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error(`[Chat] Error: ${err.message}`);
    });
  }

  _sendConnectFrame(nonce) {
    const id = this._nextId();
    this._connectReqId = id;

    const scopes = ['operator.read', 'operator.write', 'operator.admin'];
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
    console.log('[Chat] Received challenge, responding...');
    if (this._challengeTimer) {
      clearTimeout(this._challengeTimer);
      this._challengeTimer = null;
    }
    const nonce = (typeof payload?.nonce === 'string' && payload.nonce.trim()) ? payload.nonce.trim() : null;
    this._sendConnectFrame(nonce);
  }

  _scheduleReconnect() {
    if (!this.running) return;
    console.log(`[Chat] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    setTimeout(() => this._connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  _nextId() {
    return String(++this._reqId);
  }

  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  _sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        return reject(new Error('Chat gateway not connected'));
      }
      const id = this._nextId();
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30000);
      this._pendingRequests.set(id, { resolve, reject, timeout });
      this._sendRaw({ type: 'req', id, method, params });
    });
  }

  _clearPending(reason) {
    for (const [, entry] of this._pendingRequests) {
      clearTimeout(entry.timeout);
      entry.reject(new Error(reason));
    }
    this._pendingRequests.clear();
  }

  _handleMessage(msg) {
    if (!this._handshakeComplete && !this._connectReqId &&
        msg.type === 'event' && msg.event === 'connect.challenge') {
      this._handleChallenge(msg.payload || msg);
      return;
    }

    if (!this._handshakeComplete && msg.type === 'res' && msg.id === this._connectReqId) {
      if (msg.ok === true) {
        this._handleHelloOk(msg.payload || msg.result || msg);
      } else if (msg.error) {
        console.error('[Chat] Connect rejected:', msg.error.code, msg.error.message);
      }
      return;
    }

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
    this._handshakeComplete = true;
    this._connected = true;
    console.log('[Chat] Connected, handshake accepted');
    // Pre-populate known agents so the status bar shows idle agents immediately
    this._sendRequest('agents.list', {}).then((result) => {
      const list = Array.isArray(result) ? result : (result?.agents || result?.items || []);
      for (const a of list) {
        const id = a.id || a.agentId;
        if (id && !this._knownAgents.has(id)) {
          this._knownAgents.set(id, { name: a.name || id, lastSeen: new Date().toISOString() });
        }
      }
      if (list.length > 0) {
        console.log(`[Chat] Pre-populated ${list.length} known agent(s)`);
        this.sse.broadcast('agent.status.snapshot', { agents: this.getAgentStatuses() });
      }
    }).catch(() => {});
  }

  _handleResponse(msg) {
    const entry = this._pendingRequests.get(msg.id);
    if (entry) {
      clearTimeout(entry.timeout);
      this._pendingRequests.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(msg.error.message || 'RPC error'));
      } else {
        entry.resolve(msg.payload || msg.result);
      }
    }
  }

  _handleEvent(msg) {
    const { event, payload } = msg;
    switch (event) {
      case 'chat':
        this._handleChatEvent(payload || {});
        break;
      // Agent lifecycle events — two formats the gateway may use:
      // 1. top-level 'start'/'end'/'error' events (have agentId field)
      // 2. 'agent' event with stream='lifecycle' + data.phase (extract agentId from sessionKey)
      case 'start':
        this._handleRunLifecycle(payload || {}, 'start');
        break;
      case 'end':
        this._handleRunLifecycle(payload || {}, 'end');
        break;
      case 'agent':
        if ((payload || {}).stream === 'lifecycle') {
          const phase = payload.data?.phase;
          if (phase === 'start' || phase === 'end' || phase === 'error') {
            this._handleRunLifecycle({ ...payload, agentId: this._extractAgentId(payload.sessionKey) }, phase);
          }
        }
        break;
      // heartbeat: agent is alive, register it as known
      case 'heartbeat': {
        const agentId = (payload || {}).agentId || (payload || {}).id;
        if (agentId) this._touchAgent(agentId, (payload || {}).name);
        break;
      }
      default:
        break;
    }
  }

  // Extract agentId from a session key like agent:<agentId>:<label> or clawmander:<agentId>:<label>
  _extractAgentId(sessionKey) {
    if (!sessionKey) return null;
    const parts = sessionKey.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }

  _touchAgent(agentId, name) {
    this._knownAgents.set(agentId, {
      name: name || this._knownAgents.get(agentId)?.name || agentId,
      lastSeen: new Date().toISOString(),
    });
  }

  _handleRunLifecycle(data, phase) {
    const agentId = data.agentId || data.id || this._extractAgentId(data.sessionKey);
    if (!agentId) return;

    const runId = data.runId;
    const sessionKey = data.sessionKey;

    this._touchAgent(agentId, data.name);

    if (phase === 'start') {
      this._activeRuns.set(agentId, { runId, sessionKey, startedAt: Date.now() });
      console.log(`[Chat] Agent ${agentId} started run ${runId}`);
      this.sse.broadcast('agent.status', { agentId, isWorking: true, runId, sessionKey });
    } else {
      // end or error
      this._activeRuns.delete(agentId);
      console.log(`[Chat] Agent ${agentId} finished run ${runId}`);
      this.sse.broadcast('agent.status', { agentId, isWorking: false, runId, sessionKey });
    }
  }

  _handleChatEvent(payload) {
    const { state, runId, sessionKey, seq } = payload;

    // Use chat events as a reliable fallback for agent activity tracking.
    // The 'agent' lifecycle events may not always yield a parseable agentId,
    // but chat events are guaranteed to fire during streaming.
    const agentId = this._extractAgentId(sessionKey);

    switch (state) {
      case 'delta': {
        const text = this._extractText(payload.message);
        this.sse.broadcast('chat.delta', { sessionKey, runId, text, seq });
        // Mark agent as working on first delta
        if (agentId && !this._activeRuns.has(agentId)) {
          this._touchAgent(agentId);
          this._activeRuns.set(agentId, { runId, sessionKey, startedAt: Date.now() });
          this.sse.broadcast('agent.status', { agentId, isWorking: true, runId, sessionKey });
        }
        break;
      }
      case 'final': {
        const text = this._extractText(payload.message);
        this.sse.broadcast('chat.final', { sessionKey, runId, text, usage: payload.usage || null });
        if (agentId) {
          this._activeRuns.delete(agentId);
          this.sse.broadcast('agent.status', { agentId, isWorking: false, runId, sessionKey });
        }
        this._completeTask(sessionKey, runId, 'done');
        break;
      }
      case 'error':
        this.sse.broadcast('chat.error', { sessionKey, runId, error: payload.errorMessage || 'Unknown error' });
        if (agentId) {
          this._activeRuns.delete(agentId);
          this.sse.broadcast('agent.status', { agentId, isWorking: false, runId, sessionKey });
        }
        this._completeTask(sessionKey, runId, 'blocked');
        break;
      case 'aborted':
        this.sse.broadcast('chat.aborted', { sessionKey, runId });
        if (agentId) {
          this._activeRuns.delete(agentId);
          this.sse.broadcast('agent.status', { agentId, isWorking: false, runId, sessionKey });
        }
        this._completeTask(sessionKey, runId, 'done');
        break;
      default:
        break;
    }
  }

  _completeTask(sessionKey, runId, status) {
    if (!this.taskService || !sessionKey) return;
    const tasks = this.taskService.getAll();
    const match = tasks.find(
      (t) => t.sessionKey === sessionKey && (runId ? t.runId === runId : true) && t.status === 'in_progress'
    );
    if (match) {
      const updates = { status, progress: status === 'done' ? 100 : match.progress };
      this.taskService.update(match.id, updates);
    }
  }

  _extractText(message) {
    if (!message) return '';
    // Plain strings are tool outputs / raw content, not assistant streaming text — skip them.
    // Legitimate streaming deltas always arrive as { content: [...] } objects.
    if (typeof message === 'string') return '';
    if (Array.isArray(message.content)) {
      return message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text || '')
        .join('');
    }
    if (message.text) return message.text;
    return '';
  }

  // --- Public RPC Methods ---

  async sendMessage(sessionKey, message, attachments = [], idempotencyKey) {
    const { v4: uuidv4 } = require('uuid');
    const params = {
      sessionKey,
      message,
      idempotencyKey: idempotencyKey || uuidv4(),
    };
    if (attachments && attachments.length > 0) {
      params.attachments = attachments;
    }
    return this._sendRequest('chat.send', params);
  }

  async abortRun(sessionKey, runId) {
    const params = { sessionKey };
    if (runId) params.runId = runId;
    return this._sendRequest('chat.abort', params);
  }

  async getHistory(sessionKey, limit = 50) {
    return this._sendRequest('chat.history', { sessionKey, limit });
  }

  async listSessions(filters = {}) {
    return this._sendRequest('sessions.list', filters);
  }

  async resetSession(sessionKey, reason = 'new') {
    return this._sendRequest('sessions.reset', { key: sessionKey, reason });
  }

  async patchSession(sessionKey, patches) {
    return this._sendRequest('sessions.patch', { key: sessionKey, ...patches });
  }

  async listModels() {
    return this._sendRequest('models.list', {});
  }

  async resolveApproval(approvalId, decision) {
    return this._sendRequest('exec.approval-resolve', { id: approvalId, decision });
  }
}

module.exports = ChatGatewayClient;
