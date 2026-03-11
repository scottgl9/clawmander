const config = require('../config/config');
const { verifyToken } = require('../utils/crypto');

// Tries JWT user auth first, falls back to Bearer token agent auth.
// Allows both logged-in users and OpenClaw agents to access write endpoints.
function anyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7);

  // Try JWT user auth first
  try {
    const payload = verifyToken(token, config.jwt.secret);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch {
    // Not a valid user JWT — fall through to agent token check
  }

  // Fall back to static agent Bearer token
  if (token === config.authToken) {
    return next();
  }

  return res.status(401).json({ error: 'Invalid or expired token' });
}

module.exports = anyAuth;
