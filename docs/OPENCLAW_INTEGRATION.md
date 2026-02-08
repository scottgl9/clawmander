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

### Prerequisites

**⚠️ IMPORTANT: Authentication is Required**

OpenClaw Gateway requires authentication for WebSocket connections. Before connecting, you must:

1. **Find Your Gateway Token**:
   ```bash
   # Method 1: Check the Gateway config file
   cat ~/.config/openclaw/gateway.yaml | grep token

   # Method 2: Check environment variables
   printenv | grep OPENCLAW_GATEWAY_TOKEN

   # Method 3: Check Gateway process
   ps aux | grep openclaw-gateway
   ```

2. **Set the Token in Clawmander**:
   ```bash
   # In backend/.env
   OPENCLAW_TOKEN=your-gateway-token-here
   ```

**Authentication Behavior**:
- **Localhost (127.0.0.1)**: Authentication optional, device pairing auto-approved
- **LAN/Remote**: Authentication **required**, Gateway refuses to start without it
- **Missing Token**: Connection fails with "device identity required" or "invalid connect params"

See [OpenClaw Gateway Security Docs](https://docs.openclaw.ai/gateway/security) for details.

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
        platform: process.platform,  // 'linux', 'darwin', or 'win32'
        mode: 'operator',       // MUST be 'operator' or 'node'
      },
      role: 'operator',         // Must match client.mode
      scopes: ['operator.read'], // Requested permissions
      auth: {
        token: process.env.OPENCLAW_TOKEN || ''  // REQUIRED for non-localhost
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

**Important Protocol Requirements**:
- `client.id`: Must be **"cli"** for operator clients (NOT custom values like "clawmander")
- `client.mode`: Must be **"operator"** (for monitoring/UI) or **"node"** (for device nodes)
- `role`: Must match `client.mode` exactly
- `auth.token`: **Required** - must match the Gateway's configured token
- `platform`: Should be actual platform: "linux", "darwin", "win32"

**Common Connection Errors**:
- `"device identity required"` → Missing or invalid auth token
- `"invalid connect params: at /client/id"` → Wrong client.id value (not "cli")
- `"invalid connect params: at /client/mode"` → Wrong mode value or version mismatch
- `1008: pairing required` → Remote connection without proper authentication

### Protocol References

Official documentation:
- [Gateway Protocol Specification](https://docs.openclaw.ai/gateway/protocol)
- [Gateway Security & Auth](https://docs.openclaw.ai/gateway/security)
- [Gateway Configuration](https://deepwiki.com/openclaw/openclaw/3.1-gateway-configuration)
- [Network Configuration](https://deepwiki.com/openclaw/openclaw/13.4-network-configuration)

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

### Step 1: Find Your OpenClaw Gateway Token

OpenClaw Gateway requires authentication. The token is generated during setup:

```bash
# Method 1: Check Gateway config file
cat ~/.config/openclaw/gateway.yaml | grep 'auth.token'
# Look for: gateway.auth.token: "abc123..."

# Method 2: Check environment variable
echo $OPENCLAW_GATEWAY_TOKEN

# Method 3: Check running Gateway process
ps aux | grep openclaw-gateway | grep token

# Method 4: If no token exists, generate one
openssl rand -hex 32
# Then set it in gateway.yaml or as OPENCLAW_GATEWAY_TOKEN
```

**Note**: If your Gateway is running on `127.0.0.1:18789` without a token, it's in **insecure mode**. While authentication is optional for localhost, it's **required** for LAN/remote access.

### Step 2: Configure Clawmander Backend

**`backend/.env`**:
```env
# OpenClaw WebSocket URL (use localhost for auto-approved device pairing)
OPENCLAW_WS_URL=ws://127.0.0.1:18789

# OpenClaw Gateway authentication token (REQUIRED)
# Copy the token from your Gateway configuration
OPENCLAW_TOKEN=your-actual-gateway-token-from-step-1

# API authentication (for OpenClaw agents to call Clawmander)
AUTH_TOKEN=secure-random-token
```

### Step 3: Verify Backend Configuration

```bash
# Check that backend config has the token
cd backend
node -e "require('dotenv').config(); console.log('Token set:', !!process.env.OPENCLAW_TOKEN)"

# Should output: Token set: true
```

### Step 4: Restart Services

```bash
# Using the service script
./service.sh restart

# Or manually
cd backend && node server.js
```

### OpenClaw Agent Configuration (Optional)

If you want OpenClaw agents to push updates to Clawmander:

```yaml
# openclaw-config.yaml
clawmander:
  api_url: http://localhost:3001
  auth_token: secure-random-token  # Matches AUTH_TOKEN in backend/.env
  heartbeat_interval: 300
```

### Troubleshooting Authentication

**Connection fails with "device identity required"**:
- ✅ **Fix**: Add valid `OPENCLAW_TOKEN` to backend/.env
- Gateway token is missing or incorrect
- Verify token matches Gateway configuration

**Connection fails with "invalid connect params"**:
- Client version mismatch (update OpenClaw/Clawmander)
- Wrong client.id (must be "cli" for operators)
- Missing required fields in connect params

**Gateway refuses to start with "refusing to bind...without auth"**:
- Gateway is configured for LAN/tailnet but has no auth token
- Set `gateway.auth.token` in Gateway config
- Or set `OPENCLAW_GATEWAY_TOKEN` environment variable

**For insecure local testing only** (not recommended):
```yaml
# In Gateway config (NOT SECURE - localhost only)
gateway.controlUi.allowInsecureAuth: true
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
