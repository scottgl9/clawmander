# Clawmander Dashboard

**Your personal command center for AI agents, work, and finances.**

Clawmander provides full visibility into [OpenClaw](https://github.com/scottgl9/openclaw) agents with real-time task monitoring, heartbeat tracking, and an intuitive Kanban interface.

![Dashboard](https://img.shields.io/badge/status-active-success) ![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

A real-time dashboard that aggregates data from OpenClaw, workspace files, financial APIs, and job search systems into a unified view. Built with Next.js and Express, optimized for single-user deployment.

## Features

### 💬 Chat Interface (NEW)
- Discord/Matrix-style chat with OpenClaw agents
- Session sidebar with all active agent sessions
- Streaming responses with real-time markdown rendering (GFM tables, code blocks)
- Slash commands: `/model`, `/reset`, `/abort`, `/approve`, `/deny`, `/think`, `/verbose`
- Image attachment support (upload and send)
- Subagent activity indicators
- Approval request banners with approve/deny buttons

### 🤖 Agent Status (Kanban)
- Real-time view of what agents are working on
- Next heartbeat countdown timer
- Agent idle/active status
- Current tasks and progress

### 💼 Work View
- Action items from MEMORY.md and daily notes
- Expandable item lists (shows top 5, expand to 15)
- Filters out completed items (view on My Done page)
- Current work brief (meetings, priorities, blockers)
- ThinPro status, Jira tickets, team updates

### 💰 Budget & Finance
- Income tracking and cash flow analysis
- Collapsible category breakdown (via Lunchflow API)
- 6-month spending trends with charts
- Bill reminders and due dates
- Savings rate calculation

### 📅 Upcoming Events
- Bills due (with 7-day warning threshold)
- Calendar events (next 48 hours)
- Important deadlines

### 💼 Job Postings
- Recent matches (last 3 days)
- Houston → Austin → Remote prioritization
- Direct application links
- Match score and reasoning

### 📊 Time Views
- **Daily**: Today's priorities, meetings, action items
- **Weekly**: Week overview, progress tracking
- **Monthly**: Month-at-a-glance, milestone tracking

### 🔒 Activity Log
- Security audit trail
- Agent actions and API calls
- Timestamped event log

## Architecture

```
clawmander/
├── backend/                    # Node.js/Express REST API
│   ├── server.js               # Main server
│   ├── routes/                 # API endpoints (incl. /api/chat/*)
│   ├── collectors/             # OpenClawCollector (read-only WS)
│   ├── services/               # ChatGatewayClient, ChatService, etc.
│   └── models/                 # Data models
├── frontend/                   # React/Next.js dashboard
│   ├── components/
│   │   ├── chat/               # Chat UI components
│   │   ├── kanban/             # Kanban board
│   │   └── layout/             # Sidebar, Header, Layout
│   ├── hooks/                  # useSSE, useChatState
│   ├── pages/                  # chat.js, agents.js, etc.
│   └── lib/                    # api.js, chatApi.js
└── docs/                       # Documentation (GATEWAY.md, API.md, ...)
```

### Chat Data Flow

```
Browser (React)               Express Backend              OpenClaw Gateway
    |                               |                              |
    |-- POST /api/chat/send ------->|                              |
    |                               |-- WS chat.send RPC -------->|
    |                               |                              |
    |                               |<-- WS chat event (delta) ---|
    |<-- SSE chat.delta ------------|                              |
    |                               |<-- WS chat event (final) ---|
    |<-- SSE chat.final ------------|                              |
```

## Data Sources

1. **OpenClaw Sessions API** - Agent status, active sessions
2. **Memory Files** - Action items, priorities, notes
3. **Lunchflow API** - Budget data, transactions
4. **Job Search Results** - Recent matches from job-auto-apply
5. **Heartbeat State** - Last check times, next heartbeat
6. **Activity Logs** - Security audit trail

## Tech Stack

- **Backend**: Node.js 18+ • Express • WebSocket (ws) • SSE
- **Frontend**: Next.js 14 • React 18 • Tailwind CSS • Recharts
- **Storage**: JSON files with in-memory cache
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

```bash
# Clone and install
git clone git@github.com:scottgl9/clawmander.git
cd clawmander
cd backend && npm install
cd ../frontend && npm install

# Configure
cd ../backend && cp .env.example .env
# Edit .env with your settings

# Run in TEST MODE (with sample data)
./start-test.sh

# Or run in PRODUCTION MODE (empty dashboard)
cd backend && npm start        # Terminal 1 - Backend on :3001
cd frontend && npm run dev     # Terminal 2 - Frontend on :3000

# Or use systemd services (Linux)
./service.sh install && ./service.sh start
```

**Access**: http://localhost:3000

### Test Mode vs Production Mode

- **Test Mode** (`TEST_MODE=true`): Starts with 4 sample agents and 6 sample tasks
- **Production Mode** (`TEST_MODE=false`): Starts with empty dashboard, ready for real data

## Key Features

- ✅ **Chat Interface** - Discord-style chat with agent sessions, markdown, slash commands
- ✅ **Real-time Kanban Board** - Live task updates via SSE
- ✅ **Heartbeat Monitoring** - Countdown timers with color-coded alerts
- ✅ **Agent Status Tracking** - Visual indicators for agent health
- ✅ **Task Progress Bars** - Live progress updates
- ✅ **Time Views** - Daily, Weekly, Monthly perspectives
- ✅ **Activity Audit Log** - Security trail of all API calls
- ✅ **Budget & Jobs Widgets** - Integrated work/life dashboard
- ✅ **OpenClaw Integration** - Dual WebSocket connections (read + read/write)

## Documentation

📚 **Complete documentation available in `/docs`:**

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[Architecture](docs/ARCHITECTURE.md)** - System design and tech decisions
- **[Development](docs/DEVELOPMENT.md)** - Contributing and extending
- **[API Reference](docs/API.md)** - Complete endpoint documentation (incl. `/api/chat/*`)
- **[Gateway Reference](docs/GATEWAY.md)** - OpenClaw WebSocket protocol deep dive
- **[OpenClaw Integration](docs/OPENCLAW_INTEGRATION.md)** - How to connect agents
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Service Management (Linux)

Run Clawmander as systemd user services for production:

```bash
./service.sh install      # One-time setup
./service.sh start        # Start services
./service.sh status       # Check status
./service.sh logs         # View logs
./service.sh enable-boot  # Auto-start on boot
```

### Restarting Services

After making code changes or rebuilding the frontend:

```bash
# Rebuild frontend (if changed)
cd frontend && npm run build

# Restart both services
systemctl --user restart clawmander-frontend.service
systemctl --user restart clawmander-backend.service

# Or restart individually
systemctl --user restart clawmander-frontend.service  # Just frontend
systemctl --user restart clawmander-backend.service   # Just backend

# Check service status
systemctl --user status clawmander-frontend.service clawmander-backend.service
```

See [Setup Guide](docs/SETUP.md) for details.

## API Quick Reference

**Read Endpoints** (no auth):
- `GET /api/agents/status` - Agent statuses
- `GET /api/tasks` - All tasks
- `GET /api/tasks/stats` - Task statistics
- `GET /api/views/daily` - Daily view
- `GET /api/chat/sessions` - Gateway sessions
- `GET /api/chat/models` - Available models
- `GET /api/chat/history/:sessionKey` - Local message history

**Write Endpoints** (no auth required for chat, Bearer token for tasks):
- `POST /api/chat/send` - Send message to agent `{sessionKey, message}`
- `POST /api/chat/abort` - Abort active run `{sessionKey}`
- `POST /api/chat/sessions/:key/reset` - Reset session
- `POST /api/chat/sessions/:key/patch` - Patch session settings
- `POST /api/chat/approval/resolve` - Resolve approval `{approvalId, decision}`
- `POST /api/chat/upload` - Upload image attachment (multipart)
- `POST /api/agents/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `POST /api/agents/heartbeat` - Report heartbeat

**SSE Stream** (includes chat events):
- `GET /api/sse/subscribe` - Real-time event stream
  - `chat.delta` - Streaming response chunk
  - `chat.final` - Response complete
  - `chat.error` - Response error
  - `chat.aborted` - Response aborted
  - `chat.approval` - Approval request pending

Full API documentation: [docs/API.md](docs/API.md)

## OpenClaw Integration

Clawmander connects to OpenClaw in two ways:

1. **WebSocket** (`ws://127.0.0.1:18789`) - Backend listens for agent events
2. **REST API** - OpenClaw agents push tasks and heartbeats

See [OpenClaw Integration Guide](docs/OPENCLAW_INTEGRATION.md) for implementation examples.

## Contributing

Contributions welcome! See [Development Guide](docs/DEVELOPMENT.md) for setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/scottgl9/clawmander/issues)
- **Docs**: See `/docs` directory
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
