const FileStore = require('../storage/FileStore');
const { createDrawing } = require('../models/Drawing');

class DrawingService {
  constructor(sseManager) {
    this.store = new FileStore('drawings.json');
    this.sse = sseManager;
  }

  getAll() {
    return this.store.read().map(({ id, title, createdAt, updatedAt }) => ({
      id, title, createdAt, updatedAt,
    }));
  }

  getById(id) {
    return this.store.findById(id);
  }

  create(data) {
    const drawing = createDrawing(data);
    this.store.insert(drawing);
    this.sse.broadcast('drawing.created', { id: drawing.id, title: drawing.title, createdAt: drawing.createdAt, updatedAt: drawing.updatedAt });
    return drawing;
  }

  update(id, updates) {
    const drawing = this.store.update(id, updates);
    if (drawing) {
      this.sse.broadcast('drawing.updated', { id: drawing.id, title: drawing.title, updatedAt: drawing.updatedAt });
    }
    return drawing;
  }

  delete(id) {
    const removed = this.store.remove(id);
    if (removed) {
      this.sse.broadcast('drawing.deleted', { id });
    }
    return removed;
  }
}

module.exports = DrawingService;
