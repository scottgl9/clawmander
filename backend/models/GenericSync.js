const Database = require('better-sqlite3');
const path = require('path');
const { getDataDir } = require('../storage/dataDir');

class GenericSync {
  constructor() {
    const dataDir = getDataDir();
    this.db = new Database(path.join(dataDir, 'sync.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_data (
        type TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        synced_at DATETIME DEFAULT (datetime('now')),
        PRIMARY KEY (type, id)
      );
    `);
  }

  upsert(type, items) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_data (type, id, data, synced_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    let count = 0;
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        const id = item.id || item._id || require('crypto').randomUUID();
        stmt.run(type, id, JSON.stringify(item));
        count++;
      }
    });
    
    transaction(items);
    return count;
  }
}

module.exports = GenericSync;
