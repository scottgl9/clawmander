const { generateAccessToken } = require('../../backend/utils/crypto');

// We need to override config before requiring middleware
jest.mock('../../backend/config/config', () => ({
  authToken: 'test-bearer-token',
  jwt: {
    secret: 'test-jwt-secret',
    refreshSecret: 'test-refresh-secret',
    expiry: '15m',
    refreshExpiry: '7d',
  },
}));

const { requireUser, requireAdmin, optionalUser } = require('../../backend/middleware/userAuth');
const anyAuth = require('../../backend/middleware/anyAuth');
const rateLimit = require('../../backend/middleware/rateLimit');

function mockReq(overrides = {}) {
  return { headers: {}, ip: '127.0.0.1', ...overrides };
}

function mockRes() {
  const res = { _status: 200, _body: null };
  res.status = (s) => { res._status = s; return res; };
  res.json = (b) => { res._body = b; return res; };
  res.set = () => res;
  return res;
}

const SECRET = 'test-jwt-secret';
const PAYLOAD = { id: 'u1', email: 'a@test.com', role: 'user' };

describe('requireUser middleware', () => {
  it('calls next with valid JWT', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();
    requireUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@test.com', role: 'user' });
  });

  it('returns 401 with no auth header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    requireUser(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('returns 401 with invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer bad.token' } });
    const res = mockRes();
    const next = jest.fn();
    requireUser(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});

describe('requireAdmin middleware', () => {
  it('calls next for admin user', () => {
    const token = generateAccessToken({ ...PAYLOAD, role: 'admin' }, SECRET, '15m');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for non-admin user', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });
});

describe('optionalUser middleware', () => {
  it('sets req.user when valid token present', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();
    optionalUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1' });
  });

  it('still calls next with no token', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    optionalUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('still calls next with invalid token (no error thrown)', () => {
    const req = mockReq({ headers: { authorization: 'Bearer bad' } });
    const res = mockRes();
    const next = jest.fn();
    optionalUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('anyAuth middleware', () => {
  it('accepts valid JWT', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();
    anyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1' });
  });

  it('accepts valid static agent Bearer token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer test-bearer-token' } });
    const res = mockRes();
    const next = jest.fn();
    anyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer totally-wrong' } });
    const res = mockRes();
    const next = jest.fn();
    anyAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('rejects missing header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    anyAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});

describe('rateLimit middleware', () => {
  it('allows requests under the limit', () => {
    const req = mockReq({ ip: `ratelimit-test-${Date.now()}` });
    const res = mockRes();
    const next = jest.fn();
    rateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks requests over the limit', () => {
    const ip = `ratelimit-block-${Date.now()}`;
    const next = jest.fn();
    // Make 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const req = mockReq({ ip });
      const res = mockRes();
      rateLimit(req, res, next);
    }
    // 11th should be blocked
    const req = mockReq({ ip });
    const res = mockRes();
    const blockedNext = jest.fn();
    rateLimit(req, res, blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(res._status).toBe(429);
  });
});
