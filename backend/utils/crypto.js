const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

module.exports = {
  hashPassword: (password) => bcrypt.hash(password, SALT_ROUNDS),
  verifyPassword: (password, hash) => bcrypt.compare(password, hash),

  generateAccessToken: (payload, secret, expiry) =>
    jwt.sign(payload, secret, { expiresIn: expiry }),

  generateRefreshToken: (payload, secret, expiry) =>
    jwt.sign(payload, secret, { expiresIn: expiry }),

  verifyToken: (token, secret) => jwt.verify(token, secret),

  hashToken: (token) =>
    crypto.createHash('sha256').update(token).digest('hex'),
};
