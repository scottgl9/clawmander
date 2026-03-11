const { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyToken, hashToken } = require('../../backend/utils/crypto');

describe('crypto utils', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it correctly', async () => {
      const hash = await hashPassword('Test1234!');
      expect(hash).not.toBe('Test1234!');
      await expect(verifyPassword('Test1234!', hash)).resolves.toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('Test1234!');
      await expect(verifyPassword('Wrong1234!', hash)).resolves.toBe(false);
    });
  });

  describe('generateAccessToken / verifyToken', () => {
    const secret = 'test-secret';
    const payload = { id: 'user-1', email: 'test@test.com', role: 'user' };

    it('generates a verifiable token', () => {
      const token = generateAccessToken(payload, secret, '15m');
      const decoded = verifyToken(token, secret);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('throws on wrong secret', () => {
      const token = generateAccessToken(payload, secret, '15m');
      expect(() => verifyToken(token, 'wrong-secret')).toThrow();
    });

    it('throws on expired token', () => {
      const token = generateAccessToken(payload, secret, '0s');
      // Give it a moment to expire
      return new Promise((resolve) => setTimeout(resolve, 1100)).then(() => {
        expect(() => verifyToken(token, secret)).toThrow();
      });
    });
  });

  describe('generateRefreshToken / verifyToken', () => {
    it('generates a verifiable refresh token', () => {
      const token = generateRefreshToken({ id: 'u1' }, 'refresh-secret', '7d');
      const decoded = verifyToken(token, 'refresh-secret');
      expect(decoded.id).toBe('u1');
    });
  });

  describe('hashToken', () => {
    it('produces a consistent SHA-256 hex digest', () => {
      const h1 = hashToken('mytoken');
      const h2 = hashToken('mytoken');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });
});
