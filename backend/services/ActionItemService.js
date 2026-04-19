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

  upsert(data) {
    const { title, category } = data;
    if (title && category) {
      const existing = this.store.findBy(
        (item) => item.title === title && item.category === category
      );
      if (existing) {
        const { id, createdAt, ...rest } = data;
        const updated = this.store.update(existing.id, rest);
        if (updated) this.sse.broadcast('actionitem.updated', updated);
        return { item: updated, created: false };
      }
    }
    const item = this.create(data);
    return { item, created: true };
  }

  delete(id) {
    const removed = this.store.remove(id);
    if (removed) {
      this.sse.broadcast('actionitem.deleted', { id });
    }
    return removed;
  }

  deleteByCategory(category) {
    const items = this.getAll(category);
    let removedCount = 0;
    for (const item of items) {
      const removed = this.store.remove(item.id);
      if (removed) {
        removedCount += 1;
        this.sse.broadcast('actionitem.deleted', { id: item.id });
      }
    }
    return { success: true, removedCount, category };
  }
}

module.exports = ActionItemService;
