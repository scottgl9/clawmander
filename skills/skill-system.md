# Skill: System & Real-Time Events

Check server health, subscribe to real-time SSE events, and send commands.

**Base URL**: `http://localhost:3001`

---

## Health Checks

```
GET /api/health
```

Response:
```json
{ "status": "ok", "uptime": 3600, "sseClients": 2 }
```

```
GET /api/server/status
```

Returns server status plus OpenClaw gateway connection state.

---

## Real-Time Events (SSE)

Subscribe to the live event stream to receive push updates from the dashboard:

```
GET /api/sse/subscribe
```

This is a persistent HTTP connection (Server-Sent Events). Events are JSON-encoded.

### All SSE Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task.created` | Task object | New task created |
| `task.updated` | Task object | Task fields updated |
| `task.deleted` | `{ taskId }` | Task removed |
| `task.status_changed` | `{ taskId, from, to, task }` | Status transition |
| `agent.status_changed` | `{ agentId, from, to, agent }` | Agent status change |
| `agent.status` | `{ agentId, isWorking, runId, sessionKey }` | Agent work state |
| `heartbeat.received` | Heartbeat object | Heartbeat recorded |
| `system.health` | Health data | System health update |
| `actionitem.created` | Action item object | New action item |
| `actionitem.updated` | Action item object | Action item changed |
| `actionitem.deleted` | `{ id }` | Action item removed |
| `budget.transaction_created` | Transaction object | New budget transaction |
| `budget.transaction_updated` | Transaction object | Budget transaction updated |
| `budget.transaction_deleted` | `{ id }` | Budget transaction removed |
| `budget.category_created` | Category object | New budget category |
| `budget.category_updated` | Category object | Budget category updated |
| `budget.category_deleted` | `{ id }` | Budget category removed |
| `chat.delta` | `{ sessionKey, runId, text, seq }` | Streaming chat chunk |
| `chat.final` | `{ sessionKey, runId, text, usage }` | Chat response complete |
| `chat.error` | `{ sessionKey, runId, error }` | Chat error |
| `chat.aborted` | `{ sessionKey, runId }` | Chat run aborted |
| `chat.approval` | `{ approvalId, sessionKey, command, description }` | Approval needed |
| `chat.subagent` | `{ sessionKey, childSessionKey, state, label }` | Subagent activity |
| `drawing.created` | Drawing object | New drawing created |
| `drawing.updated` | Drawing object | Drawing updated |
| `drawing.deleted` | `{ id }` | Drawing removed |
| `feed.new` | Feed entry object | New feed/report available |
| `cron.status` | Cron status object | Cron job status change |

### Example: Subscribe with curl

```bash
curl -N http://localhost:3001/api/sse/subscribe
```

### Example: Subscribe in JavaScript

```js
const es = new EventSource('http://localhost:3001/api/sse/subscribe');
es.addEventListener('task.created', (e) => {
  const task = JSON.parse(e.data);
  console.log('New task:', task.title);
});
es.addEventListener('chat.final', (e) => {
  const { sessionKey, text } = JSON.parse(e.data);
  console.log(`[${sessionKey}]`, text);
});
```

---

## Send Command (Out-of-Band)

Send a text command to be processed by an agent. The response is delivered via the OpenClaw gateway (not inline).

```
POST /api/command
Authorization: Bearer <token>
Content-Type: application/json

{ "text": "Summarize my day", "agent_id": "general-agent" }
```

Response: `{ "status": "ok", "agent_id": "general-agent" }`

`agent_id` defaults to `"default"` if omitted.
