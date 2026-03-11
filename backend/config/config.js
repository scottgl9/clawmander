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
};
