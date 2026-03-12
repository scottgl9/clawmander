const { EventEmitter } = require('events');

class BrowserInstance {
  constructor(id, context, options = {}) {
    this.id = id;
    this.context = context;
    this.page = null;
    this.cdpSession = null;
    this.viewers = new Set();
    this.controlMode = 'shared'; // 'agent' | 'user' | 'shared'
    this.lastActivity = Date.now();
    this.emitter = new EventEmitter();
    this.screencastActive = false;
    this._userControlResolve = null;
    this._userControlTimeout = null;
    this.screencastOptions = options.screencast || { format: 'jpeg', quality: 60 };
    this.viewportSize = options.viewport || { width: 1280, height: 800 };
  }

  async init() {
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    this.cdpSession = await this.context.newCDPSession(this.page);

    // Listen for page events
    this.page.on('load', () => {
      this._broadcastMeta();
      this.emitter.emit('page-loaded', { url: this.page.url(), title: '' });
    });

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this._broadcastMeta();
        this.emitter.emit('url-changed', { url: this.page.url() });
      }
    });

    return this;
  }

  // --- Viewer Management ---

  addViewer(ws) {
    // Send initial metadata before adding to viewers / starting screencast
    this._sendJSON(ws, {
      type: 'connected',
      id: this.id,
      url: this.page.url(),
      title: '',
      controlMode: this.controlMode,
      viewport: this.viewportSize,
    });

    this.viewers.add(ws);
    if (this.viewers.size === 1) {
      this.startScreencast();
    }
  }

  removeViewer(ws) {
    this.viewers.delete(ws);
    if (this.viewers.size === 0) {
      this.stopScreencast();
    }
  }

  // --- Screencast ---

  async startScreencast() {
    if (this.screencastActive) return;
    this.screencastActive = true;

    this.cdpSession.on('Page.screencastFrame', (params) => {
      const buffer = Buffer.from(params.data, 'base64');
      for (const ws of this.viewers) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(buffer);
        }
      }
      // Acknowledge the frame
      this.cdpSession.send('Page.screencastFrameAck', {
        sessionId: params.sessionId,
      }).catch(() => {});
    });

    await this.cdpSession.send('Page.startScreencast', {
      format: this.screencastOptions.format,
      quality: this.screencastOptions.quality,
      maxWidth: this.viewportSize.width,
      maxHeight: this.viewportSize.height,
    }).catch((err) => {
      console.error(`[Browser:${this.id}] Failed to start screencast:`, err.message);
      this.screencastActive = false;
    });
  }

  async stopScreencast() {
    if (!this.screencastActive) return;
    this.screencastActive = false;

    await this.cdpSession.send('Page.stopScreencast').catch(() => {});
    this.cdpSession.removeAllListeners('Page.screencastFrame');
  }

  // --- Navigation & Interaction ---

  async navigate(url) {
    this.lastActivity = Date.now();
    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { url: this.page.url(), title: await this.page.title() };
  }

  async click(x, y) {
    this.lastActivity = Date.now();
    await this.page.mouse.click(x, y);
  }

  async clickSelector(selector) {
    this.lastActivity = Date.now();
    await this.page.click(selector);
  }

  async type(text) {
    this.lastActivity = Date.now();
    await this.page.keyboard.type(text);
  }

  async pressKey(key) {
    this.lastActivity = Date.now();
    await this.page.keyboard.press(key);
  }

  async goBack() {
    this.lastActivity = Date.now();
    await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  }

  async goForward() {
    this.lastActivity = Date.now();
    await this.page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  }

  async reload() {
    this.lastActivity = Date.now();
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  async scroll(x, y, deltaY) {
    this.lastActivity = Date.now();
    await this.page.mouse.move(x, y);
    await this.page.mouse.wheel(0, deltaY);
  }

  async screenshot() {
    this.lastActivity = Date.now();
    const buffer = await this.page.screenshot({ type: 'png' });
    return {
      image: buffer.toString('base64'),
      width: this.viewportSize.width,
      height: this.viewportSize.height,
    };
  }

  async getPageContent(selector) {
    this.lastActivity = Date.now();
    if (selector) {
      const el = await this.page.$(selector);
      if (!el) return { text: '', html: '' };
      const text = await el.innerText();
      const html = await el.innerHTML();
      return { text, html };
    }
    const text = await this.page.innerText('body');
    const html = await this.page.content();
    return { text, html };
  }

  async evaluate(script) {
    this.lastActivity = Date.now();
    const result = await this.page.evaluate(script);
    return { result };
  }

  async waitForSelector(selector, timeout = 5000) {
    this.lastActivity = Date.now();
    try {
      await this.page.waitForSelector(selector, { timeout });
      return { found: true };
    } catch {
      return { found: false };
    }
  }

  getCurrentUrl() {
    return this.page.url();
  }

  async getTitle() {
    return await this.page.title();
  }

  // --- Control Mode ---

  setControlMode(mode, reason) {
    this.controlMode = mode;
    this._broadcastJSON({
      type: 'control',
      mode,
      reason: reason || null,
    });
    this.emitter.emit('control-changed', { mode, reason });
  }

  requestUserControl(reason, timeoutMs = 300000) {
    this.setControlMode('user', reason);

    return new Promise((resolve, reject) => {
      this._userControlResolve = resolve;
      this._userControlTimeout = setTimeout(() => {
        this._userControlResolve = null;
        this._userControlTimeout = null;
        this.setControlMode('shared');
        resolve({ timedOut: true });
      }, timeoutMs);

      this._broadcastJSON({
        type: 'agent-message',
        message: reason || 'Agent needs your help',
      });
    });
  }

  releaseToAgent() {
    if (this._userControlResolve) {
      clearTimeout(this._userControlTimeout);
      const resolve = this._userControlResolve;
      this._userControlResolve = null;
      this._userControlTimeout = null;
      this.setControlMode('shared');
      resolve({ timedOut: false });
    } else {
      this.setControlMode('shared');
    }
  }

  // --- Helpers ---

  _broadcastMeta() {
    const meta = {
      type: 'meta',
      url: this.page.url(),
      title: '',
      controlMode: this.controlMode,
    };
    this._broadcastJSON(meta);
  }

  _broadcastJSON(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of this.viewers) {
      if (ws.readyState === 1) {
        ws.send(msg);
      }
    }
  }

  _sendJSON(ws, obj) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    }
  }

  getInfo() {
    return {
      id: this.id,
      url: this.page ? this.page.url() : 'about:blank',
      controlMode: this.controlMode,
      viewers: this.viewers.size,
      lastActivity: this.lastActivity,
      viewport: this.viewportSize,
    };
  }

  async destroy() {
    this.stopScreencast();
    // Close all viewer connections
    for (const ws of this.viewers) {
      ws.close();
    }
    this.viewers.clear();

    // Resolve any pending user control request
    if (this._userControlResolve) {
      clearTimeout(this._userControlTimeout);
      this._userControlResolve({ timedOut: false, destroyed: true });
      this._userControlResolve = null;
    }

    if (this.cdpSession) {
      await this.cdpSession.detach().catch(() => {});
    }
    await this.context.close().catch(() => {});
    this.emitter.removeAllListeners();
  }
}

module.exports = BrowserInstance;
