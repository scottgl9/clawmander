const BrowserManager = require('../../backend/services/BrowserManager');

jest.mock('../../backend/services/BrowserInstance');
const BrowserInstance = require('../../backend/services/BrowserInstance');

// Mock playwright
jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: jest.fn(),
  },
}), { virtual: true });

// Mock fs
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
}));

function mockSSE() {
  return { broadcast: jest.fn() };
}

function createMockInstance(id) {
  return {
    id,
    viewers: new Set(),
    lastActivity: Date.now(),
    emitter: { on: jest.fn() },
    getInfo: jest.fn().mockReturnValue({ id, url: 'about:blank', controlMode: 'shared', viewers: 0, lastActivity: Date.now(), viewport: { width: 1280, height: 800 } }),
    destroy: jest.fn().mockResolvedValue(undefined),
    init: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BrowserManager', () => {
  let manager;
  let sse;
  let playwright;

  beforeEach(() => {
    sse = mockSSE();
    manager = new BrowserManager(sse, {
      browser: {
        maxInstances: 3,
        idleTimeoutMs: 1800000,
        profileDir: '/tmp/test-profiles',
        viewport: { width: 1280, height: 800 },
        screencast: { format: 'jpeg', quality: 60 },
      },
    });

    playwright = require('playwright');
    const mockContext = {
      pages: jest.fn().mockReturnValue([]),
      newPage: jest.fn().mockResolvedValue({}),
      newCDPSession: jest.fn().mockResolvedValue({
        send: jest.fn().mockResolvedValue({}),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        detach: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    playwright.chromium.launchPersistentContext.mockResolvedValue(mockContext);

    BrowserInstance.mockImplementation((id, ctx, opts) => {
      const inst = createMockInstance(id);
      inst.init.mockReturnThis();
      return inst;
    });
  });

  afterEach(() => {
    if (manager._idleTimer) clearInterval(manager._idleTimer);
  });

  test('init loads playwright', async () => {
    await manager.init();
    expect(manager._playwright).toBeDefined();
  });

  test('createInstance creates and stores instance', async () => {
    await manager.init();
    const instance = await manager.createInstance('test-1');
    expect(instance.id).toBe('test-1');
    expect(manager.instances.size).toBe(1);
    expect(sse.broadcast).toHaveBeenCalledWith('browser.created', expect.any(Object));
  });

  test('createInstance uses stealth launch args', async () => {
    await manager.init();
    await manager.createInstance('stealth-test');
    const launchCall = playwright.chromium.launchPersistentContext.mock.calls[0];
    const opts = launchCall[1];
    expect(opts.headless).toBe(true);
    expect(opts.ignoreDefaultArgs).toEqual(['--enable-automation']);
    expect(opts.args).toContain('--disable-blink-features=AutomationControlled');
    expect(opts.userAgent).toMatch(/Chrome\/146/);;
  });

  test('createInstance rejects duplicate ID', async () => {
    await manager.init();
    await manager.createInstance('dup');
    await expect(manager.createInstance('dup')).rejects.toThrow(/already exists/);
  });

  test('createInstance enforces maxInstances', async () => {
    await manager.init();
    await manager.createInstance('a');
    await manager.createInstance('b');
    await manager.createInstance('c');
    await expect(manager.createInstance('d')).rejects.toThrow(/Maximum/);
  });

  test('getInstance returns instance or null', async () => {
    await manager.init();
    await manager.createInstance('x');
    expect(manager.getInstance('x')).toBeDefined();
    expect(manager.getInstance('nope')).toBeNull();
  });

  test('listInstances returns summary array', async () => {
    await manager.init();
    await manager.createInstance('a');
    await manager.createInstance('b');
    const list = manager.listInstances();
    expect(list).toHaveLength(2);
  });

  test('destroyInstance removes instance and broadcasts', async () => {
    await manager.init();
    await manager.createInstance('del');
    const result = await manager.destroyInstance('del');
    expect(result).toBe(true);
    expect(manager.instances.size).toBe(0);
    expect(sse.broadcast).toHaveBeenCalledWith('browser.destroyed', { id: 'del' });
  });

  test('destroyInstance returns false for unknown ID', async () => {
    const result = await manager.destroyInstance('nope');
    expect(result).toBe(false);
  });

  test('destroyAll clears all instances', async () => {
    await manager.init();
    await manager.createInstance('a');
    await manager.createInstance('b');
    await manager.destroyAll();
    expect(manager.instances.size).toBe(0);
  });
});
