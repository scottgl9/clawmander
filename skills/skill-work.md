# Skill: Work Management

Manage action items (personal and work to-dos) and read the daily brief.

**Base URL**: `http://localhost:3001`
**Auth**: Write endpoints require `Authorization: Bearer <AUTH_TOKEN>`

---

## Action Items

Action items are personal or work to-dos shown on the dashboard.

**Priorities**: `low`, `medium`, `high`
**Categories**: `personal`, `work`

**Deduplication**: If `title` and `category` match an existing item, it is updated (200) instead of duplicated (201).

### Create Action Item

```
POST /api/work/action-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Review agent configs",
  "description": "Audit heartbeat intervals and reconnect policies.",
  "priority": "high",
  "category": "work"
}
```

### Read Action Items

```
GET /api/work/action-items                    # All items
GET /api/work/action-items?category=work      # Filter by category
GET /api/work/action-items/personal           # Personal only
GET /api/work/action-items/work               # Work only
GET /api/work/action-items/completed          # Done items only
```

### Update Action Item

```
PATCH /api/work/action-items/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "done": true }
```

### Delete Action Item

```
DELETE /api/work/action-items/:id
Authorization: Bearer <token>
```

---

## Daily Brief

Returns today's summary, priorities (with expandable details), and blockers.

```
GET /api/work/brief
```

Response:
```json
{
  "date": "2026-03-11",
  "summary": "Focus on agent monitoring and dashboard polish.",
  "priorities": [
    {
      "title": "Monitor OpenClaw agents",
      "details": "Check heartbeat status for all connected agents. Verify reconnect policies are working."
    }
  ],
  "blockers": []
}
```

---

## Example

```bash
BASE=http://localhost:3001
TOKEN=changeme

# Add a work to-do
curl -X POST $BASE/api/work/action-items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Review PR #42","description":"Check the auth middleware changes.","priority":"high","category":"work"}'

# Mark it done (use id from response)
curl -X PATCH $BASE/api/work/action-items/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# Read today's brief
curl $BASE/api/work/brief
```
