const { v4: uuidv4 } = require('uuid');

function createDrawing({ title, data }) {
  return {
    id: uuidv4(),
    title: title || 'Untitled Drawing',
    data: data || { elements: [], appState: { viewBackgroundColor: '#1e1e1e' }, files: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { createDrawing };
