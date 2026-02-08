# Clawmander API Specification

Base URL: `http://localhost:3001`

## Authentication

Write endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <AUTH_TOKEN>
```

The token is configured via the `AUTH_TOKEN` environment variable in the backend `.env` file.

Read endpoints (`GET`) do not require authentication.

---

## Endpoints

### Tasks

#### Create Task
```
POST /api/agents/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "whatsapp-agent",
  "task": {
    "title": "Process incoming messages",
    "description": "Handle 5 pending WhatsApp messages",
    "status": "queued",
    "priority": "high",
    "sessionKey": "session-abc123",
    "runId": "run-001",
    "progress": 0,
    "tags": ["messaging", "whatsapp"],
    "metadata": {}
  }
}

Response 201:
{
  "id": "uuid",
  "title": "Process incoming messages",
  "description": "Handle 5 pending WhatsApp messages",
  "status": "queued",
  "priority": "high",
  "agentId": "whatsapp-agent",
  "sessionKey": "session-abc123",
  "runId": "run-001",
  "progress": 0,
  "tags": ["messaging", "whatsapp"],
  "metadata": {},
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### Update Task
```
PATCH /api/tasks/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",
  "progress": 50
}

Response 200: <updated task object>
```

#### Delete Task
```
DELETE /api/tasks/:taskId
Authorization: Bearer <token>

Response 200: { "success": true }
```

#### Get All Tasks
```
GET /api/tasks?status=in_progress&agentId=whatsapp-agent

Response 200: [<task objects>]
```

#### Get Task Stats
```
GET /api/tasks/stats

Response 200:
{
  "total": 10,
  "byStatus": { "queued": 3, "in_progress": 2, "done": 4, "blocked": 1 },
  "byPriority": { "low": 1, "medium": 4, "high": 3, "critical": 2 }
}
```

#### Get Single Task
```
GET /api/tasks/:taskId

Response 200: <task object>
```

### Task Status Flow

```
queued --> in_progress --> done
  |            |
  v            v
blocked --> in_progress
```

Valid statuses: `queued`, `in_progress`, `done`, `blocked`
Valid priorities: `low`, `medium`, `high`, `critical`

---

### Agents

#### Update Agent Status
```
POST /api/agents/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "whatsapp-agent",
  "name": "WhatsApp Agent",
  "status": "active",
  "metadata": { "version": "2.1" }
}

Response 200: <agent object>
```

Agent statuses: `idle`, `active`, `offline`, `error`

#### Get All Agent Statuses
```
GET /api/agents/status

Response 200: [<agent objects>]
```

#### Get Heartbeat Timings
```
GET /api/agents/heartbeat

Response 200:
[
  {
    "agentId": "whatsapp-agent",
    "agentName": "WhatsApp Agent",
    "lastHeartbeat": "2025-01-01T00:00:00.000Z",
    "nextHeartbeat": "2025-01-01T00:05:00.000Z",
    "secondsUntilNext": 280,
    "overdue": false,
    "heartbeatInterval": 300
  }
]
```

---

### Heartbeat Protocol

Agents should send heartbeats at their configured interval (default: 300 seconds).

```
POST /api/agents/heartbeat
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "whatsapp-agent",
  "agentName": "WhatsApp Agent",
  "status": "HEARTBEAT_OK",
  "message": "All systems nominal",
  "heartbeatInterval": 300,
  "systemHealth": {
    "memoryUsage": 45,
    "cpuUsage": 12,
    "uptime": 86400
  },
  "tasks": [
    { "taskId": "uuid", "status": "in_progress", "progress": 75 }
  ]
}

Response 200: <heartbeat object>
```

Heartbeat statuses: `HEARTBEAT_OK`, `ALERT`

The dashboard displays a countdown timer for each agent showing time until the next expected heartbeat. If a heartbeat is overdue, the timer turns red and pulses.

---

### Activity Log

#### Get Activity Log
```
GET /api/activity/log?limit=50&offset=0&type=api

Response 200:
{
  "total": 150,
  "offset": 0,
  "limit": 50,
  "items": [
    {
      "id": "uuid",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "type": "api",
      "action": "POST /api/agents/tasks",
      "agentId": "whatsapp-agent",
      "metadata": {}
    }
  ]
}
```

#### Log Activity Entry
```
POST /api/activity/log
Content-Type: application/json

{
  "type": "agent",
  "action": "Agent started processing queue",
  "agentId": "whatsapp-agent",
  "metadata": { "queueSize": 5 }
}

Response 201: <activity log entry>
```

---

### SSE (Server-Sent Events)

```
GET /api/sse/subscribe
```

The SSE stream emits the following events:

| Event | Data | Description |
|-------|------|-------------|
| `task.created` | Task object | New task created |
| `task.updated` | Task object | Task fields updated |
| `task.deleted` | `{ taskId }` | Task removed |
| `task.status_changed` | `{ taskId, from, to, task }` | Task status transition |
| `agent.status_changed` | `{ agentId, from, to, agent }` | Agent status change |
| `heartbeat.received` | Heartbeat object | New heartbeat recorded |
| `system.health` | Health data | System health update |

---

### Placeholder Endpoints

These return sample data and are ready for future API integration:

- `GET /api/work/action-items` - Action items
- `GET /api/work/brief` - Daily work brief
- `GET /api/budget/summary` - Budget summary
- `GET /api/budget/trends` - Spending trends
- `GET /api/budget/upcoming-bills` - Upcoming bills
- `GET /api/jobs/recent` - Recent job matches
- `GET /api/views/daily` - Aggregated daily view
- `GET /api/views/weekly` - Aggregated weekly view
- `GET /api/views/monthly` - Aggregated monthly view

---

## Example Workflows

### 1. Agent Creates and Completes a Task

```bash
# 1. Create task
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"whatsapp-agent","task":{"title":"Send digest","status":"queued","priority":"high"}}'

# 2. Start working (use taskId from response)
curl -X PATCH http://localhost:3001/api/tasks/<taskId> \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress","progress":25}'

# 3. Update progress
curl -X PATCH http://localhost:3001/api/tasks/<taskId> \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"progress":75}'

# 4. Complete
curl -X PATCH http://localhost:3001/api/tasks/<taskId> \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","progress":100}'
```

### 2. Heartbeat Cycle

```bash
# Send heartbeat every N seconds
curl -X POST http://localhost:3001/api/agents/heartbeat \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "whatsapp-agent",
    "agentName": "WhatsApp Agent",
    "status": "HEARTBEAT_OK",
    "heartbeatInterval": 300,
    "systemHealth": {"memoryUsage": 45, "cpuUsage": 12}
  }'
```

---

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad request (missing required fields, invalid status) |
| 401 | Missing or invalid Authorization header |
| 403 | Invalid token |
| 404 | Resource not found |

Error response format:
```json
{ "error": "description of the error" }
```

---

## Health Check

```
GET /api/health

Response 200:
{
  "status": "ok",
  "uptime": 3600,
  "sseClients": 2
}
```
