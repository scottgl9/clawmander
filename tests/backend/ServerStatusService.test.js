const ServerStatusService = require('../../backend/services/ServerStatusService');

function mockSSE() {
  return { broadcast: jest.fn() };
}

describe('ServerStatusService', () => {
  let service;
  let sse;

  beforeEach(() => {
    sse = mockSSE();
    service = new ServerStatusService(sse);
  });

  test('getStatus returns default disconnected state', () => {
    const status = service.getStatus();
    expect(status.connection).toBe('disconnected');
    expect(status.connectedAt).toBeNull();
    expect(status.openClawUrl).toBeNull();
    expect(status.serverVersion).toBeNull();
    expect(status.serverHost).toBeNull();
    expect(status.uptimeMs).toBeNull();
    expect(status.sessionDefaults).toBeNull();
    expect(status.presence).toEqual([]);
    expect(status.statusSummary).toBeNull();
    expect(status.lastHeartbeat).toBeNull();
    expect(status.lastUpdated).toBeNull();
    expect(status.lastStatusFetch).toBeNull();
  });

  test('getStatus returns a copy, not a reference', () => {
    const a = service.getStatus();
    const b = service.getStatus();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  test('update merges partial state', () => {
    service.update({ connection: 'connecting', openClawUrl: 'ws://localhost:18789' });
    const status = service.getStatus();
    expect(status.connection).toBe('connecting');
    expect(status.openClawUrl).toBe('ws://localhost:18789');
    // unchanged fields remain
    expect(status.serverVersion).toBeNull();
  });

  test('update sets lastUpdated timestamp', () => {
    const before = Date.now();
    service.update({ connection: 'connected' });
    const after = Date.now();
    const ts = new Date(service.getStatus().lastUpdated).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('update broadcasts server.status SSE event', () => {
    service.update({ connection: 'connected' });
    expect(sse.broadcast).toHaveBeenCalledTimes(1);
    expect(sse.broadcast).toHaveBeenCalledWith('server.status', expect.objectContaining({
      connection: 'connected',
    }));
  });

  test('multiple updates accumulate state', () => {
    service.update({ connection: 'connecting' });
    service.update({ connection: 'connected', serverVersion: '2.1.0' });
    service.update({ uptimeMs: 120000 });

    const status = service.getStatus();
    expect(status.connection).toBe('connected');
    expect(status.serverVersion).toBe('2.1.0');
    expect(status.uptimeMs).toBe(120000);
    expect(sse.broadcast).toHaveBeenCalledTimes(3);
  });

  test('update overwrites previous values for same keys', () => {
    service.update({ presence: [{ host: 'a' }] });
    service.update({ presence: [{ host: 'b' }, { host: 'c' }] });
    expect(service.getStatus().presence).toEqual([{ host: 'b' }, { host: 'c' }]);
  });

  test('update with full snapshot from hello-ok', () => {
    service.update({
      connection: 'connected',
      connectedAt: '2025-01-01T00:00:00.000Z',
      serverVersion: '3.0.0',
      serverHost: 'gateway-1',
      uptimeMs: 86400000,
      sessionDefaults: { defaultAgentId: 'agent-1', mainKey: 'key', scope: 'default' },
      presence: [
        { host: 'client-a', platform: 'linux', version: '1.0', mode: 'dashboard' },
      ],
    });

    const status = service.getStatus();
    expect(status.connection).toBe('connected');
    expect(status.serverVersion).toBe('3.0.0');
    expect(status.serverHost).toBe('gateway-1');
    expect(status.uptimeMs).toBe(86400000);
    expect(status.sessionDefaults.defaultAgentId).toBe('agent-1');
    expect(status.presence).toHaveLength(1);
    expect(status.presence[0].host).toBe('client-a');
  });
});
