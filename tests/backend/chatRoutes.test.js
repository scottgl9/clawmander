const express = require('express');
const http = require('http');
const chatRoutes = require('../../backend/routes/chat');
const { stableGatewayMsgId } = require('../../backend/routes/chat');

function createTestApp(mockGatewayClient, mockChatService) {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRoutes(mockGatewayClient, mockChatService));
  return app;
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

function requestJson(app, method, path, payload) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const body = JSON.stringify(payload || {});
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.write(body);
      req.end();
    });
  });
}

function createMockGatewayClient(overrides = {}) {
  return {
    connected: true,
    getHistory: jest.fn().mockResolvedValue({ messages: [] }),
    getAgentStatuses: jest.fn().mockReturnValue([]),
    listSessions: jest.fn().mockResolvedValue({ sessions: [] }),
    listModels: jest.fn().mockResolvedValue({ models: [] }),
    abortRun: jest.fn().mockResolvedValue({}),
    resetSession: jest.fn().mockResolvedValue({}),
    patchSession: jest.fn().mockResolvedValue({}),
    resolveApproval: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function createMockChatService(overrides = {}) {
  return {
    send: jest.fn().mockResolvedValue({ runId: 'run-1' }),
    getHistory: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('GET /api/chat/history/:sessionKey', () => {
  test('returns activeRunId when an agent has an active run for the session', async () => {
    const mockGateway = createMockGatewayClient({
      getHistory: jest.fn().mockResolvedValue({
        messages: [
          { role: 'user', content: 'hello', id: 'msg-1' },
          { role: 'assistant', content: 'thinking...', id: 'msg-2', runId: 'run-42' },
        ],
      }),
      getAgentStatuses: jest.fn().mockReturnValue([
        { id: 'agent-1', name: 'test-agent', isWorking: true, runId: 'run-42', sessionKey: 'session-abc' },
      ]),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/history/session-abc');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('gateway');
    expect(res.body.activeRunId).toBe('run-42');
    expect(res.body.messages).toBeDefined();
    expect(mockGateway.getAgentStatuses).toHaveBeenCalledTimes(1);
  });

  test('returns activeRunId null when no agent is working on the session', async () => {
    const mockGateway = createMockGatewayClient({
      getHistory: jest.fn().mockResolvedValue({
        messages: [
          { role: 'user', content: 'hello', id: 'msg-1' },
          { role: 'assistant', content: 'done', id: 'msg-2' },
        ],
      }),
      getAgentStatuses: jest.fn().mockReturnValue([
        { id: 'agent-1', name: 'test-agent', isWorking: false, runId: null, sessionKey: 'session-abc' },
      ]),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/history/session-abc');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('gateway');
    expect(res.body.activeRunId).toBeNull();
  });

  test('returns activeRunId null when agent is working on a different session', async () => {
    const mockGateway = createMockGatewayClient({
      getHistory: jest.fn().mockResolvedValue({ messages: [] }),
      getAgentStatuses: jest.fn().mockReturnValue([
        { id: 'agent-1', name: 'test-agent', isWorking: true, runId: 'run-99', sessionKey: 'other-session' },
      ]),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/history/session-abc');

    expect(res.status).toBe(200);
    expect(res.body.activeRunId).toBeNull();
  });

  test('falls back to local chat service when gateway is disconnected', async () => {
    const localMessages = [
      { id: 'local-1', role: 'user', content: 'test', state: 'complete' },
    ];
    const mockGateway = createMockGatewayClient({ connected: false });
    const mockService = createMockChatService({
      getHistory: jest.fn().mockReturnValue(localMessages),
    });

    const app = createTestApp(mockGateway, mockService);
    const res = await request(app, '/api/chat/history/session-abc');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('local');
    expect(res.body.activeRunId).toBeNull();
    expect(res.body.messages).toEqual(localMessages);
    expect(mockService.getHistory).toHaveBeenCalledWith('session-abc');
  });

  test('falls back to local when gateway getHistory throws', async () => {
    const mockGateway = createMockGatewayClient({
      getHistory: jest.fn().mockRejectedValue(new Error('gateway timeout')),
    });
    const mockService = createMockChatService({
      getHistory: jest.fn().mockReturnValue([]),
    });

    const app = createTestApp(mockGateway, mockService);
    const res = await request(app, '/api/chat/history/session-abc');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('local');
    expect(res.body.activeRunId).toBeNull();
  });

  test('normalizes gateway messages — filters non-user/assistant roles', async () => {
    const mockGateway = createMockGatewayClient({
      getHistory: jest.fn().mockResolvedValue({
        messages: [
          { role: 'user', content: 'hello', id: 'msg-1' },
          { role: 'system', content: 'system prompt', id: 'msg-sys' },
          { role: 'assistant', content: 'hi there', id: 'msg-2' },
          { role: 'toolResult', content: 'tool output', id: 'msg-tool' },
        ],
      }),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/history/test-session');

    expect(res.status).toBe(200);
    // Only user and assistant messages should be returned
    const roles = res.body.messages.map((m) => m.role);
    expect(roles).toEqual(['user', 'assistant']);
    expect(res.body.messages).toHaveLength(2);
  });
});

describe('GET /api/chat/agents', () => {
  test('returns agent statuses and connection state', async () => {
    const agents = [
      { id: 'agent-1', name: 'Agent One', isWorking: true, runId: 'run-1', sessionKey: 'sess-1' },
      { id: 'agent-2', name: 'Agent Two', isWorking: false, runId: null, sessionKey: null },
    ];
    const mockGateway = createMockGatewayClient({
      connected: true,
      getAgentStatuses: jest.fn().mockReturnValue(agents),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/agents');

    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual(agents);
    expect(res.body.connected).toBe(true);
  });
});

describe('GET /api/chat/sessions', () => {
  test('returns empty sessions when disconnected', async () => {
    const mockGateway = createMockGatewayClient({ connected: false });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/sessions');

    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
    expect(res.body.connected).toBe(false);
  });

  test('returns sessions from gateway when connected', async () => {
    const sessions = [{ key: 'sess-1' }, { key: 'sess-2' }];
    const mockGateway = createMockGatewayClient({
      listSessions: jest.fn().mockResolvedValue({ sessions }),
    });

    const app = createTestApp(mockGateway, createMockChatService());
    const res = await request(app, '/api/chat/sessions');

    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual(sessions);
    expect(res.body.connected).toBe(true);
  });
});

describe('POST /api/chat/approval/resolve', () => {
  test('forwards allow-once approval decisions to the gateway', async () => {
    const mockGateway = createMockGatewayClient();
    const app = createTestApp(mockGateway, createMockChatService());

    const res = await requestJson(app, 'POST', '/api/chat/approval/resolve', {
      approvalId: 'approval-123',
      decision: 'allow-once',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockGateway.resolveApproval).toHaveBeenCalledWith('approval-123', 'allow-once');
  });

  test('forwards deny approval decisions to the gateway', async () => {
    const mockGateway = createMockGatewayClient();
    const app = createTestApp(mockGateway, createMockChatService());

    const res = await requestJson(app, 'POST', '/api/chat/approval/resolve', {
      approvalId: 'approval-123',
      decision: 'deny',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockGateway.resolveApproval).toHaveBeenCalledWith('approval-123', 'deny');
  });

  test('rejects invalid approval decision strings', async () => {
    const mockGateway = createMockGatewayClient();
    const app = createTestApp(mockGateway, createMockChatService());

    const res = await requestJson(app, 'POST', '/api/chat/approval/resolve', {
      approvalId: 'approval-123',
      decision: 'approve',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('decision must be allow-once or deny');
    expect(mockGateway.resolveApproval).not.toHaveBeenCalled();
  });
});

describe('stableGatewayMsgId', () => {
  test('is deterministic for identical inputs', () => {
    const msg = { role: 'assistant', content: 'hello world', runId: 'run-1' };
    const a = stableGatewayMsgId('agent:foo:bar', 3, msg);
    const b = stableGatewayMsgId('agent:foo:bar', 3, msg);
    expect(a).toBe(b);
    expect(a).toMatch(/^gw-/);
  });

  test('differs when index or content differs', () => {
    const msg = { role: 'assistant', content: 'hello', runId: 'r' };
    const base = stableGatewayMsgId('s', 0, msg);
    expect(stableGatewayMsgId('s', 1, msg)).not.toBe(base);
    expect(stableGatewayMsgId('s', 0, { ...msg, content: 'hello!' })).not.toBe(base);
    expect(stableGatewayMsgId('t', 0, msg)).not.toBe(base);
  });

  test('handles non-string content without throwing', () => {
    const msg = { role: 'user', content: [{ type: 'text', text: 'hi' }] };
    expect(() => stableGatewayMsgId('s', 0, msg)).not.toThrow();
  });
});
