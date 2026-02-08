# OpenClaw Integration Guide

How Clawmander integrates with OpenClaw for real-time agent monitoring.

## Overview

Clawmander provides **full visibility** into OpenClaw agents through:
1. **WebSocket Collector** - Backend subscribes to OpenClaw events
2. **REST API** - OpenClaw pushes task updates and heartbeats
3. **Real-time Dashboard** - Frontend displays live agent status

```
OpenClaw (ws://127.0.0.1:18789)
    │
    ├─ WebSocket Events ──────> Clawmander Backend
    │  (agent, health, heartbeat)     │
    │                                  ├─ SSE Stream ──> Frontend
    │                                  │
    └─ REST API Calls ────────────────┘
       (tasks, heartbeats)
```

## WebSocket Integration

### Connection

Clawmander's backend automatically connects to OpenClaw's WebSocket using **Protocol v3**:

```javascript
// backend/collectors/OpenClawCollector.js
const ws = new WebSocket('ws://127.0.0.1:18789');

ws.on('open', () => {
  // OpenClaw Protocol v3 requires RPC-style connect request
  ws.send(JSON.stringify({
    type: 'req',
    id: '1',  // Unique request ID
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'cli',              // MUST be 'cli' for operator clients
        version: '1.0.0',       // Clawmander version
        platform: 'darwin',     // Process platform (darwin, linux, win32)
        mode: 'operator',       // MUST be 'operator' or 'node'
      },
      role: 'operator',         // Must match client.mode
      scopes: ['operator.read'], // Requested permissions
      auth: {
        token: process.env.OPENCLAW_TOKEN || ''
      }
    }
  }));
});

// Gateway responds with 'hello-ok' on successful handshake
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'hello-ok') {
    console.log('Connected to OpenClaw Gateway');
    // Connection established, can now send requests and receive events
  }
});
```

**Important Protocol Constants**:
- `client.id`: Must be **"cli"** for operator clients (NOT custom values)
- `client.mode`: Must be **"operator"** (for monitoring) or **"node"** (for devices)
- `role`: Must match `client.mode`

See [OpenClaw Gateway Protocol](https://docs.openclaw.ai/gateway/protocol) for full specification.

### Event Subscriptions

| Event | Purpose | Clawmander Action |
|-------|---------|-------------------|
| `agent` | Agent lifecycle (start/stop/error) | Update agent status |
| `presence` | Agent online/offline | Update agent presence |
| `heartbeat` | Agent health check | Record heartbeat, update timer |
| `tick` | Periodic agent ping | Update last-seen timestamp |
| `health` | System health metrics | Broadcast to dashboard |

### Auto-Reconnect

Connection loss is handled gracefully:
- Initial retry: 1 second
- Exponential backoff: 2s, 4s, 8s, 16s
- Max delay: 30 seconds
- Infinite retries (until service stops)

Dashboard shows "Disconnected" status until reconnected.

## REST API Integration

OpenClaw pushes updates to Clawmander via REST API.

### Authentication

All write endpoints require Bearer token:

```bash
# In OpenClaw agent code
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"whatsapp-agent","task":{...}}'
```

Token is configured in `backend/.env`:
```env
AUTH_TOKEN=your-secure-token-here
```

### Creating Tasks

**Endpoint**: `POST /api/agents/tasks`

**Use Case**: Agent starts a new task

**Request**:
```json
{
  "agentId": "whatsapp-agent",
  "task": {
    "title": "Process incoming messages",
    "description": "Handle 5 pending WhatsApp messages",
    "status": "queued",
    "priority": "high",
    "sessionKey": "session-abc123",
    "runId": "run-001",
    "tags": ["messaging", "whatsapp"],
    "metadata": {
      "messageCount": 5,
      "groupId": "family-group"
    }
  }
}
```

**Response** (201):
```json
{
  "id": "uuid-generated-by-backend",
  "title": "Process incoming messages",
  "status": "queued",
  "priority": "high",
  "agentId": "whatsapp-agent",
  "progress": 0,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Dashboard Effect**: Card appears in "Queued" column

### Updating Tasks

**Endpoint**: `PATCH /api/tasks/:taskId`

**Use Case**: Agent updates task status or progress

**Request**:
```json
{
  "status": "in_progress",
  "progress": 50
}
```

**Response** (200): Updated task object

**Dashboard Effect**: Card moves to "In Progress" column, progress bar updates

**Status Flow**:
```
queued ──> in_progress ──> done
  │             │
  └──> blocked ─┘
```

### Reporting Heartbeats

**Endpoint**: `POST /api/agents/heartbeat`

**Use Case**: Agent reports it's alive and healthy

**Request**:
```json
{
  "agentId": "whatsapp-agent",
  "agentName": "WhatsApp Agent",
  "status": "HEARTBEAT_OK",
  "message": "All systems nominal",
  "heartbeatInterval": 300,
  "systemHealth": {
    "memoryUsage": 45,
    "cpuUsage": 12,
    "uptime": 86400,
    "activeConnections": 3
  },
  "tasks": [
    {
      "taskId": "uuid",
      "status": "in_progress",
      "progress": 75
    }
  ]
}
```

**Response** (200): Heartbeat object

**Dashboard Effect**:
- Countdown timer resets
- Agent status updates (green = healthy)
- Task progress syncs

**Heartbeat Status**:
- `HEARTBEAT_OK` - All good (green)
- `ALERT` - Warning/error (red)

### Updating Agent Status

**Endpoint**: `POST /api/agents/status`

**Use Case**: Agent changes state (idle/active/error)

**Request**:
```json
{
  "id": "whatsapp-agent",
  "name": "WhatsApp Agent",
  "status": "active",
  "metadata": {
    "version": "2.1.0",
    "platform": "linux"
  }
}
```

**Response** (200): Agent object

**Agent Statuses**:
- `idle` - Agent running but not processing (gray)
- `active` - Agent working on tasks (green)
- `offline` - Agent not running (black)
- `error` - Agent encountered error (red)

**Dashboard Effect**: Agent avatar color changes

## Heartbeat Protocol

### How It Works

1. Agent sends initial heartbeat with `heartbeatInterval` (e.g., 300 seconds)
2. Clawmander calculates next expected heartbeat time
3. Dashboard shows countdown timer
4. Timer color changes based on time remaining:
   - **Green**: > 2 minutes remaining
   - **Yellow**: 30s - 2m remaining
   - **Red**: < 30s remaining
   - **Red + pulsing**: Overdue

5. Agent sends next heartbeat before timer expires
6. Timer resets

### Example Implementation (Python)

```python
import requests
import time
import threading

class ClawmanderHeartbeat:
    def __init__(self, agent_id, agent_name, interval=300):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.interval = interval
        self.url = "http://localhost:3001/api/agents/heartbeat"
        self.token = "your-auth-token"
        self.running = False

    def send_heartbeat(self, status="HEARTBEAT_OK", tasks=None):
        payload = {
            "agentId": self.agent_id,
            "agentName": self.agent_name,
            "status": status,
            "heartbeatInterval": self.interval,
            "systemHealth": {
                "memoryUsage": get_memory_usage(),
                "cpuUsage": get_cpu_usage(),
            },
            "tasks": tasks or []
        }

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(self.url, json=payload, headers=headers)
            response.raise_for_status()
            print(f"Heartbeat sent: {response.status_code}")
        except Exception as e:
            print(f"Heartbeat failed: {e}")

    def start(self):
        self.running = True

        def heartbeat_loop():
            while self.running:
                self.send_heartbeat()
                time.sleep(self.interval)

        self.thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

# Usage
heartbeat = ClawmanderHeartbeat("whatsapp-agent", "WhatsApp Agent", interval=300)
heartbeat.start()
```

### Example Implementation (Node.js)

```javascript
class ClawmanderHeartbeat {
  constructor(agentId, agentName, interval = 300) {
    this.agentId = agentId;
    this.agentName = agentName;
    this.interval = interval * 1000; // Convert to ms
    this.url = 'http://localhost:3001/api/agents/heartbeat';
    this.token = 'your-auth-token';
    this.timer = null;
  }

  async sendHeartbeat(status = 'HEARTBEAT_OK', tasks = []) {
    const payload = {
      agentId: this.agentId,
      agentName: this.agentName,
      status,
      heartbeatInterval: this.interval / 1000,
      systemHealth: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: process.cpuUsage().user / 1000000,
        uptime: process.uptime(),
      },
      tasks,
    };

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log('Heartbeat sent');
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
    }
  }

  start() {
    this.sendHeartbeat(); // Send immediately
    this.timer = setInterval(() => this.sendHeartbeat(), this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Usage
const heartbeat = new ClawmanderHeartbeat('whatsapp-agent', 'WhatsApp Agent', 300);
heartbeat.start();
```

## Task Workflow Example

Complete workflow for an agent processing a task:

```javascript
// 1. Agent starts, sends heartbeat
POST /api/agents/heartbeat
{
  "agentId": "whatsapp-agent",
  "status": "HEARTBEAT_OK",
  "heartbeatInterval": 300
}

// 2. Agent receives new message, creates task
POST /api/agents/tasks
{
  "agentId": "whatsapp-agent",
  "task": {
    "title": "Process message from Alice",
    "status": "queued",
    "priority": "high"
  }
}
// Response: { "id": "task-123", ... }

// 3. Agent starts processing
PATCH /api/tasks/task-123
{
  "status": "in_progress",
  "progress": 10
}

// 4. Agent updates progress
PATCH /api/tasks/task-123
{ "progress": 50 }

PATCH /api/tasks/task-123
{ "progress": 75 }

// 5. Agent completes task
PATCH /api/tasks/task-123
{
  "status": "done",
  "progress": 100
}

// 6. Agent sends next heartbeat (within 300s)
POST /api/agents/heartbeat
{
  "agentId": "whatsapp-agent",
  "status": "HEARTBEAT_OK",
  "tasks": []  // No active tasks
}
```

## Configuration

### Backend Configuration

**`backend/.env`**:
```env
# OpenClaw WebSocket URL
OPENCLAW_WS_URL=ws://127.0.0.1:18789

# OpenClaw authentication token (if required)
OPENCLAW_TOKEN=your-openclaw-token

# API authentication (for OpenClaw to call Clawmander)
AUTH_TOKEN=secure-random-token
```

### OpenClaw Configuration

In your OpenClaw agent configs, set:

```yaml
# openclaw-config.yaml
clawmander:
  api_url: http://localhost:3001
  auth_token: secure-random-token
  heartbeat_interval: 300
```

## Graceful Degradation

Clawmander works **without** OpenClaw:

- ✅ Manual task creation via API
- ✅ Dashboard displays all data
- ✅ SSE real-time updates work
- ❌ WebSocket events unavailable
- ❌ No automatic agent status updates

**Status shown**: "OpenClaw: Disconnected" in header

## Monitoring Integration

Check OpenClaw integration health:

```bash
# Backend logs
journalctl --user -u clawmander-backend | grep OpenClaw

# Expected output (healthy):
[OpenClaw] Connected
[OpenClaw] Received event: agent

# Expected output (disconnected):
[OpenClaw] Error: connect ECONNREFUSED
[OpenClaw] Reconnecting in 5s...
```

## Security Considerations

1. **Auth Token**: Use strong random token (32+ chars)
2. **Localhost Only**: OpenClaw and Clawmander should be on same machine
3. **Firewall**: Don't expose ports 3001/18789 externally
4. **HTTPS**: If exposing publicly, use reverse proxy with SSL

## Future Enhancements

- [ ] Bi-directional task assignment (Clawmander → OpenClaw)
- [ ] Agent command execution (start/stop/restart)
- [ ] Task priority queue management
- [ ] Multi-OpenClaw instance support
- [ ] Agent performance metrics
- [ ] Task success/failure analytics

See [GitHub Issues](https://github.com/scottgl9/clawmander/issues) for planned features.
