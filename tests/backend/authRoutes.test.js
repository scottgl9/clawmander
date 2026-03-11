// Mock config BEFORE requiring anything that loads config
jest.mock('../../backend/config/config', () => ({
  authToken: 'test-bearer-token',
  jwt: {
    secret: 'test-jwt-secret',
    refreshSecret: 'test-refresh-secret',
    expiry: '15m',
    refreshExpiry: '7d',
  },
}));

// Bypass rate limiting in route tests
jest.mock('../../backend/middleware/rateLimit', () => (req, res, next) => next());

const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const authRoutes = require('../../backend/routes/auth');
const { hashPassword, generateAccessToken, hashToken } = require('../../backend/utils/crypto');

const TEST_CONFIG = require('../../backend/config/config');

// In-memory mock of AuthDB for route tests
function createMockAuthDB() {
  const users = new Map();
  const tokens = new Map();

  return {
    _users: users,
    _tokens: tokens,
    createUser({ id, email, passwordHash, name }) {
      const now = new Date().toISOString();
      const user = { id, email, password_hash: passwordHash, name: name || null, role: 'user', is_active: 1, created_at: now, updated_at: now, last_login: null };
      users.set(id, user);
      return { ...user };
    },
    getUserByEmail(email) { return [...users.values()].find((u) => u.email === email); },
    getUserById(id) { const u = users.get(id); return u ? { ...u } : undefined; },
    updateUser(id, fields) {
      const u = users.get(id);
      if (!u) return undefined;
      Object.assign(u, fields, { updated_at: new Date().toISOString() });
      return { ...u };
    },
    storeRefreshToken({ id, userId, tokenHash, expiresAt }) {
      tokens.set(tokenHash, { id, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, revoked: 0 });
    },
    getRefreshToken(tokenHash) {
      const t = tokens.get(tokenHash);
      if (!t) return undefined;
      const u = users.get(t.user_id);
      return u ? { ...t, email: u.email, role: u.role, is_active: u.is_active, name: u.name } : undefined;
    },
    revokeUserTokens(userId) {
      for (const [k, t] of tokens.entries()) {
        if (t.user_id === userId) tokens.set(k, { ...t, revoked: 1 });
      }
    },
    cleanupExpiredTokens() { return 0; },
  };
}

function createApp(authDB) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes(authDB, TEST_CONFIG));
  return app;
}

function makeRequest(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const bodyStr = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        'Content-Type': 'application/json',
        ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      };
      const options = { hostname: '127.0.0.1', port, path, method, headers: reqHeaders };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close();
          try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}

describe('auth routes', () => {
  let authDB;
  let app;

  beforeEach(() => {
    authDB = createMockAuthDB();
    app = createApp(authDB);
  });

  describe('POST /api/auth/register', () => {
    it('creates a user with valid input', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/register', {
        email: 'alice@test.com', password: 'Test1234!', name: 'Alice',
      });
      expect(r.status).toBe(201);
      expect(r.body.user.email).toBe('alice@test.com');
      expect(r.body.user.name).toBe('Alice');
      expect(r.body.user.password_hash).toBeUndefined();
    });

    it('rejects invalid email', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/register', { email: 'bad', password: 'Test1234!' });
      expect(r.status).toBe(400);
    });

    it('rejects weak password', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/register', { email: 'a@b.com', password: 'password' });
      expect(r.status).toBe(400);
    });

    it('rejects duplicate email', async () => {
      await makeRequest(app, 'POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
      const r2 = await makeRequest(app, 'POST', '/api/auth/register', { email: 'dup@test.com', password: 'Test1234!' });
      expect(r2.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'alice@test.com', passwordHash: hash, name: 'Alice' });
    });

    it('returns tokens on valid credentials', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'alice@test.com', password: 'Test1234!' });
      expect(r.status).toBe(200);
      expect(r.body.accessToken).toBeTruthy();
      expect(r.body.refreshToken).toBeTruthy();
      expect(r.body.user.email).toBe('alice@test.com');
      expect(r.body.user.password_hash).toBeUndefined();
    });

    it('rejects wrong password', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'alice@test.com', password: 'Wrong1234!' });
      expect(r.status).toBe(401);
    });

    it('rejects unknown email', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'nobody@test.com', password: 'Test1234!' });
      expect(r.status).toBe(401);
    });

    it('rejects inactive user', async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u2', email: 'inactive@test.com', passwordHash: hash });
      authDB.updateUser('u2', { is_active: 0 });
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'inactive@test.com', password: 'Test1234!' });
      expect(r.status).toBe(403);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'alice@test.com', passwordHash: hash });
      // Do a login to get tokens
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'alice@test.com', password: 'Test1234!' });
      refreshToken = r.body.refreshToken;
    });

    it('returns a new access token', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/refresh', { refreshToken });
      expect(r.status).toBe(200);
      expect(r.body.accessToken).toBeTruthy();
    });

    it('rejects invalid refresh token', async () => {
      const r = await makeRequest(app, 'POST', '/api/auth/refresh', { refreshToken: 'garbage' });
      expect(r.status).toBe(401);
    });

    it('rejects revoked refresh token', async () => {
      authDB.revokeUserTokens('u1');
      const r = await makeRequest(app, 'POST', '/api/auth/refresh', { refreshToken });
      expect(r.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns ok and revokes tokens', async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'a@test.com', passwordHash: hash });
      const loginRes = await makeRequest(app, 'POST', '/api/auth/login', { email: 'a@test.com', password: 'Test1234!' });
      const { refreshToken } = loginRes.body;

      const r = await makeRequest(app, 'POST', '/api/auth/logout', { refreshToken });
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);

      // Refresh should now fail
      const r2 = await makeRequest(app, 'POST', '/api/auth/refresh', { refreshToken });
      expect(r2.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'a@test.com', passwordHash: hash, name: 'Test' });
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'a@test.com', password: 'Test1234!' });
      accessToken = r.body.accessToken;
    });

    it('returns profile with valid token', async () => {
      const r = await makeRequest(app, 'GET', '/api/auth/me', null, { Authorization: `Bearer ${accessToken}` });
      expect(r.status).toBe(200);
      expect(r.body.user.email).toBe('a@test.com');
      expect(r.body.user.password_hash).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const r = await makeRequest(app, 'GET', '/api/auth/me', null);
      expect(r.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const r = await makeRequest(app, 'GET', '/api/auth/me', null, { Authorization: 'Bearer bad.token.here' });
      expect(r.status).toBe(401);
    });
  });

  describe('PUT /api/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'a@test.com', passwordHash: hash, name: 'Alice' });
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'a@test.com', password: 'Test1234!' });
      accessToken = r.body.accessToken;
    });

    it('updates name', async () => {
      const r = await makeRequest(app, 'PUT', '/api/auth/me', { name: 'Bob' }, { Authorization: `Bearer ${accessToken}` });
      expect(r.status).toBe(200);
      expect(r.body.user.name).toBe('Bob');
    });
  });

  describe('PUT /api/auth/me/password', () => {
    let accessToken;

    beforeEach(async () => {
      const hash = await hashPassword('Test1234!');
      authDB.createUser({ id: 'u1', email: 'a@test.com', passwordHash: hash });
      const r = await makeRequest(app, 'POST', '/api/auth/login', { email: 'a@test.com', password: 'Test1234!' });
      accessToken = r.body.accessToken;
    });

    it('changes password with correct current password', async () => {
      const r = await makeRequest(app, 'PUT', '/api/auth/me/password',
        { currentPassword: 'Test1234!', newPassword: 'New1234!@' },
        { Authorization: `Bearer ${accessToken}` }
      );
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
    });

    it('rejects wrong current password', async () => {
      const r = await makeRequest(app, 'PUT', '/api/auth/me/password',
        { currentPassword: 'Wrong1234!', newPassword: 'New1234!@' },
        { Authorization: `Bearer ${accessToken}` }
      );
      expect(r.status).toBe(401);
    });

    it('rejects weak new password', async () => {
      const r = await makeRequest(app, 'PUT', '/api/auth/me/password',
        { currentPassword: 'Test1234!', newPassword: 'weak' },
        { Authorization: `Bearer ${accessToken}` }
      );
      expect(r.status).toBe(400);
    });
  });
});
