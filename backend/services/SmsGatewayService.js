const { v4: uuidv4 } = require('uuid');

class SmsGatewayService {
  constructor(messageModel) {
    this.messageModel = messageModel;
    this.asgUrl = process.env.ASG_URL || 'http://100.74.34.101:8080';
    this.asgUser = process.env.ASG_USER || 'sms';
    this.asgPass = process.env.ASG_PASS || 'ralmq5_o';
    this.callbackHost = process.env.ASG_CALLBACK_HOST || '100.111.249.37';
    this.callbackPort = process.env.ASG_CALLBACK_PORT || '3001';
    this.callbackPath = process.env.ASG_CALLBACK_PATH || '/api/sms/webhook';
  }

  _authHeader() {
    const creds = Buffer.from(`${this.asgUser}:${this.asgPass}`).toString('base64');
    return `Basic ${creds}`;
  }

  async _fetch(path, options = {}) {
    const url = `${this.asgUrl}${path}`;
    const headers = {
      'Authorization': this._authHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  async isReachable() {
    try {
      const res = await this._fetch('/health');
      return res.ok;
    } catch (err) {
      console.warn('[SMS] Phone unreachable:', err.message);
      return false;
    }
  }

  async registerWebhooks() {
    const callbackBase = `http://${this.callbackHost}:${this.callbackPort}${this.callbackPath}`;
    const events = ['sms:received', 'mms:received'];

    for (const event of events) {
      try {
        const res = await this._fetch('/webhooks', {
          method: 'POST',
          body: JSON.stringify({ event, url: callbackBase }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`[SMS] Failed to register webhook ${event}:`, res.status, text);
        } else {
          console.log(`[SMS] Registered webhook: ${event} -> ${callbackBase}`);
        }
      } catch (err) {
        console.warn(`[SMS] Error registering webhook ${event}:`, err.message);
      }
    }
  }

  normalizeMessage(payload) {
    const type = payload.type || (payload.subject || payload.contentClass ? 'mms' : 'sms');
    return {
      id: payload.messageId || payload.id || uuidv4(),
      type,
      sender: payload.sender || payload.phoneNumber || payload.address || null,
      recipient: payload.recipient || null,
      body: payload.message || payload.body || payload.text || null,
      subject: payload.subject || null,
      size: payload.size || null,
      content_class: payload.contentClass || payload.content_class || null,
      sim_number: payload.simNumber || payload.sim_number || null,
      received_at: payload.receivedAt || payload.date || null,
      raw_payload: JSON.stringify(payload),
    };
  }

  async syncFromPhone() {
    let count = 0;
    try {
      const res = await this._fetch('/messages');
      if (!res.ok) {
        console.warn('[SMS] Failed to fetch messages from phone:', res.status);
        return count;
      }
      const messages = await res.json();
      const arr = Array.isArray(messages) ? messages : messages.messages || [];
      for (const msg of arr) {
        const normalized = this.normalizeMessage(msg);
        const result = this.messageModel.upsert(normalized);
        if (result.inserted) count++;
      }
    } catch (err) {
      console.warn('[SMS] Error syncing from phone:', err.message);
    }
    return count;
  }

  async startup() {
    console.log(`[SMS] Starting gateway (ASG: ${this.asgUrl})`);
    try {
      await this.registerWebhooks();
    } catch (err) {
      console.error('[SMS] Webhook registration error:', err.message);
    }
    try {
      const count = await this.syncFromPhone();
      console.log(`[SMS] Initial sync: ${count} new messages`);
    } catch (err) {
      console.error('[SMS] Initial sync error:', err.message);
    }
  }
}

module.exports = SmsGatewayService;
