const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['queued', 'in_progress', 'done', 'blocked'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function createTask({ title, description, details, status, priority, agentId, sessionKey, runId, progress, tags, metadata }) {
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
    progress: typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0,
    tags: Array.isArray(tags) ? tags : [],
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { createTask, VALID_STATUSES, VALID_PRIORITIES };
