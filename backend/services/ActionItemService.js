const FileStore = require('../storage/FileStore');
const { createActionItem } = require('../models/ActionItem');

class ActionItemService {
  constructor(sseManager) {
    this.store = new FileStore('action-items.json');
    this.sse = sseManager;
  }

  getAll(category) {
    if (category) {
      return this.store.findAll((item) => item.category === category);
    }
    return this.store.read();
  }

  getPersonal() {
    return this.getAll('personal');
  }

  getWork() {
    return this.getAll('work');
  }

  getById(id) {
    return this.store.findById(id);
  }

  create(data) {
    const item = createActionItem(data);
    this.store.insert(item);
    this.sse.broadcast('actionitem.created', item);
    return item;
  }

  update(id, updates) {
    const item = this.store.update(id, updates);
    if (item) {
      this.sse.broadcast('actionitem.updated', item);
    }
    return item;
  }

  delete(id) {
    const removed = this.store.remove(id);
    if (removed) {
      this.sse.broadcast('actionitem.deleted', { id });
    }
    return removed;
  }
}

module.exports = ActionItemService;
