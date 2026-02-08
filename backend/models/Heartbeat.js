const { v4: uuidv4 } = require('uuid');

function createHeartbeat({ agentId, status, message, systemHealth, tasks }) {
  return {
    id: uuidv4(),
    agentId,
    timestamp: new Date().toISOString(),
    status: status || 'HEARTBEAT_OK',
    message: message || '',
    systemHealth: systemHealth || {},
    tasks: tasks || [],
  };
}

module.exports = { createHeartbeat };
