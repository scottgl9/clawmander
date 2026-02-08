const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['idle', 'active', 'offline', 'error'];

function createAgent({ id, name, status, currentTask, heartbeatInterval, metadata }) {
  const now = new Date().toISOString();
  return {
    id: id || uuidv4(),
    name: name || 'Unknown Agent',
    status: VALID_STATUSES.includes(status) ? status : 'offline',
    currentTask: currentTask || null,
    lastHeartbeat: now,
    nextHeartbeat: null,
    heartbeatInterval: heartbeatInterval || 300,
    metadata: metadata || {},
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { createAgent, VALID_STATUSES };
