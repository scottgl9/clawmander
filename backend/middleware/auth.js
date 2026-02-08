const config = require('../config/config');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  if (token !== config.authToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
}

module.exports = { requireAuth };
