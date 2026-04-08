const Database = require('better-sqlite3');
const path = require('path');
const { getDataDir } = require('./dataDir');

class AuthDB {
  constructor() {
    const dataDir = getDataDir();
    this.db = new Database(path.join(dataDir, 'auth.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        last_login TEXT
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER DEFAULT 0,
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  }

  createUser({ id, email, passwordHash, name }) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 1, ?, ?)
    `).run(id, email, passwordHash, name || null, now, now);
    return this.getUserById(id);
  }

  getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  getUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  updateUser(id, fields) {
    const allowed = ['email', 'password_hash', 'name', 'role', 'is_active', 'last_login'];
    const updates = Object.entries(fields)
      .filter(([k]) => allowed.includes(k))
      .map(([k]) => `${k} = ?`);
    if (updates.length === 0) return this.getUserById(id);
    const values = Object.entries(fields)
      .filter(([k]) => allowed.includes(k))
      .map(([, v]) => v);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users SET ${updates.join(', ')}, updated_at = ? WHERE id = ?
    `).run(...values, now, id);
    return this.getUserById(id);
  }

  storeRefreshToken({ id, userId, tokenHash, expiresAt }) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(id, userId, tokenHash, expiresAt, now);
  }

  getRefreshToken(tokenHash) {
    return this.db.prepare(`
      SELECT rt.*, u.email, u.role, u.is_active, u.name
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ?
    `).get(tokenHash);
  }

  revokeUserTokens(userId) {
    this.db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
  }

  cleanupExpiredTokens() {
    const now = new Date().toISOString();
    const result = this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1').run(now);
    return result.changes;
  }
}

module.exports = AuthDB;
