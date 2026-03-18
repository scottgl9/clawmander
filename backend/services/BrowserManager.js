const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const BrowserInstance = require('./BrowserInstance');

// Detect system Chrome executable path
function findSystemChrome() {
  const candidates = [
    'google-chrome-stable',
    'google-chrome',
    'chromium-browser',
    'chromium',
  ];
  for (const bin of candidates) {
    try {
      const p = execSync(`which ${bin} 2>/dev/null`).toString().trim();
      if (p) return p;
    } catch {}
  }
  return null;
}

// Get version from the Chrome binary (e.g. "146.0.7680.80")
function getChromeVersion(chromePath) {
  if (!chromePath) return null;
  try {
    const out = execSync(`"${chromePath}" --version 2>/dev/null`).toString().trim();
    const match = out.match(/([\d]+\.[\d]+\.[\d]+\.[\d]+)/);
    return match ? match[1] : null;
  } catch {}
  return null;
}

class BrowserManager {
  constructor(sseManager, config) {
    this.sseManager = sseManager;
    this.config = config.browser || {};
    this.instances = new Map();
    this._idleTimer = null;
    this._playwright = null;
    this._chromePath = null;
    this._chromeVersion = null;  // e.g. "146.0.7680.80"
  }

  async init() {
    try {
      this._playwright = require('playwright');
      console.log('[Browser] Playwright loaded');
    } catch (err) {
      console.error('[Browser] Failed to load playwright:', err.message);
      console.error('[Browser] Install with: npm install playwright && npx playwright install chromium');
      throw err;
    }

    // Prefer system Chrome over Playwright's bundled Chromium for Testing
    this._chromePath = findSystemChrome();
    if (this._chromePath) {
      this._chromeVersion = getChromeVersion(this._chromePath);
      console.log(`[Browser] Using system Chrome: ${this._chromePath} (v${this._chromeVersion || 'unknown'})`);
    } else {
      console.log('[Browser] System Chrome not found, using bundled Chromium');
    }

    // Ensure profile directory exists
    const profileDir = this.config.profileDir;
    if (profileDir) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    this._startIdleCheck();
  }

  async createInstance(id, opts = {}) {
    if (this.instances.has(id)) {
      throw Object.assign(new Error(`Browser instance "${id}" already exists`), { code: 'DUPLICATE' });
    }

    if (this.instances.size >= (this.config.maxInstances || 5)) {
      throw Object.assign(new Error('Maximum browser instances reached'), { code: 'MAX_INSTANCES' });
    }

    const profileDir = path.join(this.config.profileDir, id);
    fs.mkdirSync(profileDir, { recursive: true });

    const viewport = opts.viewport || this.config.viewport || { width: 1280, height: 800 };

    const launchOpts = {
      headless: false,  // we use --headless=new via args for the new headless mode
      viewport,
      args: [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--lang=en-US,en',
        '--disable-component-update',
        '--disable-default-apps',
        '--no-first-run',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--disable-ipc-flooding-protection',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        // Auth-flow compatibility: allow third-party cookies for OAuth popups
        '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,FedCm',
      ],
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
    };

    // Use system Chrome binary if available (avoids "Chrome for Testing" detection)
    if (this._chromePath) {
      launchOpts.executablePath = this._chromePath;
    }

    // Build UA from the real installed Chrome version
    const ver = this._chromeVersion || '146.0.7680.80';
    const majorVer = ver.split('.')[0];
    launchOpts.userAgent = this.config.userAgent
      || `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;

    const context = await this._playwright.chromium.launchPersistentContext(profileDir, launchOpts);

    const instance = new BrowserInstance(id, context, {
      viewport,
      screencast: this.config.screencast,
      chromeVersion: ver,
      chromeMajorVersion: majorVer,
    });
    await instance.init();

    // Wire SSE events
    instance.emitter.on('url-changed', (data) => {
      this.sseManager.broadcast('browser.url_changed', { id, ...data });
    });
    instance.emitter.on('control-changed', (data) => {
      this.sseManager.broadcast('browser.control_changed', { id, ...data });
    });
    instance.emitter.on('popup-opened', (data) => {
      this.sseManager.broadcast('browser.popup_opened', { id, ...data });
    });

    this.instances.set(id, instance);
    this.sseManager.broadcast('browser.created', instance.getInfo());

    return instance;
  }

  getInstance(id) {
    return this.instances.get(id) || null;
  }

  listInstances() {
    return Array.from(this.instances.values()).map((inst) => inst.getInfo());
  }

  async destroyInstance(id) {
    const instance = this.instances.get(id);
    if (!instance) return false;

    await instance.destroy();
    this.instances.delete(id);
    this.sseManager.broadcast('browser.destroyed', { id });
    return true;
  }

  async destroyAll() {
    if (this._idleTimer) {
      clearInterval(this._idleTimer);
      this._idleTimer = null;
    }

    const promises = [];
    for (const [id, instance] of this.instances) {
      promises.push(instance.destroy().catch((err) => {
        console.error(`[Browser] Error destroying instance ${id}:`, err.message);
      }));
    }
    await Promise.all(promises);
    this.instances.clear();
  }

  _startIdleCheck() {
    const intervalMs = 60000;
    const idleTimeout = this.config.idleTimeoutMs || 1800000;

    this._idleTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, instance] of this.instances) {
        if (instance.viewers.size === 0 && (now - instance.lastActivity) > idleTimeout) {
          console.log(`[Browser] Destroying idle instance: ${id}`);
          this.destroyInstance(id);
        }
      }
    }, intervalMs);
  }
}

module.exports = BrowserManager;
