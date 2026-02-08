const { v4: uuidv4 } = require('uuid');

function createActivityLog({ type, action, agentId, metadata }) {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type: type || 'system',
    action: action || '',
    agentId: agentId || null,
    metadata: metadata || {},
  };
}

module.exports = { createActivityLog };
