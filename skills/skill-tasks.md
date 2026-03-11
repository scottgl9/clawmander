# Skill: Task Management

Create, update, and track tasks on the Clawmander Kanban board.

**Base URL**: `http://localhost:3001`
**Auth**: Write endpoints require `Authorization: Bearer <AUTH_TOKEN>`

---

## Task Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Short name displayed in the task list |
| `description` | No | Brief summary |
| `details` | **Recommended** | Expanded content shown when the user clicks the task. Include context, steps, acceptance criteria. |
| `status` | No | Default: `queued` |
| `priority` | No | Default: `medium` |
| `progress` | No | 0–100 |
| `tags` | No | Array of label strings |
| `sessionKey` | No | Associate with a gateway session |
| `runId` | No | Associate with an agent run |
| `metadata` | No | Arbitrary key-value data |

**Statuses**: `queued`, `in_progress`, `done`, `blocked`
**Priorities**: `low`, `medium`, `high`, `critical`

**Deduplication**: If `agentId`, `sessionKey`, and `runId` all match an existing task, the existing task is updated (200) instead of creating a new one (201).

---

## Create Task

```
POST /api/agents/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "my-agent",
  "task": {
    "title": "Process incoming messages",
    "description": "Handle 5 pending messages",
    "details": "Check the queue for unread items from the last 2 hours. Prioritize VIP contacts. For each message, parse intent, draft a response, and log the interaction.",
    "status": "queued",
    "priority": "high",
    "tags": ["messaging"]
  }
}
```

Response `201` (new) or `200` (deduplicated update) — includes the task `id`.

---

## Update Task

```
PATCH /api/tasks/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "in_progress", "progress": 50 }
```

---

## Complete Task

```
PATCH /api/tasks/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "done", "progress": 100 }
```

---

## Delete Task

```
DELETE /api/tasks/:taskId
Authorization: Bearer <token>
```

---

## Query Tasks

```
GET /api/tasks                            # All tasks
GET /api/tasks?status=in_progress        # Filter by status
GET /api/tasks?agentId=my-agent          # Filter by agent
GET /api/tasks/:taskId                   # Single task
GET /api/tasks/stats                     # Counts by status/priority
```

Stats response:
```json
{
  "total": 10,
  "byStatus": { "queued": 3, "in_progress": 2, "done": 4, "blocked": 1 },
  "byPriority": { "low": 1, "medium": 4, "high": 3, "critical": 2 }
}
```

---

## Status Flow

```
queued --> in_progress --> done
  |             |
  v             v
blocked --> in_progress
```

---

## Example: Full Task Lifecycle

```bash
BASE=http://localhost:3001
TOKEN=changeme

# 1. Create (always include details)
TASK=$(curl -s -X POST $BASE/api/agents/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "task": {
      "title": "Send digest",
      "details": "Compile message activity from the last 24 hours and send a summary digest to all subscribed contacts.",
      "status": "queued",
      "priority": "high"
    }
  }')
TASK_ID=$(echo $TASK | jq -r '.id')

# 2. Start working
curl -X PATCH $BASE/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress","progress":25}'

# 3. Update progress
curl -X PATCH $BASE/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"progress":75}'

# 4. Complete
curl -X PATCH $BASE/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","progress":100}'
```
