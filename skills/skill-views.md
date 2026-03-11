# Skill: Dashboard Views & Activity Log

Read aggregated dashboard views and log/query activity events.

**Base URL**: `http://localhost:3001`

---

## Aggregated Views

Pre-built time-based views combining tasks, agents, and stats. Tasks include the `details` field — the dashboard renders them as expandable items.

### Daily View

```
GET /api/views/daily
```

Response:
```json
{
  "date": "2026-03-11",
  "tasks": [{ "id": "...", "title": "...", "details": "...", "status": "in_progress" }],
  "agents": [{ "id": "my-agent", "status": "active" }],
  "stats": { "byStatus": { "queued": 1, "in_progress": 2, "done": 3 }, "total": 6 }
}
```

### Weekly View

```
GET /api/views/weekly
```

Response includes `startDate`, `endDate`, `tasks`, `agents`, `stats`, `completedThisWeek`.

### Monthly View

```
GET /api/views/monthly
```

Response includes `month`, `tasks`, `agents`, `stats`, `completedThisMonth`.

---

## Activity Log

Records of API calls and agent events for audit/observability.

### Get Activity Log

```
GET /api/activity/log?limit=50&offset=0&type=agent
```

Query params: `limit`, `offset`, `type` (`api`, `agent`, or omit for all)

Response:
```json
{
  "total": 150,
  "offset": 0,
  "limit": 50,
  "items": [
    {
      "id": "uuid",
      "timestamp": "2026-03-11T12:00:00Z",
      "type": "agent",
      "action": "Agent started processing queue",
      "agentId": "my-agent",
      "metadata": { "queueSize": 5 }
    }
  ]
}
```

### Log an Activity Entry

```
POST /api/activity/log
Content-Type: application/json

{
  "type": "agent",
  "action": "Agent started processing queue",
  "agentId": "my-agent",
  "metadata": { "queueSize": 5 }
}
```

Response `201`: activity log entry.
