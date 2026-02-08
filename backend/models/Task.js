const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['queued', 'in_progress', 'done', 'blocked'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_AGENT_TYPES = ['main', 'subagent'];

function createTask({ title, description, details, status, priority, agentId, sessionKey, runId, progress, tags, metadata, agentType }) {
  return {
    id: uuidv4(),
    title: title || 'Untitled Task',
    description: description || '',
    details: details || '',
    status: VALID_STATUSES.includes(status) ? status : 'queued',
    priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
    agentId: agentId || null,
    sessionKey: sessionKey || null,
    runId: runId || null,
    agentType: VALID_AGENT_TYPES.includes(agentType) ? agentType : 'main',
    progress: typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0,
    tags: Array.isArray(tags) ? tags : [],
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseSessionKey(sessionKey) {
  if (!sessionKey || typeof sessionKey !== 'string') {
    return { isSubagent: false, agentId: null, subagentId: null };
  }
  const parts = sessionKey.split(':');
  if (parts[0] === 'agent' && parts[2] === 'subagent' && parts[3]) {
    return { isSubagent: true, agentId: parts[1], subagentId: parts[3] };
  }
  if (parts[0] === 'agent' && parts[1]) {
    return { isSubagent: false, agentId: parts[1], subagentId: null };
  }
  return { isSubagent: false, agentId: null, subagentId: null };
}

module.exports = { createTask, parseSessionKey, VALID_STATUSES, VALID_PRIORITIES, VALID_AGENT_TYPES };
