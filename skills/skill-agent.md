# Skill: Agent Lifecycle

Report your agent's status and send periodic heartbeats to keep the dashboard healthy.

**Base URL**: `http://localhost:3001`
**Auth**: Write endpoints require `Authorization: Bearer <AUTH_TOKEN>`

---

## Report Agent Status

Tell the dashboard your agent is alive and what state it's in.

```
POST /api/agents/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "my-agent",
  "name": "My Agent",
  "status": "active",
  "metadata": { "version": "1.0" }
}
```

**Statuses**: `idle`, `active`, `offline`, `error`

Read all agent statuses:
```
GET /api/agents/status
```

---

## Send Heartbeat

Send periodic heartbeats so the dashboard countdown timer stays green. The `heartbeatInterval` (in seconds) tells the dashboard when to expect the next one — it turns red and pulses if overdue.

```
POST /api/agents/heartbeat
Authorization: Bearer <token>
Content-Type: application/json

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

Read heartbeat timings for all agents:
```
GET /api/agents/heartbeat
```

Returns: `lastHeartbeat`, `nextHeartbeat`, `secondsUntilNext`, `overdue` per agent.

---

## Example: Startup Sequence

```bash
BASE=http://localhost:3001
TOKEN=changeme

# 1. Announce yourself as active
curl -X POST $BASE/api/agents/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"my-agent","name":"My Agent","status":"active"}'

# 2. Send first heartbeat
curl -X POST $BASE/api/agents/heartbeat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "agentName": "My Agent",
    "status": "HEARTBEAT_OK",
    "heartbeatInterval": 300,
    "systemHealth": {"memoryUsage": 30, "cpuUsage": 5, "uptime": 0}
  }'

# 3. Repeat heartbeat every 300 seconds
```
