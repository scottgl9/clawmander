# Clawmander API Specification

Base URL: `http://localhost:3001`

## Authentication

Write endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <AUTH_TOKEN>
```

The token is configured via the `AUTH_TOKEN` environment variable in the backend `.env` file.

Read endpoints (`GET`) do not require authentication.

**Frontend**: Set `NEXT_PUBLIC_AUTH_TOKEN` in `frontend/.env.local` so the dashboard's API client includes the token on all write requests.

---

## Endpoints

### Chat (Gateway Proxy)

These endpoints proxy to the OpenClaw gateway. Authentication is not required (gateway auth is handled server-side via `OPENCLAW_TOKEN`).

#### List Sessions
```
GET /api/chat/sessions
```
Returns `{ sessions: [...], connected: bool }`. Sessions are filtered to direct agent sessions (no cron/group channels).

#### List Models
```
GET /api/chat/models
```
Returns `{ models: [...], connected: bool }`.

#### Get Local Message History
```
GET /api/chat/history/:sessionKey
```
Returns `{ messages: [...], source: 'gateway'|'local', activeRunId: string|null }`.
Fetches from gateway if connected (source of truth), falls back to local store.
`activeRunId` is non-null when an agent has an active run for this session — used by the frontend to restore streaming state on navigation.

#### Send Message
```
POST /api/chat/send
Content-Type: application/json

{ "sessionKey": "agent:my-agent:main", "message": "Hello!", "attachments": [] }
```
Returns `{ ok: true, runId, messageId }`. Streaming response arrives via SSE.

#### Abort Active Run
```
POST /api/chat/abort
Content-Type: application/json

{ "sessionKey": "agent:my-agent:main", "runId": "<optional>" }
```

#### Reset Session
```
POST /api/chat/sessions/:sessionKey/reset
Content-Type: application/json

{ "reason": "new" }
```

#### Patch Session
```
POST /api/chat/sessions/:sessionKey/patch
Content-Type: application/json

{ "model": "anthropic/claude-opus-4", "thinkingLevel": "auto" }
```

#### Resolve Approval
```
POST /api/chat/approval/resolve
Content-Type: application/json

{ "approvalId": "<uuid>", "decision": "approve" }
```

#### Upload Image
```
POST /api/chat/upload
Content-Type: multipart/form-data

file: <image file>
```
Returns `{ ok: true, url: "/api/chat/uploads/<filename>", filename, originalname }`.

#### Serve Uploaded Images
```
GET /api/chat/uploads/:filename
```

---

### Chat SSE Events

Delivered via `GET /api/sse/subscribe`:

| Event | Payload | Description |
|---|---|---|
| `chat.delta` | `{ sessionKey, runId, text, seq }` | Streaming text chunk |
| `chat.final` | `{ sessionKey, runId, text, usage }` | Response complete |
| `chat.error` | `{ sessionKey, runId, error }` | Response error |
| `chat.aborted` | `{ sessionKey, runId }` | Response aborted |
| `chat.approval` | `{ approvalId, sessionKey, command, description }` | Approval request pending |
| `chat.subagent` | `{ sessionKey, childSessionKey, state, label }` | Subagent activity |

---

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
    "details": "Check the WhatsApp queue for unread messages from the last 2 hours. Prioritize messages from contacts in the VIP list. For each message, parse intent, draft a response, and log the interaction.",
    "status": "queued",
    "priority": "high",
    "sessionKey": "session-abc123",
    "runId": "run-001",
    "progress": 0,
    "tags": ["messaging", "whatsapp"],
    "metadata": {}
  }
}

Response 201 (new task) / 200 (updated existing):
{
  "id": "uuid",
  "title": "Process incoming messages",
  "description": "Handle 5 pending WhatsApp messages",
  "details": "Check the WhatsApp queue for unread messages from the last 2 hours. Prioritize messages from contacts in the VIP list. For each message, parse intent, draft a response, and log the interaction.",
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

**Deduplication**: If `agentId`, `sessionKey`, and `runId` are all provided and match an existing task, the existing task is updated (200) instead of creating a duplicate (201). The original `id` and `createdAt` are preserved. If any of these three fields is missing, a new task is always created.

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
GET /api/tasks?status=in_progress&agentId=whatsapp-agent&agentType=main

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

### Task Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Short task name displayed in lists |
| `description` | string | Brief summary of what the task involves |
| `details` | string | **Expanded information shown when a task is clicked** in daily/weekly/monthly views. Use this for context, steps, notes, or any additional info that helps understand the task. |
| `status` | string | Current task status |
| `priority` | string | Task priority level |
| `progress` | number | Completion percentage (0-100) |
| `agentType` | string | `'main'` (default) or `'subagent'` — auto-detected from session key |
| `tags` | string[] | Labels for categorization |
| `metadata` | object | Arbitrary key-value data |

The `details` field is designed for rich, descriptive content that agents provide when creating or updating tasks. The dashboard renders tasks as expandable items — clicking a task reveals its `details` (or falls back to `description` if no details are set).

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
| `actionitem.created` | Action item object | New action item created |
| `actionitem.updated` | Action item object | Action item updated |
| `actionitem.deleted` | `{ id }` | Action item removed |
| `budget.transaction_created` | Transaction object | New budget transaction |
| `budget.transaction_updated` | Transaction object | Budget transaction updated |
| `budget.transaction_deleted` | `{ id }` | Budget transaction removed |
| `budget.category_created` | Category object | New budget category |
| `budget.category_updated` | Category object | Budget category updated |
| `budget.category_deleted` | `{ id }` | Budget category removed |
| `chat.delta` | `{ sessionKey, runId, text }` | Streaming assistant text |
| `chat.final` | `{ sessionKey, runId, text }` | Final assistant response |
| `chat.error` | `{ sessionKey, runId, error }` | Chat error |
| `chat.aborted` | `{ sessionKey, runId }` | Run was aborted |
| `agent.status` | `{ agentId, isWorking, runId, sessionKey }` | Agent work state change |
| `feed.new` | Feed entry object | New feed/report available |
| `cron.status` | Cron status object | Cron job status change |

---

### Action Items

Action items are organized into `personal` and `work` categories.

#### Get All Action Items
```
GET /api/work/action-items?category=personal|work

Response 200: [array of action item objects]
```

The optional `category` query parameter filters by category. Omit to get all items.

#### Get Completed Action Items
```
GET /api/work/action-items/completed

Response 200: [array of action items where done === true]
```

Returns all action items (across all categories) that have been marked as done.

#### Get Personal Items
```
GET /api/work/action-items/personal

Response 200:
[
  {
    "id": "uuid",
    "title": "Schedule dentist appointment",
    "description": "Need to book a cleaning, last visit was over 6 months ago.",
    "priority": "medium",
    "done": false,
    "category": "personal",
    "metadata": {},
    "createdAt": "2026-02-08T00:00:00.000Z",
    "updatedAt": "2026-02-08T00:00:00.000Z"
  }
]
```

#### Get Work Items
```
GET /api/work/action-items/work

Response 200:
[
  {
    "id": "uuid",
    "title": "Review OpenClaw agent configs",
    "description": "Audit heartbeat intervals and reconnect policies for all active agents.",
    "priority": "high",
    "done": false,
    "category": "work",
    "metadata": {},
    "createdAt": "2026-02-08T00:00:00.000Z",
    "updatedAt": "2026-02-08T00:00:00.000Z"
  }
]
```

#### Create Action Item
```
POST /api/work/action-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Review OpenClaw agent configs",
  "description": "Audit heartbeat intervals and reconnect policies.",
  "priority": "high",
  "category": "work"
}

Response 201 (new item) / 200 (updated existing): <action item object>
```

**Deduplication**: If `title` and `category` both match an existing action item, the existing item is updated (200) instead of creating a duplicate (201). The original `id` and `createdAt` are preserved.

Valid priorities: `low`, `medium`, `high`
Valid categories: `personal`, `work`

#### Update Action Item
```
PATCH /api/work/action-items/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "done": true
}

Response 200: <updated action item object>
```

#### Delete Action Item
```
DELETE /api/work/action-items/:id
Authorization: Bearer <token>

Response 200: { "success": true }
```

---

### Daily Brief

#### Get Daily Brief
```
GET /api/work/brief

Response 200:
{
  "date": "2026-02-08",
  "summary": "Focus on agent monitoring and dashboard polish.",
  "priorities": [
    {
      "title": "Monitor OpenClaw agents",
      "details": "Check heartbeat status for all connected agents. Verify reconnect policies are working and review any agents that have gone offline in the last 24 hours."
    }
  ],
  "blockers": []
}
```

Each priority includes a short `title` for display and a `details` field with expanded information. The frontend renders priorities as expandable items - clicking a priority reveals its details.

---

### Aggregated Views

Time-based views that aggregate tasks and agents. Each task in the response includes the `details` field — the frontend renders tasks as expandable items where clicking reveals the details.

#### Get Daily View
```
GET /api/views/daily

Response 200:
{
  "date": "2026-02-08",
  "tasks": [<task objects with details>],
  "agents": [<agent objects>],
  "stats": { "byStatus": {...}, "byPriority": {...}, "total": 10 }
}
```

#### Get Weekly View
```
GET /api/views/weekly

Response 200:
{
  "startDate": "2026-02-01",
  "endDate": "2026-02-08",
  "tasks": [<task objects with details>],
  "agents": [<agent objects>],
  "stats": {...},
  "completedThisWeek": 5
}
```

#### Get Monthly View
```
GET /api/views/monthly

Response 200:
{
  "month": "February 2026",
  "tasks": [<task objects with details>],
  "agents": [<agent objects>],
  "stats": {...},
  "completedThisMonth": 12
}
```

---

### Drawings

#### List Drawings
```
GET /api/drawings

Response 200: [{ "id": "uuid", "title": "Architecture Diagram", "updatedAt": "..." }]
```

#### Get Drawing
```
GET /api/drawings/:id

Response 200: <full drawing object with data>
```

#### Create Drawing
```
POST /api/drawings
Authorization: Bearer <token>
Content-Type: application/json

{ "title": "New Drawing", "data": { "elements": [], "appState": {}, "files": {} } }

Response 201: <drawing object>
```

#### Update Drawing
```
PATCH /api/drawings/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "title": "Renamed", "data": { "elements": [...], "appState": {...}, "files": {} } }

Response 200: <updated drawing object>
```

#### Delete Drawing
```
DELETE /api/drawings/:id
Authorization: Bearer <token>

Response 200: { "success": true }
```

**SSE events**: `drawing.created`, `drawing.updated`, `drawing.deleted`

---

### Voice (TTS Proxy)

#### Synthesize Speech
```
POST /api/voice/tts
Content-Type: application/json

{ "text": "Hello world", "voice": "default", "chatterboxUrl": "http://localhost:8400" }
```

Proxies to Chatterbox `/v1/audio/speech`. Strips markdown from `text` server-side before sending. `chatterboxUrl` overrides the `CHATTERBOX_URL` env var (useful for testing).

Response: audio bytes with `Content-Type: audio/mpeg` (or whatever Chatterbox returns).

#### TTS Status
```
GET /api/voice/tts/status

Response 200: { "available": true }
Response 200: { "available": false, "error": "..." }
```

Pings the Chatterbox server. Safe to call frequently — used by the UI status indicator.

---

### Placeholder Endpoints

These return sample data and are ready for future API integration:
- `GET /api/budget/summary` - Budget summary
- `GET /api/budget/trends` - Spending trends
- `GET /api/budget/upcoming-bills` - Upcoming bills
- `GET /api/jobs/recent` - Recent job matches (includes `summary` field)

---

## Example Workflows

### 1. Agent Creates and Completes a Task

```bash
# 1. Create task (include details for expandable view)
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"whatsapp-agent","task":{"title":"Send digest","details":"Compile message activity from the last 24 hours and send a summary digest to all subscribed contacts.","status":"queued","priority":"high"}}'

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

---

## Budget Management

### Get Budget Summary
```
GET /api/budget/summary?month=2026-02

Response 200:
{
  "month": "2026-02",
  "monthName": "February 2026",
  "totalBudget": 4000,
  "totalSpent": 2847.50,
  "remaining": 1152.50,
  "categories": [
    {
      "id": "uuid",
      "name": "Housing",
      "budget": 1200,
      "spent": 1200,
      "remaining": 0,
      "percentage": 100
    }
  ]
}
```

### Get All Categories
```
GET /api/budget/categories?month=2026-02

Response 200: [array of category objects]
```

### Create Category
```
POST /api/budget/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Entertainment",
  "budget": 200,
  "spent": 0,
  "month": "2026-02"
}

Response 201: <category object>
```

### Update Category
```
PATCH /api/budget/categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "budget": 250,
  "spent": 87.50
}

Response 200: <updated category object>
```

### Delete Category
```
DELETE /api/budget/categories/:id
Authorization: Bearer <token>

Response 200: { "success": true }
```

### Get All Transactions
```
GET /api/budget/transactions?categoryId=uuid&startDate=2026-02-01&endDate=2026-02-28

Response 200: [array of transaction objects]
```

### Create Transaction
```
POST /api/budget/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": "uuid",
  "amount": 87.43,
  "description": "Groceries",
  "date": "2026-02-08T12:00:00Z",
  "merchant": "Whole Foods",
  "metadata": {}
}

Response 201:
{
  "id": "uuid",
  "categoryId": "uuid",
  "amount": 87.43,
  "description": "Groceries",
  "date": "2026-02-08T12:00:00Z",
  "merchant": "Whole Foods",
  "metadata": {},
  "createdAt": "2026-02-08T12:00:00Z"
}
```

**Note**: Creating a transaction automatically updates the category's spent amount.

### Update Transaction
```
PATCH /api/budget/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 95.00,
  "description": "Updated description"
}

Response 200: <updated transaction object>
```

**Note**: Updating amount or categoryId automatically adjusts category spent amounts.

### Delete Transaction
```
DELETE /api/budget/transactions/:id
Authorization: Bearer <token>

Response 200: { "success": true }
```

**Note**: Deleting a transaction automatically deducts from category spent amount.

### Get Spending Trends
```
GET /api/budget/trends?months=6

Response 200:
[
  {
    "month": "Sep",
    "monthFull": "September 2025",
    "monthKey": "2025-09",
    "budget": 4000,
    "spent": 3250
  }
]
```

---

## OpenClaw Budget Integration

### Example: Sync Budget from Bank API

```bash
# OpenClaw fetches transactions from bank API
# Then pushes to Clawmander

# 1. Create categories (one-time)
curl -X POST http://localhost:3001/api/budget/categories \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Groceries",
    "budget": 600,
    "spent": 0,
    "month": "2026-02"
  }'

# 2. Add transactions as they occur
curl -X POST http://localhost:3001/api/budget/transactions \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "<category-uuid>",
    "amount": 87.43,
    "description": "Weekly groceries",
    "date": "2026-02-08T14:30:00Z",
    "merchant": "Whole Foods",
    "metadata": {
      "transactionId": "bank-txn-12345",
      "accountLast4": "1234"
    }
  }'
```

The dashboard will automatically update category spent amounts and show real-time budget progress.

---

## PersonaSync

These endpoints allow the PersonaSync Android app to publish phone data to the dashboard and retrieve it for display. All sync (write) endpoints require Bearer auth; query (read) endpoints are open.

> **Android Setup**: In PersonaSync, set the server URL to `http://<clawmander-host>:3001` and the API token to the value of `AUTH_TOKEN` from the backend `.env`.

### Data Storage

PersonaSync data is stored in a SQLite database at `backend/storage/data/personasync.db`, separate from the JSON file stores used by other features.

---

### Sync Endpoints

All sync endpoints accept a JSON array of records and upsert by `id` (INSERT OR REPLACE). Returns `{ "count": N, "status": "ok" }`.

#### Sync SMS
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

Response 200: { "count": 1, "status": "ok" }
```

`type`: `1` = received, `2` = sent.

#### Sync Calendar Events
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

#### Sync Health Records
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

Valid `type` values: `steps`, `heart_rate`, `sleep`, `calories` (and any custom string).

#### Sync Location Points
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

#### Sync Contacts
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

#### Sync Call Logs
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

`type`: `1` = incoming, `2` = outgoing, `3` = missed.

#### Sync App Usage
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

#### Sync Media Metadata
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

### Command Endpoint

Send a text command to be stored server-side. The response is not returned inline — it is delivered out-of-band via the OpenClaw gateway.

```
POST /api/command
Authorization: Bearer <token>
Content-Type: application/json

{ "text": "Summarize my day", "agent_id": "general-agent" }

Response 200: { "status": "ok", "agent_id": "general-agent" }
```

`agent_id` defaults to `"default"` if omitted.

---

### Query Endpoints

#### Summary (Today's Highlights)
```
GET /api/query/summary

Response 200:
{
  "sms_today": 14,
  "calendar_events": 3,
  "steps_today": 8432,
  "location_points": 287,
  "contacts": 312,
  "calls_today": 5
}
```

#### Row Counts
```
GET /api/query/counts

Response 200:
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

#### Paginated SMS
```
GET /api/query/sms?limit=50&offset=0

Response 200: [
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

Max `limit`: 500. Sorted by `date_ms` DESC.

#### Paginated Locations
```
GET /api/query/locations?limit=100&offset=0

Response 200: [
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

Max `limit`: 1000. Sorted by `timestamp_ms` DESC.

#### Paginated Health Records
```
GET /api/query/health?type=steps&limit=100&offset=0

Response 200: [
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

`type` is optional — omit to return all health record types. Max `limit`: 1000. Sorted by `start_iso` DESC.

---

### PersonaSync Workflow Example

```bash
BASE=http://192.168.1.104:3001
TOKEN=changeme

# Sync today's steps
curl -X POST $BASE/api/sync/health \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id":"steps-20260310","type":"steps","value":8432,"unit":"count","start_iso":"2026-03-10T00:00:00Z","end_iso":"2026-03-10T23:59:59Z"}]'

# Sync recent SMS (batch)
curl -X POST $BASE/api/sync/sms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id":"sms-1","address":"+15125550100","body":"Hello","date_ms":1741564800000,"type":1,"thread_id":1}]'

# Check today's summary
curl $BASE/api/query/summary

# Query recent location history
curl "$BASE/api/query/locations?limit=50"
```
