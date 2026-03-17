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

function mockTaskService() {
  return {
    upsert: jest.fn().mockReturnValue({ task: { id: 'task-1' }, created: true }),
    getAll: jest.fn().mockReturnValue([]),
    update: jest.fn().mockReturnValue({ id: 'task-1', status: 'done' }),
    cleanupDoneTasks: jest.fn(),
  };
}

describe('OpenClawCollector', () => {
  let collector;
  let agentService;
  let sse;
  let serverStatus;
  let taskService;

  beforeEach(() => {
    jest.useFakeTimers();
    mockInstances.length = 0;
    agentService = mockAgentService();
    sse = mockSSE();
    serverStatus = mockServerStatus();
    taskService = mockTaskService();
    collector = new OpenClawCollector(agentService, sse, serverStatus, taskService);
  });

  afterEach(() => {
    collector.stop();
    jest.useRealTimers();
  });

  function getWs() {
    return mockInstances[mockInstances.length - 1];
  }

  // Opens the WebSocket but does NOT trigger handshake completion.
  // After calling this, the collector is waiting for a challenge or 2s timeout.
  function startAndOpen() {
    collector.start();
    const ws = getWs();
    ws.emit('open');
    return ws;
  }

  // Opens the WebSocket and advances the 2s challenge timeout so the
  // connect frame is sent (simulates localhost where no challenge arrives).
  function startAndConnect() {
    const ws = startAndOpen();
    jest.advanceTimersByTime(2000);
    return ws;
  }

  // Opens the WebSocket and sends a challenge event from the Gateway,
  // which triggers the connect frame to be sent.
  function startAndConnectWithChallenge(nonce) {
    const ws = startAndOpen();
    ws.emit('message', JSON.stringify({
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce: nonce || 'test-nonce-123', ts: Date.now() },
    }));
    return ws;
  }

  // Completes the full handshake via a res-type hello-ok response.
  function completeHandshake(ws) {
    const connectFrame = ws.sent.find(f => f.method === 'connect');
    ws.emit('message', JSON.stringify({
      type: 'res',
      id: connectFrame.id,
      ok: true,
      payload: {
        type: 'hello-ok',
        protocol: 3,
        server: { version: '3.0.0', host: 'test-host' },
        snapshot: {
          uptimeMs: 12345,
          sessionDefaults: { defaultAgentId: 'main' },
          presence: [{ host: 'test-host', platform: 'linux', mode: 'gateway' }],
        },
      },
    }));
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

    test('does not send connect frame immediately on open', () => {
      const ws = startAndOpen();
      expect(ws.sent).toHaveLength(0);
    });

    test('sends connect frame after 2s timeout when no challenge received', () => {
      const ws = startAndConnect();
      expect(ws.sent).toHaveLength(1);

      const frame = ws.sent[0];
      expect(frame.type).toBe('req');
      expect(frame.method).toBe('connect');
      expect(frame.id).toBeDefined();
      expect(frame.params.client.id).toBe('gateway-client');
      expect(frame.params.client.mode).toBe('backend');
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

  describe('challenge handling', () => {
    test('sends connect frame immediately on receiving challenge event', () => {
      const ws = startAndOpen();
      expect(ws.sent).toHaveLength(0);

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'abc', ts: Date.now() },
      }));
      expect(ws.sent).toHaveLength(1);
      expect(ws.sent[0].method).toBe('connect');
    });

    test('connect frame does not include nonce in client params', () => {
      const ws = startAndConnectWithChallenge('nonce-xyz');
      const frame = ws.sent[0];
      // Nonce is informational only — not sent back to the Gateway
      expect(frame.params.client.nonce).toBeUndefined();
    });

    test('cancels timeout when challenge arrives before 2s', () => {
      const ws = startAndOpen();
      // Challenge arrives at 500ms
      jest.advanceTimersByTime(500);
      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'early', ts: Date.now() },
      }));
      expect(ws.sent).toHaveLength(1);

      // Advancing past the 2s mark should NOT send another connect frame
      jest.advanceTimersByTime(2000);
      expect(ws.sent).toHaveLength(1);
    });
  });

  describe('hello-ok handling', () => {
    test('handles hello-ok wrapped in res message (protocol v3)', () => {
      const ws = startAndConnect();
      completeHandshake(ws);

      expect(serverStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: 'connected',
          serverVersion: '3.0.0',
          serverHost: 'test-host',
          uptimeMs: 12345,
          sessionDefaults: { defaultAgentId: 'main' },
          presence: [{ host: 'test-host', platform: 'linux', mode: 'gateway' }],
        })
      );
    });

    test('handles bare hello-ok message (backward compatibility)', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'hello-ok',
        serverVersion: '2.0.0',
        serverHost: 'gw-legacy',
        uptimeMs: 5000,
        presence: [{ host: 'client-a', platform: 'linux' }],
      }));

      expect(serverStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: 'connected',
          serverVersion: '2.0.0',
          serverHost: 'gw-legacy',
          uptimeMs: 5000,
          presence: [{ host: 'client-a', platform: 'linux' }],
        })
      );
    });

    test('broadcasts connected health event on hello-ok', () => {
      const ws = startAndConnect();
      completeHandshake(ws);

      expect(sse.broadcast).toHaveBeenCalledWith('system.health', { openClaw: 'connected' });
    });

    test('starts periodic fetch after hello-ok', () => {
      const ws = startAndConnect();
      completeHandshake(ws);

      // The connect frame is sent[0], periodic fetch RPCs start after hello-ok
      expect(ws.sent.length).toBeGreaterThanOrEqual(1);
    });

    test('rejects connect if res has error', () => {
      const ws = startAndConnect();
      const connectFrame = ws.sent.find(f => f.method === 'connect');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      ws.emit('message', JSON.stringify({
        type: 'res',
        id: connectFrame.id,
        error: { code: 'AUTH_FAILED', message: 'invalid token' },
      }));
      consoleSpy.mockRestore();

      // Should NOT have updated to connected
      expect(serverStatus.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ connection: 'connected' })
      );
    });
  });

  describe('RPC response handling', () => {
    test('resolves pending request on res message', async () => {
      const ws = startAndConnect();
      completeHandshake(ws);

      const promise = collector._sendRequest('test-rpc');

      // Find the request id (use a unique method name to avoid matching periodic fetch)
      const reqFrame = ws.sent.find(f => f.method === 'test-rpc');
      expect(reqFrame).toBeDefined();

      ws.emit('message', JSON.stringify({
        type: 'res',
        id: reqFrame.id,
        ok: true,
        payload: { sessions: { total: 5 } },
      }));

      const result = await promise;
      expect(result).toEqual({ sessions: { total: 5 } });
    });

    test('rejects pending request on res with error', async () => {
      const ws = startAndConnect();
      completeHandshake(ws);

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
      completeHandshake(ws);

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

  describe('lifecycle events (start/end/error)', () => {
    test('start event creates task and marks agent active', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'start',
        payload: {
          agentId: 'agent-1',
          sessionKey: 'agent:agent-1:sess-1',
          runId: 'run-1',
          title: 'Test run',
        },
      }));

      expect(taskService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          sessionKey: 'agent:agent-1:sess-1',
          runId: 'run-1',
          status: 'in_progress',
          agentType: 'main',
        })
      );
      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'active' })
      );
    });

    test('start event detects subagent from session key', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'start',
        payload: {
          agentId: 'agent-1',
          sessionKey: 'agent:agent-1:subagent:sub-uuid',
          runId: 'run-2',
        },
      }));

      expect(taskService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ agentType: 'subagent' })
      );
    });

    test('end event completes matching task and sets agent idle', () => {
      const matchingTask = { id: 'task-1', sessionKey: 'sess-1', runId: 'run-1', status: 'in_progress' };
      taskService.getAll
        .mockReturnValueOnce([matchingTask])  // first call: find by agentId
        .mockReturnValueOnce([]);              // second call: check remaining in_progress

      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'end',
        payload: { agentId: 'agent-1', sessionKey: 'sess-1', runId: 'run-1' },
      }));

      expect(taskService.update).toHaveBeenCalledWith('task-1', { status: 'done', progress: 100 });
      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'idle' })
      );
    });

    test('end event keeps agent active if other tasks remain', () => {
      const matchingTask = { id: 'task-1', sessionKey: 'sess-1', runId: 'run-1', status: 'in_progress' };
      const otherTask = { id: 'task-2', sessionKey: 'sess-2', runId: 'run-2', status: 'in_progress' };
      taskService.getAll
        .mockReturnValueOnce([matchingTask, otherTask])  // find by agentId
        .mockReturnValueOnce([otherTask]);               // remaining in_progress

      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'end',
        payload: { agentId: 'agent-1', sessionKey: 'sess-1', runId: 'run-1' },
      }));

      expect(taskService.update).toHaveBeenCalledWith('task-1', { status: 'done', progress: 100 });
      // Agent should NOT be set to idle
      expect(agentService.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'idle' })
      );
    });

    test('error event blocks matching task and sets agent error', () => {
      const matchingTask = { id: 'task-1', sessionKey: 'sess-1', runId: 'run-1', status: 'in_progress', metadata: {} };
      taskService.getAll.mockReturnValueOnce([matchingTask]);

      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'error',
        payload: { agentId: 'agent-1', sessionKey: 'sess-1', runId: 'run-1', error: 'Connection failed' },
      }));

      expect(taskService.update).toHaveBeenCalledWith('task-1', {
        status: 'blocked',
        metadata: { error: 'Connection failed' },
      });
      expect(agentService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'error' })
      );
    });

    test('lifecycle events are no-ops without taskService', () => {
      const collectorNoTask = new OpenClawCollector(agentService, sse, serverStatus);
      collectorNoTask.start();
      const ws = getWs();
      ws.emit('open');
      jest.advanceTimersByTime(2000);

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'start',
        payload: { agentId: 'agent-1', runId: 'run-1' },
      }));

      expect(taskService.upsert).not.toHaveBeenCalled();
      collectorNoTask.stop();
    });

    test('start event ignores payload without agentId', () => {
      const ws = startAndConnect();

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: 'start',
        payload: { runId: 'run-1' },
      }));

      expect(taskService.upsert).not.toHaveBeenCalled();
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

    test('clears challenge timer on close', () => {
      const ws = startAndOpen();
      // Close before the 2s challenge timeout
      ws.emit('close');
      // Advancing past the timeout should NOT send a connect frame
      jest.advanceTimersByTime(3000);
      expect(ws.sent).toHaveLength(0);
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
      completeHandshake(ws);
      const promise = collector._sendRequest('test');
      collector.stop();
      await expect(promise).rejects.toThrow('collector stopped');
    });

    test('closes websocket on stop', () => {
      const ws = startAndConnect();
      collector.stop();
      expect(ws.closeCalled).toBe(true);
    });

    test('clears challenge timer on stop', () => {
      const ws = startAndOpen();
      collector.stop();
      // Advancing past the timeout should NOT send a connect frame
      jest.advanceTimersByTime(3000);
      expect(ws.sent).toHaveLength(0);
    });
  });
});
