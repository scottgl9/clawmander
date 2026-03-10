const PersonaSyncDB = require('../storage/PersonaSyncDB');

class PersonaSyncService {
  constructor() {
    this._db = new PersonaSyncDB();
    this.db = this._db.db;
  }

  // ── Sync helpers ──────────────────────────────────────────────────────────

  _upsert(table, columns, items) {
    const syncedAt = Date.now();
    const cols = [...columns, 'synced_at'];
    const placeholders = cols.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
    );
    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) {
        const values = columns.map((c) => row[c] ?? null);
        values.push(syncedAt);
        stmt.run(values);
      }
    });
    insertMany(items);
    return items.length;
  }

  syncSms(items) {
    return this._upsert('sms', ['id', 'address', 'body', 'date_ms', 'type', 'thread_id'], items);
  }

  syncCalendar(items) {
    return this._upsert('calendar_events', ['id', 'title', 'start_iso', 'end_iso', 'is_all_day', 'location', 'calendar_title'], items);
  }

  syncHealth(items) {
    return this._upsert('health_records', ['id', 'type', 'value', 'unit', 'start_iso', 'end_iso'], items);
  }

  syncLocations(items) {
    return this._upsert('locations', ['id', 'latitude', 'longitude', 'accuracy', 'altitude', 'speed', 'timestamp_ms'], items);
  }

  syncContacts(items) {
    return this._upsert('contacts', ['id', 'name', 'phone', 'email'], items);
  }

  syncCallLogs(items) {
    return this._upsert('call_logs', ['id', 'number', 'name', 'type', 'duration_s', 'date_ms'], items);
  }

  syncAppUsage(items) {
    return this._upsert('app_usage', ['id', 'package_name', 'app_name', 'total_foreground_ms', 'date'], items);
  }

  syncMedia(items) {
    return this._upsert('media', ['id', 'filename', 'date_ms', 'latitude', 'longitude', 'width', 'height', 'size_bytes', 'mime_type'], items);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  saveCommand(text, agentId = 'default') {
    const stmt = this.db.prepare('INSERT INTO commands (text, agent_id, received_at) VALUES (?, ?, ?)');
    return stmt.run(text, agentId, Date.now());
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  getSummary() {
    const todayStart = Math.floor(Date.now() / 86400000) * 86400000;

    const smsToday = this.db.prepare('SELECT COUNT(*) as n FROM sms WHERE date_ms > ?').get(todayStart).n;
    const calendarCount = this.db.prepare('SELECT COUNT(*) as n FROM calendar_events').get().n;
    const stepsRow = this.db.prepare("SELECT value FROM health_records WHERE type='steps' ORDER BY start_iso DESC LIMIT 1").get();
    const stepsToday = stepsRow ? Math.round(stepsRow.value) : 0;
    const locationCount = this.db.prepare('SELECT COUNT(*) as n FROM locations').get().n;
    const contactCount = this.db.prepare('SELECT COUNT(*) as n FROM contacts').get().n;
    const callsToday = this.db.prepare('SELECT COUNT(*) as n FROM call_logs WHERE date_ms > ?').get(todayStart).n;

    return {
      sms_today: smsToday,
      calendar_events: calendarCount,
      steps_today: stepsToday,
      location_points: locationCount,
      contacts: contactCount,
      calls_today: callsToday,
    };
  }

  getCounts() {
    const tables = ['sms', 'calendar_events', 'health_records', 'locations', 'contacts', 'call_logs', 'app_usage', 'media'];
    const counts = {};
    for (const table of tables) {
      counts[table] = this.db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get().n;
    }
    return counts;
  }

  querySms(limit = 50, offset = 0) {
    const cap = Math.min(limit, 500);
    return this.db.prepare(
      'SELECT id, address, body, date_ms, type, thread_id FROM sms ORDER BY date_ms DESC LIMIT ? OFFSET ?'
    ).all(cap, offset);
  }

  queryLocations(limit = 100, offset = 0) {
    const cap = Math.min(limit, 1000);
    return this.db.prepare(
      'SELECT id, latitude, longitude, accuracy, altitude, speed, timestamp_ms FROM locations ORDER BY timestamp_ms DESC LIMIT ? OFFSET ?'
    ).all(cap, offset);
  }

  queryHealth(type = null, limit = 100, offset = 0) {
    const cap = Math.min(limit, 1000);
    if (type) {
      return this.db.prepare(
        'SELECT id, type, value, unit, start_iso, end_iso FROM health_records WHERE type = ? ORDER BY start_iso DESC LIMIT ? OFFSET ?'
      ).all(type, cap, offset);
    }
    return this.db.prepare(
      'SELECT id, type, value, unit, start_iso, end_iso FROM health_records ORDER BY start_iso DESC LIMIT ? OFFSET ?'
    ).all(cap, offset);
  }
}

module.exports = PersonaSyncService;
