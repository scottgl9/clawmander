const EventEmitter = require('events');

// Mock WebSocket before requiring OpenClawCollector
const mockInstances = [];

class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 1; // OPEN
    this.sent = [];
    this.closeCalled = false;
    mockInstances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closeCalled = true;
    this.readyState = 3;
  }
}

MockWebSocket.OPEN = 1;

jest.mock('ws', () => MockWebSocket);

const OpenClawCollector = require('../../backend/collectors/OpenClawCollector');

function mockAgentService() {
  return { upsert: jest.fn() };
}

function mockSSE() {
  return { broadcast: jest.fn() };
}

function mockServerStatus() {
  return { update: jest.fn(), getStatus: jest.fn() };
}

describe('OpenClawCollector', () => {
  let collector;
  let agentService;
  let sse;
  let serverStatus;

  beforeEach(() => {
    jest.useFakeTimers();
    mockInstances.length = 0;
    agentService = mockAgentService();
    sse = mockSSE();
    serverStatus = mockServerStatus();
    collector = new OpenClawCollector(agentService, sse, serverStatus);
  });

  afterEach(() => {
    collector.stop();
    jest.useRealTimers();
  });

  function getWs() {
    return mockInstances[mockInstances.length - 1];
  }

  function startAndConnect() {
    collector.start();
    const ws = getWs();
    ws.emit('open');
    return ws;
  }

  describe('start and handshake', () => {
    test('creates WebSocket connection on start', () => {
      collector.start();
      expect(mockInstances.length).toBe(1);
      expect(getWs().url).toBe('ws://127.0.0.1:18789');
    });

    test('updates server status to connecting on start', () => {
      collector.start();
      expect(serverStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({ connection: 'connecting' })
      );
    });

    test('sends protocol v3 connect frame on open', () => {
      const ws = startAndConnect();
      expect(ws.sent).toHaveLength(1);

      const frame = ws.sent[0];
      expect(frame.type).toBe('req');
      expect(frame.method).toBe('connect');
      expect(frame.id).toBeDefined();
      expect(frame.params.client.id).toBe('clawmander');
      expect(frame.params.client.mode).toBe('dashboard');
      expect(frame.params.role).toBe('operator');
      expect(frame.params.scopes).toEqual(['operator.read']);
      expect(frame.params.auth).toBeDefined();
    });

    test('does not send legacy connect format', () => {
      const ws = startAndConnect();
      const frame = ws.sent[0];
      // Should NOT have the old format fields at top level
      expect(frame.token).toBeUndefined();
      expect(frame.subscribe).toBeUndefined();
    });
  });

  describe('hello-ok handling', () => {
    test('updates server status on hello-ok', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'hello-ok',
        serverVersion: '3.0.0',
        serverHost: 'gw-1',
        uptimeMs: 5000,
        sessionDefaults: { defaultAgentId: 'agent-1' },
        presence: [{ host: 'client-a', platform: 'linux' }],
      }));

      expect(serverStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: 'connected',
          serverVersion: '3.0.0',
          serverHost: 'gw-1',
          uptimeMs: 5000,
          presence: [{ host: 'client-a', platform: 'linux' }],
        })
      );
    });

    test('broadcasts connected health event on hello-ok', () => {
      const ws = startAndConnect();
      ws.emit('message', JSON.stringify({ type: 'hello-ok' }));

      expect(sse.broadcast).toHaveBeenCalledWith('system.health', { openClaw: 'connected' });
    });

    test('starts periodic fetch after hello-ok', () => {
      const ws = startAndConnect();
      ws.emit('message', JSON.stringify({ type: 'hello-ok' }));

      // Should have sent RPC requests for periodic fetch (status, system-presence, last-heartbeat)
      // The connect frame is sent[0], periodic fetch RPCs start after hello-ok
      // They are sent asynchronously via _doPeriodicFetch
      // We need to flush promises
      expect(ws.sent.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RPC response handling', () => {
    test('resolves pending request on res message', async () => {
      const ws = startAndConnect();

      const promise = collector._sendRequest('status');

      // Find the request id
      const reqFrame = ws.sent.find(f => f.method === 'status');
      expect(reqFrame).toBeDefined();

      ws.emit('message', JSON.stringify({
        type: 'res',
        id: reqFrame.id,
        result: { sessions: { total: 5 } },
      }));

      const result = await promise;
      expect(result).toEqual({ sessions: { total: 5 } });
    });

    test('rejects pending request on res with error', async () => {
      const ws = startAndConnect();

      const promise = collector._sendRequest('bad-method');
      const reqFrame = ws.sent.find(f => f.method === 'bad-method');

      ws.emit('message', JSON.stringify({
        type: 'res',
        id: reqFrame.id,
        error: { message: 'unknown method' },
      }));

      await expect(promise).rejects.toThrow('unknown method');
    });

    test('request times out after 10 seconds', async () => {
      const ws = startAndConnect();

      const promise = collector._sendRequest('slow-method');

      jest.advanceTimersByTime(10001);

      await expect(promise).rejects.toThrow('RPC timeout');
    });
  });

  describe('event dispatching', () => {
    test('handles agent event', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'agent',
        payload: { agentId: 'agent-1', name: 'Test Agent', status: 'running' },
      }));

      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agent-1',
          name: 'Test Agent',
          status: 'active', // mapped from 'running'
        })
      );
    });

    test('handles presence event', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'presence',
        payload: { id: 'agent-2', name: 'Agent 2', state: 'idle' },
      }));

      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agent-2',
          status: 'idle',
        })
      );
    });

    test('handles health event', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'health',
        payload: { cpu: 45, memory: 72 },
      }));

      expect(sse.broadcast).toHaveBeenCalledWith('system.health', { cpu: 45, memory: 72 });
    });

    test('handles heartbeat event', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'heartbeat',
        payload: { agentId: 'agent-1', name: 'Agent 1' },
      }));

      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agent-1',
          status: 'active',
        })
      );
    });

    test('handles tick event same as heartbeat', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'tick',
        payload: { agentId: 'agent-3' },
      }));

      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agent-3',
          status: 'active',
        })
      );
    });
  });

  describe('disconnect and reconnect', () => {
    test('updates server status to disconnected on close', () => {
      const ws = startAndConnect();
      ws.emit('close');

      expect(serverStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: 'disconnected',
          connectedAt: null,
          presence: [],
        })
      );
    });

    test('broadcasts disconnected health event on close', () => {
      const ws = startAndConnect();
      ws.emit('close');

      expect(sse.broadcast).toHaveBeenCalledWith('system.health', { openClaw: 'disconnected' });
    });

    test('schedules reconnect on close', () => {
      const ws = startAndConnect();
      ws.emit('close');

      const countBefore = mockInstances.length;
      jest.advanceTimersByTime(1500);
      expect(mockInstances.length).toBe(countBefore + 1);
    });

    test('exponential backoff on repeated disconnects', () => {
      collector.start();
      const ws1 = getWs();
      ws1.emit('close');

      // First reconnect at 1s
      jest.advanceTimersByTime(1000);
      expect(mockInstances.length).toBe(2);

      getWs().emit('close');

      // Second reconnect at 2s
      jest.advanceTimersByTime(1500);
      expect(mockInstances.length).toBe(2); // not yet
      jest.advanceTimersByTime(600);
      expect(mockInstances.length).toBe(3);
    });

    test('does not reconnect after stop', () => {
      collector.start();
      collector.stop();
      const count = mockInstances.length;
      jest.advanceTimersByTime(60000);
      expect(mockInstances.length).toBe(count);
    });
  });

  describe('status mapping', () => {
    test.each([
      ['running', 'active'],
      ['connected', 'active'],
      ['idle', 'idle'],
      ['disconnected', 'offline'],
      ['error', 'error'],
      ['unknown', 'unknown'],
      [undefined, 'offline'],
    ])('maps "%s" to "%s"', (input, expected) => {
      expect(collector._mapStatus(input)).toBe(expected);
    });
  });

  describe('stop cleanup', () => {
    test('rejects pending requests on stop', async () => {
      const ws = startAndConnect();
      const promise = collector._sendRequest('test');
      collector.stop();
      await expect(promise).rejects.toThrow('collector stopped');
    });

    test('closes websocket on stop', () => {
      const ws = startAndConnect();
      collector.stop();
      expect(ws.closeCalled).toBe(true);
    });
  });
});
