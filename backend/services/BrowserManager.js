const path = require('path');
const fs = require('fs');
const BrowserInstance = require('./BrowserInstance');

class BrowserManager {
  constructor(sseManager, config) {
    this.sseManager = sseManager;
    this.config = config.browser || {};
    this.instances = new Map();
    this._idleTimer = null;
    this._playwright = null;
  }

  async init() {
    try {
      this._playwright = require('playwright');
      console.log('[Browser] Playwright loaded, Chromium ready');
    } catch (err) {
      console.error('[Browser] Failed to load playwright:', err.message);
      console.error('[Browser] Install with: npm install playwright && npx playwright install chromium');
      throw err;
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

    const context = await this._playwright.chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const instance = new BrowserInstance(id, context, {
      viewport,
      screencast: this.config.screencast,
    });
    await instance.init();

    // Wire SSE events
    instance.emitter.on('url-changed', (data) => {
      this.sseManager.broadcast('browser.url_changed', { id, ...data });
    });
    instance.emitter.on('control-changed', (data) => {
      this.sseManager.broadcast('browser.control_changed', { id, ...data });
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
