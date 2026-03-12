const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  authToken: process.env.AUTH_TOKEN || 'changeme',
  testMode: process.env.TEST_MODE === 'true',
  openClawHome: process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw'),
  openClaw: {
    wsUrl: process.env.OPENCLAW_WS_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_TOKEN || '',
  },
  chatterbox: {
    url: process.env.CHATTERBOX_URL || 'http://localhost:8400',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  browser: {
    maxInstances: parseInt(process.env.BROWSER_MAX_INSTANCES || '5', 10),
    idleTimeoutMs: parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS || '1800000', 10),
    profileDir: process.env.BROWSER_PROFILE_DIR || path.join(os.homedir(), '.openclaw', 'browser-profiles'),
    viewport: { width: 1280, height: 800 },
    screencast: { format: 'jpeg', quality: 60 },
  },
};
