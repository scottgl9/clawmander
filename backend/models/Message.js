const Database = require('better-sqlite3');
const path = require('path');
const { getDataDir } = require('../storage/dataDir');

class Message {
  constructor() {
    const dataDir = getDataDir();
    this.db = new Database(path.join(dataDir, 'messages.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        sender TEXT,
        recipient TEXT,
        body TEXT,
        subject TEXT,
        size INTEGER,
        content_class TEXT,
        sim_number INTEGER,
        received_at DATETIME,
        stored_at DATETIME DEFAULT (datetime('now')),
        raw_payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
    `);

    // Add columns introduced for mms:downloaded support (safe to re-run)
    const newCols = [
      ['body_downloaded', 'TEXT'],
      ['parts', 'TEXT'],
      ['downloaded_at', 'DATETIME'],
    ];
    for (const [col, type] of newCols) {
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
      } catch (_) { /* column already exists */ }
    }
  }

  upsert(msg) {
    const existing = this.db.prepare('SELECT id FROM messages WHERE id = ?').get(msg.id);
    if (existing) {
      return { inserted: false, id: msg.id };
    }
    this.db.prepare(`
      INSERT INTO messages (id, type, sender, recipient, body, subject, size, content_class, sim_number, received_at, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id, msg.type, msg.sender || null, msg.recipient || null,
      msg.body || null, msg.subject || null, msg.size || null,
      msg.content_class || null, msg.sim_number || null,
      msg.received_at || null, msg.raw_payload || null
    );
    return { inserted: true, id: msg.id };
  }

  list({ since, limit = 50, contact, type } = {}) {
    const conditions = [];
    const params = [];

    if (since) {
      conditions.push('received_at >= ?');
      params.push(since);
    }
    if (contact) {
      conditions.push('(sender = ? OR recipient = ?)');
      params.push(contact, contact);
    }
    if (type && type !== 'all') {
      conditions.push('type = ?');
      params.push(type);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `SELECT * FROM messages ${where} ORDER BY received_at DESC LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) || null;
  }

  updateMmsDownloaded(transactionId, { body, parts, downloadedAt, rawPayload }) {
    const candidate = this.db.prepare(`
      SELECT id, json_extract(raw_payload, '$.payload.transactionId') AS stored_transaction_id,
             json_extract(raw_payload, '$.payload.messageId') AS stored_message_id
      FROM messages
      WHERE type = 'mms' AND (
        id = ?
        OR json_extract(raw_payload, '$.payload.transactionId') = ?
        OR json_extract(raw_payload, '$.payload.messageId') = ?
      )
      ORDER BY received_at DESC
      LIMIT 1
    `).get(transactionId, transactionId, transactionId);

    if (!candidate) {
      return { updated: false, reason: 'no_match', transactionId };
    }

    const stmt = this.db.prepare(`
      UPDATE messages SET body_downloaded=?, parts=?, downloaded_at=?, raw_payload=?
      WHERE id=?
    `);
    const mergedPayload = rawPayload || this.getById(candidate.id)?.raw_payload || null;
    const result = stmt.run(body, parts, downloadedAt, mergedPayload, candidate.id);
    return {
      updated: result.changes > 0,
      matchedId: candidate.id,
      storedTransactionId: candidate.stored_transaction_id,
      storedMessageId: candidate.stored_message_id,
    };
  }

  count() {
    return this.db.prepare('SELECT COUNT(*) AS cnt FROM messages').get().cnt;
  }
}

module.exports = Message;
