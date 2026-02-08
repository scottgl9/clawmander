const { v4: uuidv4 } = require('uuid');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_CATEGORIES = ['personal', 'work'];

function createActionItem({ title, description, priority, done, category, metadata }) {
  return {
    id: uuidv4(),
    title: title || 'Untitled',
    description: description || '',
    priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
    done: typeof done === 'boolean' ? done : false,
    category: VALID_CATEGORIES.includes(category) ? category : 'personal',
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { createActionItem, VALID_PRIORITIES, VALID_CATEGORIES };
