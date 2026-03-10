require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  authToken: process.env.AUTH_TOKEN || 'changeme',
  testMode: process.env.TEST_MODE === 'true',
  openClaw: {
    wsUrl: process.env.OPENCLAW_WS_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_TOKEN || '',
  },
};
