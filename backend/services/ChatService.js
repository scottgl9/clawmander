/**
 * ChatService - Local message history and orchestration.
 */

const { v4: uuidv4 } = require('uuid');
const FileStore = require('../storage/FileStore');

const MAX_MESSAGES_PER_SESSION = 200;

class ChatService {
  constructor(gatewayClient) {
    this.gateway = gatewayClient;
    this.store = new FileStore('chat-messages.json');
  }

  getHistory(sessionKey) {
    const all = this.store.read();
    return all.filter((m) => m.sessionKey === sessionKey);
  }

  getAllSessions() {
    const all = this.store.read();
    const keys = [...new Set(all.map((m) => m.sessionKey))];
    return keys;
  }

  addMessage(sessionKey, role, content, runId = null, state = 'complete', attachments = []) {
    const message = {
      id: uuidv4(),
      sessionKey,
      role,
      content,
      runId,
      state,
      attachments,
      timestamp: new Date().toISOString(),
    };

    const all = this.store.read();
    all.push(message);

    // Cap per session
    const sessionMsgs = all.filter((m) => m.sessionKey === sessionKey);
    if (sessionMsgs.length > MAX_MESSAGES_PER_SESSION) {
      const oldest = sessionMsgs[0];
      const idx = all.findIndex((m) => m.id === oldest.id);
      if (idx !== -1) all.splice(idx, 1);
    }

    this.store.write(all);
    return message;
  }

  updateMessage(id, updates) {
    const all = this.store.read();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    this.store.write(all);
    return all[idx];
  }

  findStreamingMessage(sessionKey, runId) {
    const all = this.store.read();
    return all.find((m) => m.sessionKey === sessionKey && m.runId === runId && m.state === 'streaming') || null;
  }

  async send(sessionKey, message, attachments = []) {
    if (!this.gateway.connected) {
      throw new Error('Not connected to gateway');
    }

    const runId = uuidv4();

    // Persist user message
    this.addMessage(sessionKey, 'user', message, runId, 'complete', attachments);

    // Create placeholder for streaming assistant response
    const assistantMsg = this.addMessage(sessionKey, 'assistant', '', runId, 'streaming');

    // Send to gateway — the response may contain the gateway's own runId for this run.
    // Use it if available so the frontend placeholder's runId matches SSE event runIds.
    const result = await this.gateway.sendMessage(sessionKey, message, attachments, runId);
    const actualRunId = result?.runId || runId;
    if (actualRunId !== runId) {
      this.updateMessage(assistantMsg.id, { runId: actualRunId });
    }

    return { runId: actualRunId, messageId: assistantMsg.id };
  }

  // Called when delta arrives (via SSE handler in routes/chat.js)
  onDelta(sessionKey, runId, text) {
    const msg = this.findStreamingMessage(sessionKey, runId);
    if (msg) {
      this.updateMessage(msg.id, { content: msg.content + text });
    }
  }

  // Called when final arrives
  onFinal(sessionKey, runId, text) {
    const msg = this.findStreamingMessage(sessionKey, runId);
    if (msg) {
      this.updateMessage(msg.id, { content: text || msg.content, state: 'complete' });
    }
  }

  // Called when error arrives
  onError(sessionKey, runId, error) {
    const msg = this.findStreamingMessage(sessionKey, runId);
    if (msg) {
      this.updateMessage(msg.id, { state: 'error', metadata: { error } });
    }
  }

  // Called when aborted
  onAborted(sessionKey, runId) {
    const msg = this.findStreamingMessage(sessionKey, runId);
    if (msg) {
      this.updateMessage(msg.id, { state: 'aborted' });
    }
  }
}

module.exports = ChatService;
