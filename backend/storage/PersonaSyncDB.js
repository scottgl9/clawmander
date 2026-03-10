const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');

class PersonaSyncDB {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(path.join(DATA_DIR, 'personasync.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sms (
        id TEXT PRIMARY KEY,
        address TEXT,
        body TEXT,
        date_ms INTEGER,
        type INTEGER,
        thread_id INTEGER,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT,
        start_iso TEXT,
        end_iso TEXT,
        is_all_day INTEGER,
        location TEXT,
        calendar_title TEXT,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS health_records (
        id TEXT PRIMARY KEY,
        type TEXT,
        value REAL,
        unit TEXT,
        start_iso TEXT,
        end_iso TEXT,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        altitude REAL,
        speed REAL,
        timestamp_ms INTEGER,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        number TEXT,
        name TEXT,
        type INTEGER,
        duration_s INTEGER,
        date_ms INTEGER,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS app_usage (
        id TEXT PRIMARY KEY,
        package_name TEXT,
        app_name TEXT,
        total_foreground_ms INTEGER,
        date TEXT,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        filename TEXT,
        date_ms INTEGER,
        latitude REAL,
        longitude REAL,
        width INTEGER,
        height INTEGER,
        size_bytes INTEGER,
        mime_type TEXT,
        synced_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        agent_id TEXT,
        received_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_sms_date ON sms(date_ms);
      CREATE INDEX IF NOT EXISTS idx_sms_address ON sms(address);
      CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_iso);
      CREATE INDEX IF NOT EXISTS idx_health_type ON health_records(type);
      CREATE INDEX IF NOT EXISTS idx_health_start ON health_records(start_iso);
      CREATE INDEX IF NOT EXISTS idx_locations_ts ON locations(timestamp_ms);
      CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs(date_ms);
      CREATE INDEX IF NOT EXISTS idx_call_logs_number ON call_logs(number);
      CREATE INDEX IF NOT EXISTS idx_app_usage_pkg ON app_usage(package_name);
      CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);
      CREATE INDEX IF NOT EXISTS idx_media_date ON media(date_ms);
    `);
  }
}

module.exports = PersonaSyncDB;
