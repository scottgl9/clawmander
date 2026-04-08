const SSEManager = require('../../backend/services/SSEManager');

function mockRes({ failWrite = false } = {}) {
  const handlers = {};
  const writes = [];
  const res = {
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((payload) => {
      if (failWrite) throw new Error('socket closed');
      writes.push(payload);
      return true;
    }),
    on: jest.fn((ev, fn) => { handlers[ev] = fn; }),
    socket: { setTimeout: jest.fn() },
    // Test helpers
    _writes: writes,
    _fire: (ev) => handlers[ev] && handlers[ev](),
  };
  return res;
}

describe('SSEManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('addClient disables socket idle timeout and writes connected frame', () => {
    const mgr = new SSEManager();
    const res = mockRes();
    mgr.addClient(res);
    expect(res.socket.setTimeout).toHaveBeenCalledWith(0);
    expect(res._writes.some((w) => w.includes('"type":"connected"'))).toBe(true);
    expect(mgr.clientCount).toBe(1);
  });

  test('broadcast swallows write errors and drops the dead client', () => {
    const mgr = new SSEManager();
    const healthy = mockRes();
    const dead = mockRes({ failWrite: true });
    mgr.addClient(healthy);
    // For 'dead', addClient itself will hit the failing write on the initial
    // connected frame and drop the client — simulate a previously-healthy
    // client that starts failing on broadcast instead.
    mgr.addClient(mockRes());
    // Replace the second client's write to start failing now.
    const clients = Array.from(mgr.clients);
    const second = clients[1];
    second.write = () => { throw new Error('EPIPE'); };

    expect(() => mgr.broadcast('test', { hello: 'world' })).not.toThrow();
    expect(mgr.clientCount).toBe(1);
    expect(healthy._writes.some((w) => w.includes('event: test'))).toBe(true);
  });

  test('heartbeat interval writes comment frames every 15s', () => {
    const mgr = new SSEManager();
    const res = mockRes();
    mgr.addClient(res);
    res._writes.length = 0; // clear the connected frame
    jest.advanceTimersByTime(15000);
    expect(res._writes).toContain(':\n\n');
    jest.advanceTimersByTime(15000);
    expect(res._writes.filter((w) => w === ':\n\n').length).toBe(2);
  });

  test('client close clears the heartbeat interval and removes from set', () => {
    const mgr = new SSEManager();
    const res = mockRes();
    mgr.addClient(res);
    expect(mgr.clientCount).toBe(1);
    res._fire('close');
    expect(mgr.clientCount).toBe(0);
    // After close, advancing timers should NOT produce any more writes.
    res._writes.length = 0;
    jest.advanceTimersByTime(60000);
    expect(res._writes.length).toBe(0);
  });
});
