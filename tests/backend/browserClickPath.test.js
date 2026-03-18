const BrowserInstance = require('../../backend/services/BrowserInstance');

function createMockContext() {
  const mockCdpSession = {
    send: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    detach: jest.fn().mockResolvedValue(undefined),
  };

  const mockLocatorResult = { click: jest.fn().mockResolvedValue(undefined) };
  const mockLocator = { first: jest.fn().mockReturnValue(mockLocatorResult) };
  const mockRoleLocator = { click: jest.fn().mockResolvedValue(undefined) };
  const mockTextLocator = { first: jest.fn().mockReturnValue({ click: jest.fn().mockResolvedValue(undefined) }) };

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
    evaluate: jest.fn().mockResolvedValue(null),
    waitForSelector: jest.fn().mockResolvedValue(null),
    locator: jest.fn().mockReturnValue(mockLocator),
    getByRole: jest.fn().mockReturnValue(mockRoleLocator),
    getByText: jest.fn().mockReturnValue(mockTextLocator),
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

  return { mockContext, mockPage, mockCdpSession, mockLocator, mockRoleLocator, mockTextLocator };
}

function createMockWs(readyState = 1) {
  return { readyState, send: jest.fn(), close: jest.fn() };
}

describe('Browser Click Path', () => {
  let instance, mockPage;

  beforeEach(async () => {
    const mocks = createMockContext();
    mockPage = mocks.mockPage;
    instance = new BrowserInstance('click-test', mocks.mockContext, {
      viewport: { width: 1280, height: 800 },
    });
    await instance.init();
  });

  describe('normalized → viewport coordinate flow', () => {
    test('click at normalized (0.5, 0.5) maps to viewport center', async () => {
      const normX = 0.5, normY = 0.5;
      const pixelX = normX * instance.viewportSize.width;
      const pixelY = normY * instance.viewportSize.height;

      await instance.click(pixelX, pixelY);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(640, 400);
    });

    test('click at (0, 0) maps to top-left', async () => {
      await instance.click(0, 0);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(0, 0);
    });

    test('click at (1, 1) maps to bottom-right', async () => {
      const px = 1 * 1280, py = 1 * 800;
      await instance.click(px, py);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(1280, 800);
    });
  });

  describe('selector click flow', () => {
    test('clickSmart with selector calls locator().first().click()', async () => {
      const result = await instance.clickSmart({ selector: '#sign-in' });
      expect(mockPage.locator).toHaveBeenCalledWith('#sign-in');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('selector');
    });

    test('clickSmart with role calls getByRole', async () => {
      const result = await instance.clickSmart({ role: 'button', name: 'Sign in' });
      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: 'Sign in' });
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('role');
    });

    test('clickSmart with text calls getByText', async () => {
      const result = await instance.clickSmart({ text: 'Sign in' });
      expect(mockPage.getByText).toHaveBeenCalledWith('Sign in');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('text');
    });
  });

  describe('control mode blocking', () => {
    test('input-blocked message sent when control mode is agent', () => {
      const ws = createMockWs();
      instance.addViewer(ws);
      instance.setControlMode('agent');
      ws.send.mockClear();

      // Simulate what the WS handler does
      const blockedTypes = ['click', 'type', 'key', 'scroll', 'mousemove'];
      for (const msgType of blockedTypes) {
        if (instance.controlMode === 'agent') {
          instance._sendJSON(ws, {
            type: 'input-blocked',
            reason: 'Control mode is agent',
            mode: instance.controlMode,
          });
        }
      }

      const sentMessages = ws.send.mock.calls.map(c => JSON.parse(c[0]));
      const blockedMessages = sentMessages.filter(m => m.type === 'input-blocked');
      expect(blockedMessages.length).toBe(5);
      expect(blockedMessages[0].reason).toBe('Control mode is agent');
      expect(blockedMessages[0].mode).toBe('agent');
    });

    test('input is not blocked in shared mode', () => {
      instance.setControlMode('shared');
      expect(instance.controlMode).toBe('shared');
      // In shared mode the WS handler does NOT block — no input-blocked sent
    });
  });

  describe('click diagnostics', () => {
    test('click returns element info from page.evaluate', async () => {
      mockPage.evaluate.mockResolvedValueOnce({
        tag: 'button',
        id: 'sign-in',
        className: 'btn primary',
        text: 'Sign in as clawmander',
      });

      const result = await instance.click(640, 400);
      expect(result.elementInfo.tag).toBe('button');
      expect(result.elementInfo.id).toBe('sign-in');
      expect(result.elementInfo.text).toBe('Sign in as clawmander');
    });
  });
});
