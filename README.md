# Clawmander Dashboard

**Personal command center for AI agents, work, and finances.**

Clawmander provides full visibility into [OpenClaw](https://github.com/scottgl9/openclaw) agents with real-time task monitoring, a virtual browser, bash terminal, chat interface, voice integration, drawing canvas, and more.

![Dashboard](https://img.shields.io/badge/status-active-success) ![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

A real-time dashboard that aggregates data from OpenClaw agents, workspace files, financial APIs, and job search systems into a unified view. Built with Next.js and Express, optimized for single-user deployment.

## Features

### 🌐 Virtual Browser
- Full remote Chromium browser streamed live via JPEG screencast over WebSocket
- Multiple browser instances with named tabs
- Popup / new-tab support — sites that open `window.open()` or `target="_blank"` links get their own tab within the same instance
- Per-instance tab bar with switch and close
- User/agent control modes — agent can drive the browser while you watch, or take control yourself
- Stealth mode (`--headless=new`, CDP anti-detection) to bypass bot detection
- Navigation toolbar: back, forward, reload, URL bar
- Full input support: click, scroll, keyboard, mouse-move
- Mobile keyboard toggle button (on-demand, no auto-pop)
- Agent message banner when agent is driving

### 💻 Bash Terminal
- Full xterm.js terminal in the browser backed by node-pty
- Persistent shell session over WebSocket (`/ws/terminal`)
- Resize-aware (terminal columns/rows tracked and forwarded to pty)
- Fast monospace rendering with standard terminal emulation

### 💬 Chat Interface
- Discord/Matrix-style chat with OpenClaw agents
- Session sidebar with all active agent sessions
- Streaming responses with real-time markdown rendering (GFM tables, code blocks)
- Slash commands: `/model`, `/reset`, `/abort`, `/approve`, `/deny`, `/think`, `/verbose`
- Image attachment support (upload and send)
- Subagent activity indicators
- Approval request banners with approve/deny buttons
- Message copy and retry buttons; smart auto-scroll

### 🎤 Voice Integration
- **Mic button** on chat input — click to dictate (Web Speech API, hidden in unsupported browsers)
- **TTS toggle** on chat page — agent responses read aloud via Chatterbox TTS server
- **Per-message speaker button** — replay any assistant message
- **Dedicated `/voice` page** — hands-free conversation loop with mic FAB, auto-listen mode, session selector
- Backend TTS proxy (`POST /api/voice/tts`) to Chatterbox OpenAI-compatible endpoint

### 🎨 Drawing Canvas
- Full Excalidraw canvas at `/draw` with dark theme
- Drawing list sidebar — create, rename, delete drawings
- Auto-save with 1s debounce; real-time sync via SSE (`drawing.*` events)
- Agent-accessible via REST API (`POST /api/drawings`, `PATCH /api/drawings/:id`)

### 🤖 Agent Status (Kanban)
- Real-time view of what agents are working on
- Next heartbeat countdown timer
- Agent idle/active status
- Current tasks and progress bars
- Completed tasks split by agent or by user

### 📰 Feeds
- Agent reports and cron run output in a paginated feed
- Filter by agent (work, personal, budget, job search, sentinel, code reviewer, jira)
- Real-time updates via SSE (`feed.new` events)

### ⏰ Cron Job Monitoring
- View all scheduled cron jobs and their status
- Last run time, next run time, and run history
- Real-time updates via SSE

### 🧠 Memory Viewer
- Browse agent memory files stored on disk
- Hierarchical view of memory entries
- Read-only inspection of what agents remember

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

### 📅 Time Views
- **Daily**: Today's priorities, meetings, action items
- **Weekly**: Week overview, progress tracking
- **Monthly**: Month-at-a-glance, milestone tracking

### 💼 Job Postings
- Recent matches (last 3 days)
- Houston → Austin → Remote prioritization
- Direct application links
- Match score and reasoning

### 🔒 Authentication
- JWT-based login/register with bcrypt password hashing
- Access token + refresh token flow (refresh token in HttpOnly cookie)
- `/login` and `/register` pages; protected routes redirect to login
- Profile update and password change in `/settings`
- Configurable via `AUTH_SECRET` and `AUTH_REQUIRE_AUTH` env vars

### 📊 Activity Log
- Security audit trail
- Agent actions and API calls
- Timestamped event log

### ⚙️ Server Settings
- Configurable Chatterbox TTS URL and Excalidraw asset path
- Settings persisted on the backend

## Architecture

```
clawmander/
├── backend/                    # Node.js/Express REST API + WebSocket
│   ├── server.js               # Main server
│   ├── routes/                 # API endpoints (chat, drawings, voice, browser, terminal, ...)
│   ├── collectors/             # OpenClawCollector (read-only WS)
│   ├── services/               # BrowserManager, BrowserInstance, ChatService, ...
│   └── storage/                # JSON file storage + in-memory cache
├── frontend/                   # React/Next.js dashboard
│   ├── components/
│   │   ├── browser/            # BrowserPanel, ControlBadge, AgentMessageBanner
│   │   ├── terminal/           # TerminalView (xterm.js)
│   │   ├── chat/               # Chat UI components
│   │   ├── drawings/           # Excalidraw canvas + sidebar
│   │   ├── voice/              # Voice page + settings panel
│   │   ├── kanban/             # Kanban board
│   │   └── layout/             # Sidebar, Header, Layout
│   ├── hooks/                  # useSSE, useBrowser, useChatState, useSpeechRecognition, ...
│   ├── pages/                  # chat, draw, voice, browser, terminal, agents, feeds, ...
│   └── lib/                    # api.js, chatApi.js, authApi.js
└── docs/                       # Documentation
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

### Browser Live View Data Flow

```
Browser (React canvas)        Express Backend              Chromium (Playwright)
    |                               |                              |
    |-- WS /ws/browser/:id -------->|                              |
    |                               |-- CDP screencast start ----->|
    |                               |<-- JPEG frames --------------|
    |<-- binary JPEG frames --------|                              |
    |-- click/key/scroll events --->|-- Playwright actions ------->|
```

## Tech Stack

- **Backend**: Node.js 18+ • Express • WebSocket (ws) • SSE • node-pty
- **Frontend**: Next.js 14 • React 18 • Tailwind CSS • Recharts • xterm.js
- **Browser Automation**: Playwright (Chromium) + CDP stealth
- **Auth**: JWT • bcrypt • HttpOnly refresh tokens
- **Storage**: JSON files with in-memory cache
- **Real-time**: Server-Sent Events (SSE) + WebSocket

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

# Or run in PRODUCTION MODE
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

- ✅ **Virtual Browser** - Remote Chromium with popup/tab support, stealth mode, user/agent control
- ✅ **Bash Terminal** - Full xterm.js terminal backed by node-pty over WebSocket
- ✅ **Chat Interface** - Discord-style chat with agent sessions, markdown, slash commands
- ✅ **Voice Integration** - STT mic input, TTS playback, hands-free /voice page
- ✅ **Drawing Canvas** - Excalidraw canvas with auto-save and agent-accessible REST API
- ✅ **Feeds & Reports** - Paginated agent feed with per-agent filtering
- ✅ **Cron Monitoring** - Scheduled job status with run history
- ✅ **Memory Viewer** - Browse agent memory files
- ✅ **Real-time Kanban Board** - Live task updates via SSE
- ✅ **Heartbeat Monitoring** - Countdown timers with color-coded alerts
- ✅ **Authentication** - JWT login/register with refresh tokens
- ✅ **Time Views** - Daily, Weekly, Monthly perspectives
- ✅ **Activity Audit Log** - Security trail of all API calls
- ✅ **Budget & Jobs Widgets** - Integrated work/life dashboard
- ✅ **OpenClaw Integration** - Dual WebSocket connections (read + read/write)

## API Quick Reference

**Browser Endpoints** (Bearer token required):
- `GET /api/browser` - List browser instances
- `POST /api/browser` - Create instance `{id?}`
- `DELETE /api/browser/:id` - Destroy instance
- `WS /ws/browser/:id` - Live view + control WebSocket

**Auth Endpoints**:
- `POST /api/auth/register` - Register `{username, password, name?, email?}`
- `POST /api/auth/login` - Login `{username, password}`
- `POST /api/auth/refresh` - Refresh access token (reads HttpOnly cookie)
- `POST /api/auth/logout` - Clear refresh token cookie
- `GET /api/auth/me` - Current user
- `PATCH /api/auth/me` - Update profile `{name?, email?}`
- `POST /api/auth/change-password` - `{currentPassword, newPassword}`

**Chat Endpoints**:
- `GET /api/chat/sessions` - Gateway sessions
- `GET /api/chat/models` - Available models
- `GET /api/chat/history/:sessionKey` - Message history
- `POST /api/chat/send` - Send message `{sessionKey, message}`
- `POST /api/chat/abort` - Abort run `{sessionKey}`
- `POST /api/chat/sessions/:key/reset` - Reset session
- `POST /api/chat/approval/resolve` - Resolve approval `{approvalId, decision}`
- `POST /api/chat/upload` - Upload image (multipart)

**Other Endpoints**:
- `GET /api/agents/status` - Agent statuses
- `GET /api/tasks` / `GET /api/tasks/stats` - Tasks
- `GET /api/feeds` - Agent feed entries
- `GET /api/cron` - Cron job status
- `GET /api/memory` - Memory file listing
- `GET /api/drawings` / `POST` / `PATCH /:id` / `DELETE /:id` - Drawings
- `POST /api/voice/tts` - Synthesize speech
- `GET /api/sse/subscribe` - SSE event stream

Full API documentation: [docs/API.md](docs/API.md)

## Documentation

📚 **Complete documentation available in `/docs`:**

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[Architecture](docs/ARCHITECTURE.md)** - System design and tech decisions
- **[Development](docs/DEVELOPMENT.md)** - Contributing and extending
- **[API Reference](docs/API.md)** - Complete endpoint documentation
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

```bash
# Rebuild frontend (if changed)
cd frontend && npm run build

# Restart services
systemctl --user restart clawmander-frontend.service
systemctl --user restart clawmander-backend.service

# Check status
systemctl --user status clawmander-frontend.service clawmander-backend.service
```

## OpenClaw Integration

Clawmander connects to OpenClaw in two ways:

1. **WebSocket** (`ws://127.0.0.1:18789`) - Backend listens for agent events
2. **REST API** - OpenClaw agents push tasks and heartbeats

See [OpenClaw Integration Guide](docs/OPENCLAW_INTEGRATION.md) for implementation examples.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/scottgl9/clawmander/issues)
- **Docs**: See `/docs` directory
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
