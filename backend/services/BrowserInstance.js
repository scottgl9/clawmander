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
    this.chromeVersion = options.chromeVersion || '146.0.7680.80';
    this.chromeMajorVersion = options.chromeMajorVersion || '146';

    // Multi-page (popup/tab) support
    this.pages = new Map();       // pageId -> { page, cdpSession }
    this.activePageId = null;
    this._pageCounter = 0;
  }

  async init() {
    const existingPages = this.context.pages();
    this.page = existingPages.length > 0 ? existingPages[0] : await this.context.newPage();

    // Stealth: patch automation-detectable properties on every new page/navigation
    await this.context.addInitScript(() => {
      // Hide webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Fake plugins array (headless has 0 plugins)
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
          ];
          plugins.refresh = () => {};
          return plugins;
        },
      });

      // Fake mimeTypes
      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const types = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'Chrome PDF Plugin' } },
            { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'Chrome PDF Viewer' } },
          ];
          return types;
        },
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Ensure chrome object looks real
      if (!window.chrome) window.chrome = {};
      window.chrome.runtime = window.chrome.runtime || {};
      // Stub chrome.runtime methods Google checks for
      window.chrome.runtime.connect = window.chrome.runtime.connect || function () { return { onMessage: { addListener: () => {} }, postMessage: () => {}, onDisconnect: { addListener: () => {} } }; };
      window.chrome.runtime.sendMessage = window.chrome.runtime.sendMessage || function (msg, cb) { if (cb) cb(); };
      window.chrome.loadTimes = window.chrome.loadTimes || function () {
        return { commitLoadTime: Date.now() / 1000, connectionInfo: 'h2', finishDocumentLoadTime: Date.now() / 1000, finishLoadTime: Date.now() / 1000, firstPaintAfterLoadTime: 0, firstPaintTime: Date.now() / 1000, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true };
      };
      window.chrome.csi = window.chrome.csi || function () {
        return { onloadT: Date.now(), pageT: Date.now(), startE: Date.now(), tran: 15 };
      };
      window.chrome.app = window.chrome.app || { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };

      // Fix permissions query
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      // Spoof WebGL vendor/renderer (headless uses SwiftShader — must match Linux platform)
      const getParameterProto = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return 'Google Inc. (NVIDIA Corporation)';        // UNMASKED_VENDOR_WEBGL
        if (param === 37446) return 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1650/PCIe/SSE2, OpenGL 4.5)'; // UNMASKED_RENDERER_WEBGL
        return getParameterProto.call(this, param);
      };
      const getParameterProto2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return 'Google Inc. (NVIDIA Corporation)';
        if (param === 37446) return 'ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1650/PCIe/SSE2, OpenGL 4.5)';
        return getParameterProto2.call(this, param);
      };

      // Fake screen dimensions to look like a real 1080p desktop
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1053 }); // minus taskbar
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

      // Headless: outerHeight === innerHeight (no browser chrome) — dead giveaway
      // Simulate a normal Chrome window with toolbar/tabs (~85px chrome)
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 });
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
      // screenX/screenY should look like a positioned window
      Object.defineProperty(window, 'screenX', { get: () => 0 });
      Object.defineProperty(window, 'screenY', { get: () => 0 });

      // Override hardwareConcurrency (headless often shows unusual values)
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

      // Fake connection info
      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 });
        Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
      }

      // Prevent Notification.permission from being "default" in headless
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
      }
    });

    this.cdpSession = await this.context.newCDPSession(this.page);
    await this._applyStealthCDP(this.cdpSession);

    // Register initial page
    const initialPageId = 'page-0';
    this.pages.set(initialPageId, { page: this.page, cdpSession: this.cdpSession });
    this.activePageId = initialPageId;

    // Attach page event listeners
    this._attachPageListeners(this.page);

    // Listen for popup / new-tab pages
    this.context.on('page', async (newPage) => {
      const pageId = `page-${++this._pageCounter}`;
      await newPage.waitForLoadState('domcontentloaded').catch(() => {});

      const cdp = await this.context.newCDPSession(newPage);
      await this._applyStealthCDP(cdp);

      this.pages.set(pageId, { page: newPage, cdpSession: cdp });
      this._attachPageListeners(newPage);

      // Auto-cleanup when popup closes
      newPage.on('close', () => {
        const closing = this.pages.get(pageId);
        if (!closing) return;
        if (closing.cdpSession) closing.cdpSession.detach().catch(() => {});
        this.pages.delete(pageId);

        // If the active page was closed, switch to another
        if (this.activePageId === pageId) {
          const remaining = Array.from(this.pages.keys());
          if (remaining.length > 0) {
            this.switchPage(remaining[remaining.length - 1]);
          }
        }
        this._broadcastPagesUpdated();
      });

      // Auto-switch to the new popup
      await this.switchPage(pageId);
      this._broadcastPagesUpdated();
    });

    return this;
  }

  // --- CDP Stealth (extracted for reuse on popups) ---

  async _applyStealthCDP(cdpSession) {
    // CDP-level stealth: runs before ANY page JS, even before addInitScript
    await cdpSession.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        // Remove Playwright-injected globals
        delete window.__playwright;
        delete window.__pw_manual;
        delete window.__PW_inspect;

        // Remove any cdc_ (ChromeDriver) properties from document
        const cleanCdc = () => {
          for (const prop of Object.getOwnPropertyNames(document)) {
            if (prop.match(/^\\$cdc_|^cdc_|^__cdc/)) {
              delete document[prop];
            }
          }
        };
        cleanCdc();

        // Patch iframe contentWindow to hide webdriver in child contexts
        const origHTMLIFrameElement = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
        if (origHTMLIFrameElement) {
          Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function () {
              const w = origHTMLIFrameElement.call(this);
              if (w) {
                try { Object.defineProperty(w.navigator, 'webdriver', { get: () => undefined }); } catch {}
              }
              return w;
            },
          });
        }

        // Prevent toString detection of overridden functions
        const nativeToString = Function.prototype.toString;
        const overrides = new Map();
        Function.prototype.toString = function () {
          if (overrides.has(this)) return overrides.get(this);
          return nativeToString.call(this);
        };
        overrides.set(Function.prototype.toString, 'function toString() { [native code] }');

        // Prevent detection via error stack traces that reveal automation paths
        const originalError = Error;
        const patchedError = new Proxy(originalError, {
          construct(target, args) {
            const err = new target(...args);
            if (err.stack) {
              err.stack = err.stack.replace(/playwright|puppeteer|automation|headless/gi, '');
            }
            return err;
          }
        });
        // Don't replace Error globally as it can break things, but patch stack on getters
      `,
    }).catch(() => {});

    // Hide the Runtime domain enable that Playwright uses (leaks automation)
    await cdpSession.send('Runtime.enable').catch(() => {});

    // Override user-agent hints via CDP (Client Hints API — used by Google)
    const ver = this.chromeVersion;
    const major = this.chromeMajorVersion;
    const realUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
    await cdpSession.send('Emulation.setUserAgentOverride', {
      userAgent: realUA,
      acceptLanguage: 'en-US,en;q=0.9',
      platform: 'Linux',
      userAgentMetadata: {
        brands: [
          { brand: 'Chromium', version: major },
          { brand: 'Google Chrome', version: major },
          { brand: 'Not=A?Brand', version: '24' },
        ],
        fullVersionList: [
          { brand: 'Chromium', version: ver },
          { brand: 'Google Chrome', version: ver },
          { brand: 'Not=A?Brand', version: '24.0.0.0' },
        ],
        fullVersion: ver,
        platform: 'Linux',
        platformVersion: '6.11.0',
        architecture: 'x86',
        model: '',
        mobile: false,
        bitness: '64',
        wow64: false,
      },
    }).catch(() => {});
  }

  // --- Page event listeners (extracted for reuse on popups) ---

  _attachPageListeners(page) {
    page.on('load', () => {
      // Only broadcast meta if this is the active page
      if (this._getPageId(page) === this.activePageId) {
        this._broadcastMeta();
        this.emitter.emit('page-loaded', { url: page.url(), title: '' });
      }
    });

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && this._getPageId(page) === this.activePageId) {
        this._broadcastMeta();
        this.emitter.emit('url-changed', { url: page.url() });
      }
    });
  }

  _getPageId(page) {
    for (const [id, entry] of this.pages) {
      if (entry.page === page) return id;
    }
    return null;
  }

  // --- Multi-page management ---

  getPages() {
    const result = [];
    for (const [id, entry] of this.pages) {
      let url = 'about:blank';
      let title = '';
      try {
        url = entry.page.url();
        // title is async but we want sync — use url-based fallback
      } catch {}
      result.push({ id, url, title, isActive: id === this.activePageId });
    }
    return result;
  }

  async switchPage(pageId) {
    const entry = this.pages.get(pageId);
    if (!entry) return;

    // Stop screencast on old CDP session
    if (this.screencastActive) {
      await this.cdpSession.send('Page.stopScreencast').catch(() => {});
      this.cdpSession.removeAllListeners('Page.screencastFrame');
      this.screencastActive = false;
    }

    // Switch references
    this.page = entry.page;
    this.cdpSession = entry.cdpSession;
    this.activePageId = pageId;

    // Restart screencast on new page if we have viewers
    if (this.viewers.size > 0) {
      await this.startScreencast();
    }

    this._broadcastMeta();
    this._broadcastPagesUpdated();
  }

  async closePage(pageId) {
    if (this.pages.size <= 1) return; // Don't close the last page

    const entry = this.pages.get(pageId);
    if (!entry) return;

    // If closing the active page, switch first
    if (this.activePageId === pageId) {
      const remaining = Array.from(this.pages.keys()).filter(id => id !== pageId);
      if (remaining.length > 0) {
        await this.switchPage(remaining[remaining.length - 1]);
      }
    }

    // Detach CDP and close
    if (entry.cdpSession) {
      await entry.cdpSession.detach().catch(() => {});
    }
    await entry.page.close().catch(() => {});
    this.pages.delete(pageId);

    this._broadcastPagesUpdated();
  }

  _broadcastPagesUpdated() {
    this._broadcastJSON({
      type: 'pages-updated',
      pages: this.getPages(),
      activePageId: this.activePageId,
    });
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
      pages: this.getPages(),
      activePageId: this.activePageId,
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

  _onScreencastFrame(params) {
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
  }

  async startScreencast() {
    if (this.screencastActive) return;
    this.screencastActive = true;

    this._boundScreencastFrame = this._onScreencastFrame.bind(this);
    this.cdpSession.on('Page.screencastFrame', this._boundScreencastFrame);

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
    if (this._boundScreencastFrame) {
      this.cdpSession.removeListener('Page.screencastFrame', this._boundScreencastFrame);
      this._boundScreencastFrame = null;
    }
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
      pages: this.getPages(),
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
      pages: this.getPages(),
      activePageId: this.activePageId,
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

    // Detach all CDP sessions
    for (const [, entry] of this.pages) {
      if (entry.cdpSession) {
        await entry.cdpSession.detach().catch(() => {});
      }
    }
    this.pages.clear();

    await this.context.close().catch(() => {});
    this.emitter.removeAllListeners();
  }
}

module.exports = BrowserInstance;
