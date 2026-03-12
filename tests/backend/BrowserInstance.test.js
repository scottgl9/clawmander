const BrowserInstance = require('../../backend/services/BrowserInstance');

function createMockContext() {
  const mockCdpSession = {
    send: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    detach: jest.fn().mockResolvedValue(undefined),
  };

  const mockPage = {
    url: jest.fn().mockReturnValue('about:blank'),
    title: jest.fn().mockResolvedValue(''),
    goto: jest.fn().mockResolvedValue(null),
    click: jest.fn().mockResolvedValue(undefined),
    mouse: {
      click: jest.fn().mockResolvedValue(undefined),
      move: jest.fn().mockResolvedValue(undefined),
      wheel: jest.fn().mockResolvedValue(undefined),
    },
    keyboard: {
      type: jest.fn().mockResolvedValue(undefined),
      press: jest.fn().mockResolvedValue(undefined),
    },
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fakepng')),
    $: jest.fn().mockResolvedValue(null),
    innerText: jest.fn().mockResolvedValue('text'),
    content: jest.fn().mockResolvedValue('<html></html>'),
    evaluate: jest.fn().mockResolvedValue('result'),
    waitForSelector: jest.fn().mockResolvedValue(null),
    on: jest.fn(),
    mainFrame: jest.fn(),
  };

  const mockContext = {
    pages: jest.fn().mockReturnValue([mockPage]),
    newPage: jest.fn().mockResolvedValue(mockPage),
    newCDPSession: jest.fn().mockResolvedValue(mockCdpSession),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return { mockContext, mockPage, mockCdpSession };
}

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: jest.fn(),
    close: jest.fn(),
  };
}

describe('BrowserInstance', () => {
  let instance;
  let mockPage, mockCdpSession, mockContext;

  beforeEach(async () => {
    const mocks = createMockContext();
    mockContext = mocks.mockContext;
    mockPage = mocks.mockPage;
    mockCdpSession = mocks.mockCdpSession;

    instance = new BrowserInstance('test-1', mockContext, {
      viewport: { width: 1280, height: 800 },
      screencast: { format: 'jpeg', quality: 60 },
    });
    await instance.init();
  });

  test('constructor sets initial state', () => {
    expect(instance.id).toBe('test-1');
    expect(instance.controlMode).toBe('shared');
    expect(instance.viewers.size).toBe(0);
    expect(instance.screencastActive).toBe(false);
  });

  test('init uses existing page from context', async () => {
    expect(instance.page).toBe(mockPage);
    expect(mockContext.newCDPSession).toHaveBeenCalledWith(mockPage);
  });

  test('init creates new page if none exist', async () => {
    const mocks = createMockContext();
    mocks.mockContext.pages.mockReturnValue([]);
    const inst = new BrowserInstance('test-2', mocks.mockContext);
    await inst.init();
    expect(mocks.mockContext.newPage).toHaveBeenCalled();
  });

  describe('viewer management', () => {
    test('addViewer adds ws and starts screencast on first viewer', () => {
      const ws = createMockWs();
      instance.addViewer(ws);
      expect(instance.viewers.size).toBe(1);
      expect(instance.screencastActive).toBe(true);
      // Should send initial connected message
      expect(ws.send).toHaveBeenCalled();
      const msg = JSON.parse(ws.send.mock.calls[0][0]);
      expect(msg.type).toBe('connected');
      expect(msg.id).toBe('test-1');
    });

    test('removeViewer removes ws and stops screencast on last viewer', async () => {
      const ws = createMockWs();
      instance.addViewer(ws);
      instance.removeViewer(ws);
      expect(instance.viewers.size).toBe(0);
      expect(instance.screencastActive).toBe(false);
    });

    test('screencast stays active with multiple viewers', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      instance.addViewer(ws1);
      instance.addViewer(ws2);
      instance.removeViewer(ws1);
      expect(instance.viewers.size).toBe(1);
      expect(instance.screencastActive).toBe(true);
    });
  });

  describe('navigation and interaction', () => {
    test('navigate calls page.goto and returns url/title', async () => {
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Example');
      const result = await instance.navigate('https://example.com');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
      expect(result).toEqual({ url: 'https://example.com', title: 'Example' });
    });

    test('navigate prepends https:// if missing', async () => {
      await instance.navigate('example.com');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    test('click calls page.mouse.click', async () => {
      await instance.click(100, 200);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200);
    });

    test('clickSelector calls page.click', async () => {
      await instance.clickSelector('#btn');
      expect(mockPage.click).toHaveBeenCalledWith('#btn');
    });

    test('type calls page.keyboard.type', async () => {
      await instance.type('hello');
      expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello');
    });

    test('pressKey calls page.keyboard.press', async () => {
      await instance.pressKey('Enter');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    test('scroll moves mouse and wheels', async () => {
      await instance.scroll(100, 200, -300);
      expect(mockPage.mouse.move).toHaveBeenCalledWith(100, 200);
      expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, -300);
    });

    test('screenshot returns base64 PNG', async () => {
      const result = await instance.screenshot();
      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png' });
      expect(result).toHaveProperty('image');
      expect(result).toHaveProperty('width', 1280);
      expect(result).toHaveProperty('height', 800);
    });

    test('evaluate calls page.evaluate', async () => {
      const result = await instance.evaluate('1+1');
      expect(mockPage.evaluate).toHaveBeenCalledWith('1+1');
      expect(result).toEqual({ result: 'result' });
    });

    test('waitForSelector returns found:true on success', async () => {
      const result = await instance.waitForSelector('#el', 1000);
      expect(result).toEqual({ found: true });
    });

    test('waitForSelector returns found:false on timeout', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('timeout'));
      const result = await instance.waitForSelector('#el', 1);
      expect(result).toEqual({ found: false });
    });
  });

  describe('control mode', () => {
    test('setControlMode updates mode and broadcasts', () => {
      const ws = createMockWs();
      instance.addViewer(ws);
      ws.send.mockClear();

      instance.setControlMode('agent', 'working');
      expect(instance.controlMode).toBe('agent');
      expect(ws.send).toHaveBeenCalled();
      const msg = JSON.parse(ws.send.mock.calls[0][0]);
      expect(msg.type).toBe('control');
      expect(msg.mode).toBe('agent');
    });

    test('requestUserControl returns promise that resolves on release', async () => {
      const promise = instance.requestUserControl('need login');
      expect(instance.controlMode).toBe('user');

      instance.releaseToAgent();
      const result = await promise;
      expect(result).toEqual({ timedOut: false });
      expect(instance.controlMode).toBe('shared');
    });

    test('requestUserControl times out', async () => {
      const promise = instance.requestUserControl('need help', 50);
      const result = await promise;
      expect(result).toEqual({ timedOut: true });
      expect(instance.controlMode).toBe('shared');
    });

    test('releaseToAgent without pending request sets shared', () => {
      instance.setControlMode('user');
      instance.releaseToAgent();
      expect(instance.controlMode).toBe('shared');
    });
  });

  describe('getInfo', () => {
    test('returns instance summary', () => {
      const info = instance.getInfo();
      expect(info).toEqual({
        id: 'test-1',
        url: 'about:blank',
        controlMode: 'shared',
        viewers: 0,
        lastActivity: expect.any(Number),
        viewport: { width: 1280, height: 800 },
      });
    });
  });

  describe('destroy', () => {
    test('cleans up cdp session, context, and viewers', async () => {
      const ws = createMockWs();
      instance.addViewer(ws);

      await instance.destroy();
      expect(ws.close).toHaveBeenCalled();
      expect(instance.viewers.size).toBe(0);
      expect(mockCdpSession.detach).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
    });

    test('resolves pending user control on destroy', async () => {
      const promise = instance.requestUserControl('help');
      await instance.destroy();
      const result = await promise;
      expect(result).toEqual({ timedOut: false, destroyed: true });
    });
  });
});
