/**
 * ChatGatewayClient - Bidirectional WebSocket client to OpenClaw gateway.
 * Separate from OpenClawCollector (read-only) because chat requires write/admin scopes.
 */

const WebSocket = require('ws');
const config = require('../config/config');

class ChatGatewayClient {
  constructor(sseManager) {
    this.sse = sseManager;
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
  }

  get connected() {
    return this._connected;
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

  _sendConnectFrame() {
    const id = this._nextId();
    this._connectReqId = id;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'cli',
        version: '1.0.0',
        platform: process.platform,
        mode: 'cli',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
      auth: { token: config.openClaw.token || '' },
    };

    this._sendRaw({ type: 'req', id, method: 'connect', params });
  }

  _handleChallenge(msg) {
    console.log('[Chat] Received challenge, responding...');
    if (this._challengeTimer) {
      clearTimeout(this._challengeTimer);
      this._challengeTimer = null;
    }
    this._sendConnectFrame(msg);
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
    if (event === 'chat') {
      this._handleChatEvent(payload || {});
    }
  }

  _handleChatEvent(payload) {
    const { state, runId, sessionKey, seq } = payload;

    switch (state) {
      case 'delta': {
        // Extract text from message content blocks
        const text = this._extractText(payload.message);
        this.sse.broadcast('chat.delta', { sessionKey, runId, text, seq });
        break;
      }
      case 'final': {
        const text = this._extractText(payload.message);
        this.sse.broadcast('chat.final', { sessionKey, runId, text, usage: payload.usage || null });
        break;
      }
      case 'error':
        this.sse.broadcast('chat.error', { sessionKey, runId, error: payload.errorMessage || 'Unknown error' });
        break;
      case 'aborted':
        this.sse.broadcast('chat.aborted', { sessionKey, runId });
        break;
      default:
        break;
    }
  }

  _extractText(message) {
    if (!message) return '';
    if (typeof message === 'string') return message;
    // message.content is an array of content blocks
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
