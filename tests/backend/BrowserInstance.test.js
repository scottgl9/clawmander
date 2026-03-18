const BrowserInstance = require('../../backend/services/BrowserInstance');

function createMockContext() {
  const mockCdpSession = {
    send: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    removeListener: jest.fn(),
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
    addInitScript: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
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

  test('init injects stealth script via addInitScript', async () => {
    expect(mockContext.addInitScript).toHaveBeenCalledTimes(1);
    expect(typeof mockContext.addInitScript.mock.calls[0][0]).toBe('function');
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

    test('click calls page.mouse.click and returns diagnostics', async () => {
      mockPage.evaluate.mockResolvedValueOnce({ tag: 'button', id: 'btn', className: '', text: 'Click' });
      const result = await instance.click(100, 200);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200);
      expect(result).toHaveProperty('x', 100);
      expect(result).toHaveProperty('y', 200);
      expect(result.elementInfo).toEqual({ tag: 'button', id: 'btn', className: '', text: 'Click' });
    });

    test('click returns null elementInfo on evaluate failure', async () => {
      mockPage.evaluate.mockRejectedValueOnce(new Error('eval failed'));
      const result = await instance.click(50, 50);
      expect(result.elementInfo).toBeNull();
    });

    test('clickSelector delegates to clickSmart', async () => {
      // clickSmart with {selector} will use page.locator().first().click()
      const mockLocator = { first: jest.fn().mockReturnValue({ click: jest.fn().mockResolvedValue(undefined) }) };
      mockPage.locator = jest.fn().mockReturnValue(mockLocator);
      mockPage.evaluate.mockResolvedValueOnce(null);
      const result = await instance.clickSelector('#btn');
      expect(result).toHaveProperty('success', true);
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

  describe('clickSmart', () => {
    test('tries role strategy first', async () => {
      const mockRoleLocator = { click: jest.fn().mockResolvedValue(undefined) };
      mockPage.getByRole = jest.fn().mockReturnValue(mockRoleLocator);
      mockPage.evaluate.mockResolvedValueOnce({ tag: 'button', id: 'x', text: 'Go' });

      const result = await instance.clickSmart({ role: 'button', name: 'Go' });
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('role');
      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: 'Go' });
    });

    test('falls back to text when role fails', async () => {
      mockPage.getByRole = jest.fn().mockReturnValue({ click: jest.fn().mockRejectedValue(new Error('not found')) });
      const mockTextLocator = { first: jest.fn().mockReturnValue({ click: jest.fn().mockResolvedValue(undefined) }) };
      mockPage.getByText = jest.fn().mockReturnValue(mockTextLocator);
      mockPage.evaluate.mockResolvedValueOnce(null);

      const result = await instance.clickSmart({ role: 'button', name: 'Go', text: 'Go' });
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('text');
    });

    test('returns error when no target specified', async () => {
      const result = await instance.clickSmart({});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No click target/);
    });

    test('returns error when all strategies fail', async () => {
      const mockLocator = { first: jest.fn().mockReturnValue({ click: jest.fn().mockRejectedValue(new Error('fail')) }) };
      mockPage.locator = jest.fn().mockReturnValue(mockLocator);

      const result = await instance.clickSmart({ selector: '#nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/All click strategies failed/);
    });
  });

  describe('keyboard actions', () => {
    test('tabAndEnter presses Tab N times then Enter', async () => {
      await instance.tabAndEnter(3);
      expect(mockPage.keyboard.press).toHaveBeenCalledTimes(4); // 3 Tabs + 1 Enter
      expect(mockPage.keyboard.press).toHaveBeenNthCalledWith(1, 'Tab');
      expect(mockPage.keyboard.press).toHaveBeenNthCalledWith(2, 'Tab');
      expect(mockPage.keyboard.press).toHaveBeenNthCalledWith(3, 'Tab');
      expect(mockPage.keyboard.press).toHaveBeenNthCalledWith(4, 'Enter');
    });

    test('focusAndType clicks selector then types', async () => {
      await instance.focusAndType('#input', 'hello');
      expect(mockPage.click).toHaveBeenCalledWith('#input');
      expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello');
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

    test('requestUserControl returns promise that resolves on release with context', async () => {
      const promise = instance.requestUserControl('need login');
      expect(instance.controlMode).toBe('user');

      instance.releaseToAgent();
      const result = await promise;
      expect(result.timedOut).toBe(false);
      expect(result.context).toEqual({ url: 'about:blank', title: '' });
      expect(instance.controlMode).toBe('shared');
    });

    test('requestUserControl broadcasts checklist', async () => {
      const ws = createMockWs();
      instance.addViewer(ws);
      ws.send.mockClear();

      const promise = instance.requestUserControl('login needed', 300000, ['Step 1', 'Step 2']);

      // Find the agent-message broadcast
      const calls = ws.send.mock.calls.map(c => JSON.parse(c[0]));
      const agentMsg = calls.find(c => c.type === 'agent-message');
      expect(agentMsg.checklist).toEqual(['Step 1', 'Step 2']);

      instance.releaseToAgent();
      await promise;
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

  describe('popup event', () => {
    test('emits popup-opened when context fires page event', async () => {
      // Get the page handler registered during init
      const pageHandler = mockContext.on.mock.calls.find(c => c[0] === 'page');
      expect(pageHandler).toBeTruthy();

      const popupEvents = [];
      instance.emitter.on('popup-opened', (data) => popupEvents.push(data));

      // Simulate a popup page opening
      const newMockPage = {
        url: jest.fn().mockReturnValue('https://accounts.google.com'),
        title: jest.fn().mockResolvedValue('Sign in'),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        mainFrame: jest.fn(),
      };
      const newMockCdp = {
        send: jest.fn().mockResolvedValue({}),
        on: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        detach: jest.fn().mockResolvedValue(undefined),
      };
      mockContext.newCDPSession.mockResolvedValueOnce(newMockCdp);

      await pageHandler[1](newMockPage);

      expect(popupEvents.length).toBe(1);
      expect(popupEvents[0].url).toBe('https://accounts.google.com');
      expect(popupEvents[0].pageId).toMatch(/^page-/);
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
        pages: [{ id: 'page-0', url: 'about:blank', title: '', isActive: true }],
        activePageId: 'page-0',
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
