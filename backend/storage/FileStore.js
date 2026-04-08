const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./dataDir');

class FileStore {
  constructor(filename) {
    this.filename = filename;
    this.cache = null;
  }

  get filepath() {
    return path.join(getDataDir(), this.filename);
  }

  _ensureDir() {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  read() {
    if (this.cache !== null) return this.cache;
    this._ensureDir();
    if (!fs.existsSync(this.filepath)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const raw = fs.readFileSync(this.filepath, 'utf-8');
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  write(data) {
    this._ensureDir();
    this.cache = data;
    fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
  }

  findById(id) {
    return this.read().find((item) => item.id === id);
  }

  insert(item) {
    const data = this.read();
    data.push(item);
    this.write(data);
    return item;
  }

  update(id, updates) {
    const data = this.read();
    const idx = data.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
    this.write(data);
    return data[idx];
  }

  remove(id) {
    const data = this.read();
    const idx = data.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    data.splice(idx, 1);
    this.write(data);
    return true;
  }

  findBy(predicate) {
    return this.read().find(predicate) || null;
  }

  findAll(filterFn) {
    const data = this.read();
    return filterFn ? data.filter(filterFn) : data;
  }
}

module.exports = FileStore;
