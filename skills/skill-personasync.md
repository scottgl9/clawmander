# Skill: PersonaSync (Phone Data)

Sync phone data from the PersonaSync Android app and query it for agent use. Data is stored in a SQLite database at `backend/storage/data/personasync.db`.

**Base URL**: `http://localhost:3001`
**Auth**: Sync (write) endpoints require `Authorization: Bearer <AUTH_TOKEN>`. Query (read) endpoints are open.

---

## Sync Endpoints

All sync endpoints accept a JSON **array** of records and upsert by `id` (INSERT OR REPLACE).

Response format: `{ "count": N, "status": "ok" }`

### Sync SMS

```
POST /api/sync/sms
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "sms-1001",
    "address": "+15125550100",
    "body": "Hey, are you free tonight?",
    "date_ms": 1741564800000,
    "type": 1,
    "thread_id": 42
  }
]
```

`type`: `1` = received, `2` = sent

### Sync Calendar Events

```
POST /api/sync/calendar
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "cal-event-999",
    "title": "Team standup",
    "start_iso": "2026-03-11T09:00:00Z",
    "end_iso": "2026-03-11T09:30:00Z",
    "is_all_day": 0,
    "location": "Zoom",
    "calendar_title": "Work"
  }
]
```

### Sync Health Records

```
POST /api/sync/health
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "health-steps-20260310",
    "type": "steps",
    "value": 8432,
    "unit": "count",
    "start_iso": "2026-03-10T00:00:00Z",
    "end_iso": "2026-03-10T23:59:59Z"
  }
]
```

Valid `type` values: `steps`, `heart_rate`, `sleep`, `calories` (and any custom string)

### Sync Location Points

```
POST /api/sync/location
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "loc-1741564800",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "accuracy": 10.5,
    "altitude": 149.0,
    "speed": 0.0,
    "timestamp_ms": 1741564800000
  }
]
```

### Sync Contacts

```
POST /api/sync/contacts
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "contact-abc123",
    "name": "Jane Smith",
    "phone": "+15125550199",
    "email": "jane@example.com"
  }
]
```

### Sync Call Logs

```
POST /api/sync/call-logs
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "call-20260310-001",
    "number": "+15125550100",
    "name": "Jane Smith",
    "type": 1,
    "duration_s": 183,
    "date_ms": 1741564800000
  }
]
```

`type`: `1` = incoming, `2` = outgoing, `3` = missed

### Sync App Usage

```
POST /api/sync/app-usage
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "usage-com.instagram.android-20260310",
    "package_name": "com.instagram.android",
    "app_name": "Instagram",
    "total_foreground_ms": 3600000,
    "date": "2026-03-10"
  }
]
```

### Sync Media Metadata

```
POST /api/sync/media
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "id": "media-img-20260310-001",
    "filename": "IMG_20260310_143000.jpg",
    "date_ms": 1741564800000,
    "latitude": 30.2672,
    "longitude": -97.7431,
    "width": 4032,
    "height": 3024,
    "size_bytes": 3145728,
    "mime_type": "image/jpeg"
  }
]
```

`latitude` and `longitude` are optional (null if no location tag).

---

## Query Endpoints

### Today's Summary

```
GET /api/query/summary
```

Response:
```json
{
  "sms_today": 14,
  "calendar_events": 3,
  "steps_today": 8432,
  "location_points": 287,
  "contacts": 312,
  "calls_today": 5
}
```

### Row Counts

```
GET /api/query/counts
```

Response:
```json
{
  "sms": 4821,
  "calendar_events": 156,
  "health_records": 930,
  "locations": 18402,
  "contacts": 312,
  "call_logs": 2107,
  "app_usage": 845,
  "media": 6310
}
```

### Paginated SMS

```
GET /api/query/sms?limit=50&offset=0
```

Max `limit`: 500. Sorted by `date_ms` DESC.

### Paginated Locations

```
GET /api/query/locations?limit=100&offset=0
```

Max `limit`: 1000. Sorted by `timestamp_ms` DESC.

### Paginated Health Records

```
GET /api/query/health?type=steps&limit=100&offset=0
```

`type` is optional — omit to return all types. Max `limit`: 1000. Sorted by `start_iso` DESC.

---

## Example: Sync & Query

```bash
BASE=http://localhost:3001
TOKEN=changeme

# Sync today's steps
curl -X POST $BASE/api/sync/health \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id":"steps-20260311","type":"steps","value":6200,"unit":"count","start_iso":"2026-03-11T00:00:00Z","end_iso":"2026-03-11T23:59:59Z"}]'

# Check today's summary
curl $BASE/api/query/summary

# Get recent SMS (50 newest)
curl "$BASE/api/query/sms?limit=50"

# Get recent locations
curl "$BASE/api/query/locations?limit=100"
```
