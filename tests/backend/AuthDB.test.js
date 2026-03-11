const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('../../backend/node_modules/better-sqlite3');

// Create an AuthDB-like class directly for testing (same logic, different file path)
class TestAuthDB {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        name TEXT, role TEXT DEFAULT 'user', is_active INTEGER DEFAULT 1,
        created_at TEXT, updated_at TEXT, last_login TEXT
      );
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL, revoked INTEGER DEFAULT 0, created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rt_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  }

  createUser({ id, email, passwordHash, name }) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO users (id,email,password_hash,name,role,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)').run(id, email, passwordHash, name || null, 'user', now, now);
    return this.getUserById(id);
  }
  getUserByEmail(email) { return this.db.prepare('SELECT * FROM users WHERE email=?').get(email); }
  getUserById(id) { return this.db.prepare('SELECT * FROM users WHERE id=?').get(id); }
  updateUser(id, fields) {
    const allowed = ['email', 'password_hash', 'name', 'role', 'is_active', 'last_login'];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return this.getUserById(id);
    const sets = entries.map(([k]) => `${k}=?`).join(', ');
    const vals = entries.map(([, v]) => v);
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE users SET ${sets}, updated_at=? WHERE id=?`).run(...vals, now, id);
    return this.getUserById(id);
  }
  storeRefreshToken({ id, userId, tokenHash, expiresAt }) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at,revoked,created_at) VALUES (?,?,?,?,0,?)').run(id, userId, tokenHash, expiresAt, now);
  }
  getRefreshToken(tokenHash) {
    return this.db.prepare('SELECT rt.*,u.email,u.role,u.is_active FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token_hash=?').get(tokenHash);
  }
  revokeUserTokens(userId) { this.db.prepare('UPDATE refresh_tokens SET revoked=1 WHERE user_id=?').run(userId); }
  cleanupExpiredTokens() {
    const now = new Date().toISOString();
    return this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at<? OR revoked=1').run(now).changes;
  }
}

describe('AuthDB', () => {
  let db;
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `authdb-test-${Date.now()}-${Math.random()}.db`);
    db = new TestAuthDB(tmpFile);
  });

  afterEach(() => {
    db.db.close();
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  describe('createUser / getUserByEmail / getUserById', () => {
    it('creates a user and retrieves by email and id', () => {
      const user = db.createUser({ id: 'u1', email: 'a@test.com', passwordHash: 'hash', name: 'Alice' });
      expect(user.id).toBe('u1');
      expect(user.email).toBe('a@test.com');
      expect(user.name).toBe('Alice');
      expect(user.role).toBe('user');
      expect(user.is_active).toBe(1);

      const byEmail = db.getUserByEmail('a@test.com');
      expect(byEmail.id).toBe('u1');

      const byId = db.getUserById('u1');
      expect(byId.email).toBe('a@test.com');
    });

    it('returns undefined for non-existent users', () => {
      expect(db.getUserByEmail('none@test.com')).toBeUndefined();
      expect(db.getUserById('nope')).toBeUndefined();
    });

    it('enforces unique email', () => {
      db.createUser({ id: 'u2', email: 'dup@test.com', passwordHash: 'h' });
      expect(() => db.createUser({ id: 'u3', email: 'dup@test.com', passwordHash: 'h' })).toThrow();
    });
  });

  describe('updateUser', () => {
    it('updates allowed fields', () => {
      db.createUser({ id: 'u4', email: 'b@test.com', passwordHash: 'h' });
      const updated = db.updateUser('u4', { name: 'Bob', last_login: '2026-01-01T00:00:00.000Z' });
      expect(updated.name).toBe('Bob');
      expect(updated.last_login).toBe('2026-01-01T00:00:00.000Z');
    });

    it('ignores unknown fields', () => {
      db.createUser({ id: 'u5', email: 'c@test.com', passwordHash: 'h' });
      const user = db.updateUser('u5', { unknown_field: 'value' });
      expect(user.id).toBe('u5');
    });
  });

  describe('refresh tokens', () => {
    beforeEach(() => {
      db.createUser({ id: 'u6', email: 'd@test.com', passwordHash: 'h' });
    });

    it('stores and retrieves a refresh token', () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      db.storeRefreshToken({ id: 'rt1', userId: 'u6', tokenHash: 'hash1', expiresAt });
      const t = db.getRefreshToken('hash1');
      expect(t).toBeTruthy();
      expect(t.user_id).toBe('u6');
      expect(t.revoked).toBe(0);
    });

    it('revokeUserTokens marks all tokens revoked', () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      db.storeRefreshToken({ id: 'rt2', userId: 'u6', tokenHash: 'hash2', expiresAt });
      db.revokeUserTokens('u6');
      const t = db.getRefreshToken('hash2');
      expect(t.revoked).toBe(1);
    });

    it('cleanupExpiredTokens removes revoked tokens', () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      db.storeRefreshToken({ id: 'rt3', userId: 'u6', tokenHash: 'hash3', expiresAt });
      db.revokeUserTokens('u6');
      const deleted = db.cleanupExpiredTokens();
      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(db.getRefreshToken('hash3')).toBeUndefined();
    });

    it('cleanupExpiredTokens removes expired tokens', () => {
      const expiredAt = new Date(Date.now() - 1000).toISOString();
      db.storeRefreshToken({ id: 'rt4', userId: 'u6', tokenHash: 'hash4', expiresAt: expiredAt });
      const deleted = db.cleanupExpiredTokens();
      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });
});
