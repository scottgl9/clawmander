# Clawmander Skills Guide

> **New in v2**: Chat interface at `/chat`. See the Chat API section below for sending messages via the gateway.


How OpenClaw agents interact with the Clawmander REST API.

**Base URL**: `http://localhost:3001`

## Authentication

Write operations (`POST`, `PATCH`, `DELETE`) require a Bearer token:

```
Authorization: Bearer <AUTH_TOKEN>
```

Read operations (`GET`) are open. The token is set via `AUTH_TOKEN` in `backend/.env` (default: `changeme`).

---

## Skill: Report Agent Status

Tell Clawmander your agent is alive and what state it's in.

```
POST /api/agents/status
```

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "status": "active",
  "metadata": { "version": "1.0" }
}
```

**Statuses**: `idle`, `active`, `offline`, `error`

---

## Skill: Send Heartbeat

Send periodic heartbeats so the dashboard knows your agent is healthy. The `heartbeatInterval` tells Clawmander how often to expect the next one (in seconds). A countdown timer appears on the dashboard and turns red if overdue.

```
POST /api/agents/heartbeat
```

```json
{
  "agentId": "my-agent",
  "agentName": "My Agent",
  "status": "HEARTBEAT_OK",
  "message": "All systems nominal",
  "heartbeatInterval": 300,
  "systemHealth": {
    "memoryUsage": 45,
    "cpuUsage": 12,
    "uptime": 86400
  },
  "tasks": [
    { "taskId": "task-uuid", "status": "in_progress", "progress": 75 }
  ]
}
```

**Heartbeat statuses**: `HEARTBEAT_OK` (green), `ALERT` (red)

### Read Heartbeat Timings

```
GET /api/agents/heartbeat
```

Returns timing info for all agents: `lastHeartbeat`, `nextHeartbeat`, `secondsUntilNext`, `overdue`.

---

## Skill: Manage Tasks

### Create a Task

```
POST /api/agents/tasks
```

```json
{
  "agentId": "my-agent",
  "task": {
    "title": "Process incoming messages",
    "description": "Handle 5 pending messages",
    "details": "Check the message queue for unread items from the last 2 hours. Prioritize VIP contacts. For each message, parse intent, draft a response, and log the interaction.",
    "status": "queued",
    "priority": "high",
    "tags": ["messaging"],
    "metadata": {}
  }
}
```

Returns `201` with the created task including its `id`.

**Important**: Always include a `details` field with expanded context about the task. The dashboard renders tasks as expandable items — clicking a task reveals its `details`. Use `title` for the short label, `description` for a brief summary, and `details` for the full context (steps involved, relevant notes, acceptance criteria, etc.).

### Update a Task

```
PATCH /api/tasks/:taskId
```

```json
{
  "status": "in_progress",
  "progress": 50
}
```

### Complete a Task

```
PATCH /api/tasks/:taskId
```

```json
{
  "status": "done",
  "progress": 100
}
```

### Delete a Task

```
DELETE /api/tasks/:taskId
```

### Query Tasks

```
GET /api/tasks                          # All tasks
GET /api/tasks?status=in_progress       # Filter by status
GET /api/tasks?agentId=my-agent         # Filter by agent
GET /api/tasks/:taskId                  # Single task
GET /api/tasks/stats                    # Counts by status/priority
```

### Task Status Flow

```
queued --> in_progress --> done
  |             |
  v             v
blocked --> in_progress
```

**Statuses**: `queued`, `in_progress`, `done`, `blocked`
**Priorities**: `low`, `medium`, `high`, `critical`

### Task Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Short task name for list display |
| `description` | No | Brief summary |
| `details` | **Recommended** | Expanded info shown when the user clicks a task in the dashboard. Include context, steps, notes, or acceptance criteria. |
| `status` | No | Default: `queued` |
| `priority` | No | Default: `medium` |
| `tags` | No | Array of labels |
| `metadata` | No | Arbitrary key-value data |

---

## Skill: Full Task Lifecycle

A complete example of creating, working on, and completing a task:

```bash
# 1. Create (always include details for the expandable view)
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"my-agent","task":{"title":"Send digest","details":"Compile message activity from the last 24 hours and send a summary digest to all subscribed contacts.","status":"queued","priority":"high"}}'
# Note the "id" from the response

# 2. Start working
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

---

## Skill: Manage Action Items

Action items are personal or work to-dos displayed on the dashboard.

### Create

```
POST /api/work/action-items
```

```json
{
  "title": "Review agent configs",
  "description": "Audit heartbeat intervals and reconnect policies.",
  "priority": "high",
  "category": "work"
}
```

**Priorities**: `low`, `medium`, `high`
**Categories**: `personal`, `work`

### Read

```
GET /api/work/action-items                  # All items
GET /api/work/action-items?category=work    # Filter by category
GET /api/work/action-items/personal         # Personal only
GET /api/work/action-items/work             # Work only
```

### Mark Done

```
PATCH /api/work/action-items/:id
```

```json
{ "done": true }
```

### Delete

```
DELETE /api/work/action-items/:id
```

---

## Skill: Track Budget

### Categories

Categories represent spending buckets for a given month.

```
POST /api/budget/categories
```

```json
{
  "name": "Groceries",
  "budget": 600,
  "spent": 0,
  "month": "2026-02"
}
```

```
GET /api/budget/categories?month=2026-02    # List categories
GET /api/budget/categories/:id              # Single category
PATCH /api/budget/categories/:id            # Update
DELETE /api/budget/categories/:id           # Delete
```

### Transactions

Creating a transaction automatically updates the category's spent amount.

```
POST /api/budget/transactions
```

```json
{
  "categoryId": "category-uuid",
  "amount": 87.43,
  "description": "Weekly groceries",
  "date": "2026-02-08T14:30:00Z",
  "merchant": "Whole Foods"
}
```

```
GET /api/budget/transactions?categoryId=uuid&startDate=2026-02-01&endDate=2026-02-28
GET /api/budget/transactions/:id
PATCH /api/budget/transactions/:id
DELETE /api/budget/transactions/:id
```

### Summary & Trends

```
GET /api/budget/summary?month=2026-02       # Budget overview
GET /api/budget/trends?months=6             # Spending over time
GET /api/budget/upcoming-bills              # Upcoming bills
```

---

## Skill: Log Activity

Record events for the audit trail.

```
POST /api/activity/log
```

```json
{
  "type": "agent",
  "action": "Agent started processing queue",
  "agentId": "my-agent",
  "metadata": { "queueSize": 5 }
}
```

```
GET /api/activity/log?limit=50&offset=0&type=api
```

---

## Skill: Subscribe to Real-Time Events

Connect to the SSE stream to receive live updates:

```
GET /api/sse/subscribe
```

Events emitted:

| Event | Description |
|-------|-------------|
| `task.created` | New task created |
| `task.updated` | Task fields changed |
| `task.deleted` | Task removed |
| `task.status_changed` | Task status transition (includes `from`/`to`) |
| `agent.status_changed` | Agent status transition |
| `heartbeat.received` | Heartbeat recorded |
| `system.health` | System health update |
| `actionitem.created` | New action item |
| `actionitem.updated` | Action item changed |
| `actionitem.deleted` | Action item removed |

---

## Skill: Chat with Agents (Gateway)

The chat interface proxies messages through the backend to the OpenClaw gateway.

### Send a Message

```
POST /api/chat/send
```

```json
{
  "sessionKey": "agent:my-agent:main",
  "message": "What are you working on?",
  "attachments": []
}
```

Returns `{ runId, messageId }`. The streaming response arrives via SSE (`chat.delta`, `chat.final`).

### List Sessions

```
GET /api/chat/sessions
```

Returns `{ sessions: [...], connected: bool }`. Sessions are filtered to direct agent sessions only (no cron/group channels).

### Get Message History

```
GET /api/chat/history/agent:my-agent:main
```

Returns `{ messages: [...] }` — locally persisted messages (up to 200 per session).

### Slash Commands (Frontend)

Available in the chat input when connected to the gateway:

| Command | Effect |
|---|---|
| `/model anthropic/claude-opus-4` | Switch model |
| `/reset` | New conversation |
| `/abort` | Stop current run |
| `/approve` | Approve pending command |
| `/deny` | Deny pending command |
| `/think auto` | Set thinking level |
| `/verbose on\|off` | Toggle verbose |
| `/elevated ask` | Set permission level |

---

## Skill: Check System Health

```
GET /api/health                 # Uptime and SSE client count
GET /api/server/status          # Server + OpenClaw connection status
```

---

## Skill: Get Aggregated Views

Pre-built time-based views for dashboard consumption. Tasks in these responses include the `details` field, which the frontend renders as expandable items — clicking a task reveals its details.

```
GET /api/views/daily            # Today's tasks and stats
GET /api/views/weekly           # This week
GET /api/views/monthly          # This month
```

---

## Skill: Get Daily Brief

```
GET /api/work/brief
```

Returns today's summary, priorities (with expandable details), and blockers.

---

## Error Handling

All errors return:

```json
{ "error": "description" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request (missing fields, invalid values) |
| 401 | Missing Authorization header |
| 403 | Invalid token |
| 404 | Resource not found |

---

## Quick Reference

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Set agent status | POST | `/api/agents/status` | Yes |
| Send heartbeat | POST | `/api/agents/heartbeat` | Yes |
| Get heartbeat timings | GET | `/api/agents/heartbeat` | No |
| Create task | POST | `/api/agents/tasks` | Yes |
| Update task | PATCH | `/api/tasks/:id` | Yes |
| Delete task | DELETE | `/api/tasks/:id` | Yes |
| List tasks | GET | `/api/tasks` | No |
| Task stats | GET | `/api/tasks/stats` | No |
| Create action item | POST | `/api/work/action-items` | Yes |
| Update action item | PATCH | `/api/work/action-items/:id` | Yes |
| Delete action item | DELETE | `/api/work/action-items/:id` | Yes |
| List action items | GET | `/api/work/action-items` | No |
| Daily brief | GET | `/api/work/brief` | No |
| Create budget category | POST | `/api/budget/categories` | Yes |
| Create transaction | POST | `/api/budget/transactions` | Yes |
| Budget summary | GET | `/api/budget/summary` | No |
| Spending trends | GET | `/api/budget/trends` | No |
| Log activity | POST | `/api/activity/log` | No |
| Get activity log | GET | `/api/activity/log` | No |
| SSE subscribe | GET | `/api/sse/subscribe` | No |
| Health check | GET | `/api/health` | No |
| Server status | GET | `/api/server/status` | No |
| Daily view | GET | `/api/views/daily` | No |
| Weekly view | GET | `/api/views/weekly` | No |
| Monthly view | GET | `/api/views/monthly` | No |
