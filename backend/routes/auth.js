const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyToken, hashToken } = require('../utils/crypto');
const { requireUser } = require('../middleware/userAuth');
const rateLimit = require('../middleware/rateLimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!PASSWORD_RE.test(password)) return 'Password must contain uppercase, lowercase, number, and special character';
  return null;
}

function safeUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

module.exports = function authRoutes(authDB, config) {
  const router = express.Router();

  // POST /api/auth/register
  router.post('/register', rateLimit, async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' });
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });

      const existing = authDB.getUserByEmail(email.toLowerCase());
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await hashPassword(password);
      const user = authDB.createUser({ id: uuidv4(), email: email.toLowerCase(), passwordHash, name });
      res.status(201).json({ user: safeUser(user) });
    } catch (err) {
      console.error('[auth] register error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login
  router.post('/login', rateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const user = authDB.getUserByEmail(email.toLowerCase());
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      if (!user.is_active) return res.status(403).json({ error: 'Account is inactive' });

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      authDB.updateUser(user.id, { last_login: new Date().toISOString() });

      const payload = { id: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(payload, config.jwt.secret, config.jwt.expiry);
      const refreshToken = generateRefreshToken(payload, config.jwt.refreshSecret, config.jwt.refreshExpiry);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      authDB.storeRefreshToken({ id: uuidv4(), userId: user.id, tokenHash: hashToken(refreshToken), expiresAt });

      res.json({ user: safeUser(user), accessToken, refreshToken });
    } catch (err) {
      console.error('[auth] login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/refresh
  router.post('/refresh', rateLimit, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

      let payload;
      try {
        payload = verifyToken(refreshToken, config.jwt.refreshSecret);
      } catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const tokenHash = hashToken(refreshToken);
      const stored = authDB.getRefreshToken(tokenHash);
      if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Refresh token expired or revoked' });
      }
      if (!stored.is_active) return res.status(403).json({ error: 'Account is inactive' });

      const accessPayload = { id: payload.id, email: payload.email, role: payload.role };
      const accessToken = generateAccessToken(accessPayload, config.jwt.secret, config.jwt.expiry);
      res.json({ accessToken });
    } catch (err) {
      console.error('[auth] refresh error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const stored = authDB.getRefreshToken(tokenHash);
        if (stored) authDB.revokeUserTokens(stored.user_id);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[auth] logout error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me
  router.get('/me', requireUser, (req, res) => {
    const user = authDB.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  });

  // PUT /api/auth/me
  router.put('/me', requireUser, async (req, res) => {
    try {
      const { name, email } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) {
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' });
        const existing = authDB.getUserByEmail(email.toLowerCase());
        if (existing && existing.id !== req.user.id) return res.status(409).json({ error: 'Email already in use' });
        updates.email = email.toLowerCase();
      }
      const user = authDB.updateUser(req.user.id, updates);
      res.json({ user: safeUser(user) });
    } catch (err) {
      console.error('[auth] update profile error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/auth/me/password
  router.put('/me/password', requireUser, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });

      const user = authDB.getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const valid = await verifyPassword(currentPassword, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      const pwErr = validatePassword(newPassword);
      if (pwErr) return res.status(400).json({ error: pwErr });

      const passwordHash = await hashPassword(newPassword);
      authDB.updateUser(req.user.id, { password_hash: passwordHash });
      authDB.revokeUserTokens(req.user.id);

      res.json({ ok: true });
    } catch (err) {
      console.error('[auth] change password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
