# Clawmander Architecture

Technical architecture and design decisions for the Clawmander Dashboard.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (http://localhost:3000)           │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Next.js Frontend (React)                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │ │
│  │  │  Kanban  │  │  Widgets │  │   Time   │             │ │
│  │  │  Board   │  │  (Work,  │  │   Views  │             │ │
│  │  │          │  │  Budget, │  │ (D/W/M)  │             │ │
│  │  └──────────┘  │  Jobs)   │  └──────────┘             │ │
│  │                └──────────┘                             │ │
│  │                     │                                    │ │
│  │                     ├─ REST API (fetch)                 │ │
│  │                     └─ SSE (EventSource)                │ │
│  └─────────────────────┬──────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Express Backend (http://localhost:3001)           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ REST API Routes                                          ││
│  │  /api/agents/*, /api/tasks/*, /api/sse/subscribe        ││
│  └────────────┬──────────────────────────────────────┬─────┘│
│               │                                       │      │
│  ┌────────────▼────────┐                 ┌───────────▼─────┐│
│  │   Services Layer    │                 │   SSE Manager   ││
│  │  - TaskService      │◄────────────────┤  - Broadcast    ││
│  │  - AgentService     │                 │  - Clients      ││
│  │  - HeartbeatService │                 └─────────────────┘│
│  │  - ActionItemService│                                    │
│  └────────────┬────────┘                                     │
│               │                                              │
│  ┌────────────▼────────┐                 ┌─────────────────┐│
│  │   Storage Layer     │                 │  OpenClaw WS    ││
│  │  - FileStore        │                 │   Collector     ││
│  │  - JSON files       │                 │  - Auto-reconnect││
│  │  - In-memory cache  │                 │  - Event mapping││
│  └─────────────────────┘                 └────────┬────────┘│
└──────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                                    ┌──────────────────────────┐
                                    │  OpenClaw (External)     │
                                    │  ws://127.0.0.1:18789    │
                                    │  - Agent lifecycle       │
                                    │  - Heartbeats           │
                                    │  - System health        │
                                    └──────────────────────────┘
```

## Frontend Architecture

### Technology Stack
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: React Hooks (no Redux/Zustand)
- **Real-time**: EventSource (SSE)

### Directory Structure
```
frontend/src/
├── components/
│   ├── layout/         # Layout components (Header, Sidebar, Layout)
│   ├── kanban/         # Kanban board components
│   ├── shared/         # Reusable UI components
│   ├── work/           # Work-related widgets
│   ├── budget/         # Budget widgets and charts
│   ├── jobs/           # Job listing components
│   └── activity/       # Activity log component
├── hooks/
│   ├── useSSE.js       # SSE connection hook
│   └── useAPI.js       # API fetch hook
├── lib/
│   ├── api.js          # API client functions
│   └── constants.js    # App-wide constants
├── pages/
│   ├── index.js        # Main dashboard (agent status dot + widgets)
│   ├── agents.js       # Agent task kanban board
│   ├── daily.js        # Daily view
│   ├── weekly.js       # Weekly view
│   ├── monthly.js      # Monthly view
│   ├── activity.js     # Activity log page
│   └── completed/
│       ├── index.js    # Redirects to /completed/agent
│       ├── agent.js    # Completed agent tasks
│       └── mine.js     # Completed user action items
└── styles/
    └── globals.css     # Global styles and theme
```

### Key Design Patterns

**1. Server-Sent Events (SSE) for Real-time**
- No WebSocket complexity on frontend
- Auto-reconnect built into EventSource
- One-way server→client is sufficient
- Reduces frontend complexity

**2. Optimistic Updates**
- Local state updates on SSE events
- No polling required
- Immediate UI feedback

**3. Custom Hooks**
- `useSSE` - Manages EventSource lifecycle
- `useAPI` - Handles fetch with loading/error states

**4. Component Composition**
- Small, focused components
- Props-down data flow
- No prop drilling (data fetched at page level)

## Backend Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express
- **Storage**: JSON files with in-memory cache
- **Real-time**: Server-Sent Events (SSE)
- **WebSocket Client**: ws library (for OpenClaw)

### Directory Structure
```
backend/
├── collectors/
│   └── OpenClawCollector.js    # WebSocket client
├── config/
│   └── config.js               # Environment config loader
├── middleware/
│   ├── auth.js                 # Bearer token auth
│   └── logger.js               # Activity logger
├── models/
│   ├── Task.js                 # Task factory
│   ├── Agent.js                # Agent factory
│   ├── Heartbeat.js            # Heartbeat factory
│   ├── ActivityLog.js          # Activity log factory
│   └── ActionItem.js           # Action item factory
├── routes/
│   ├── index.js                # Route aggregator
│   ├── agents.js               # Agent endpoints
│   ├── tasks.js                # Task endpoints
│   ├── sse.js                  # SSE endpoint
│   └── ...                     # Other routes
├── services/
│   ├── TaskService.js          # Task business logic
│   ├── AgentService.js         # Agent business logic
│   ├── HeartbeatService.js     # Heartbeat logic
│   ├── ActionItemService.js   # Action item CRUD (personal/work)
│   └── SSEManager.js           # SSE client management
├── storage/
│   ├── FileStore.js            # Generic JSON storage
│   └── data/                   # JSON files (gitignored)
└── server.js                   # Entry point
```

### Layered Architecture

**1. Routes Layer**
- HTTP request handling
- Input validation
- Response formatting
- No business logic

**2. Services Layer**
- Business logic
- Data transformation
- SSE event emission
- Cross-service coordination

**3. Storage Layer**
- Persistence abstraction
- In-memory caching
- CRUD operations + predicate lookup (`findBy`)
- No business logic

**4. Models Layer**
- Data structures
- Factory functions
- Validation
- Default values

### Key Design Decisions

**1. File-Based Storage**
- **Why**: No database dependency, simple setup
- **Trade-off**: Not suitable for high write volume
- **Mitigation**: In-memory cache for reads
- **Future**: Can swap to DB without API changes

**2. In-Memory Cache**
- Reads from memory (fast)
- Writes to disk + memory (durable)
- Cache invalidation on write
- Simple, effective for low-concurrency

**3. SSE Over WebSocket**
- Simpler than WebSocket
- Built-in reconnection
- HTTP/2 multiplexing
- Sufficient for server→client push

**4. Bearer Token Auth**
- Simple, stateless
- Sufficient for single-user
- Write endpoints only
- Future: JWT, OAuth

**5. Separation of Read/Write**
- Read endpoints: No auth (localhost only)
- Write endpoints: Bearer token required
- OpenClaw can push, frontend can read

## Data Flow

### Task Creation Flow (with Deduplication)
```
OpenClaw → POST /api/agents/tasks
           ↓
        Auth Middleware
           ↓
        TaskService.upsert()
           ↓
     Match on agentId + sessionKey + runId?
        ┌──── yes ────┐──── no ────┐
        ▼             ▼            ▼
  FileStore.update()  │   FileStore.insert()
     (200)            │      (201)
        ▼             ▼            ▼
  task.updated    SSEManager    task.created
        └─────────┬────────────────┘
                  ↓
          EventSource (frontend)
                  ↓
            KanbanBoard updates
```

If any dedup key field (`agentId`, `sessionKey`, `runId`) is missing, the
request falls through to a normal `create()` for backward compatibility.

### Heartbeat Flow
```
OpenClaw → POST /api/agents/heartbeat
           ↓
        Auth Middleware
           ↓
     HeartbeatService.record()
           ↓
    ┌──────┼───────┐
    ▼      ▼       ▼
heartbeats.json  AgentService.upsert()  SSEManager.broadcast()
                     ↓                   ↓
                 agents.json         EventSource
                                     ↓
                               Frontend updates timers
```

### SSE Event Flow
```
Service Layer → SSEManager.broadcast(event, data)
                ↓
        All connected clients
                ↓
        EventSource.addEventListener(event, handler)
                ↓
        Component setState(newData)
                ↓
        React re-render
```

## OpenClaw Integration

### WebSocket Collector
- Connects to `ws://127.0.0.1:18789`
- Protocol v3 3-step handshake: challenge → connect → res (hello-ok)
- 2s timeout fallback for localhost connections where challenge is optional
- Auto-reconnect with exponential backoff (1s → 30s max)
- Subscribes to: agent, health, heartbeat, tick, presence, start, end, error
- Maps events to internal data structures
- Lifecycle events (start/end/error) automatically create/update tasks via TaskService
- Parses session keys to detect subagent work (`agent:<id>:subagent:<uuid>`)
- Emits SSE events on state changes

### Event Mapping
| OpenClaw Event | Action | SSE Event |
|----------------|--------|-----------|
| `agent` | Update agent status | `agent.status_changed` |
| `presence` | Update agent presence | `agent.status_changed` |
| `heartbeat` | Record heartbeat | `heartbeat.received` |
| `tick` | Update agent timestamp | - |
| `health` | Broadcast health | `system.health` |
| `start` | Create task, mark agent active | `task.created` |
| `end` | Complete task, mark agent idle | `task.updated` |
| `error` | Block task, mark agent error | `task.updated` |

### Graceful Degradation
- Dashboard works without OpenClaw
- Shows "disconnected" status
- Manual data entry via API still works
- Auto-reconnects when OpenClaw starts

## Performance Considerations

### Frontend
- Static generation for pages where possible
- Component-level data fetching (no global state)
- Debounced SSE handlers
- Virtualization for long lists (future)

### Backend
- In-memory cache eliminates file I/O on reads
- Single write per update (batch writes future)
- SSE keeps connections alive (minimal overhead)
- Compression for SSE streams (future)

## Security Model

### Trust Boundaries
1. **Backend ↔ Frontend**: Localhost only (CORS restricted)
2. **OpenClaw → Backend**: Bearer token required
3. **External APIs**: Not yet implemented

### Authentication
- **Read endpoints**: No auth (localhost trust)
- **Write endpoints**: Bearer token
- **Future**: Multi-user with sessions/JWT

### Data Privacy
- All data local to machine
- No external services (yet)
- Activity log for audit trail

## Scalability Considerations

**Current Limits:**
- ~1000 tasks (file-based storage)
- ~100 SSE clients (Node.js limit)
- Single process (no clustering)

**Future Scaling:**
- Database migration (PostgreSQL/SQLite)
- Redis for caching
- Load balancer for multiple frontends
- Clustering for backend

## Error Handling

**Frontend:**
- Loading states
- Error states
- Empty states
- Auto-retry on SSE disconnect

**Backend:**
- Try/catch in routes
- Graceful degradation
- Logs to stdout (systemd journal)
- Service auto-restart on crash

## Monitoring & Observability

**Current:**
- Systemd journal logs
- `/api/health` endpoint
- Activity log

**Future:**
- Prometheus metrics
- Grafana dashboards
- Error tracking (Sentry)
- Uptime monitoring

## Testing Strategy (Future)

**Unit Tests:**
- Service layer logic
- Model factories
- Storage layer

**Integration Tests:**
- API endpoint contracts
- SSE event emission

**E2E Tests:**
- Kanban drag-drop (future)
- Dashboard navigation
- Real-time updates

## Deployment Topologies

### Single Machine (Current)
```
[Machine]
├── Backend (port 3001)
├── Frontend (port 3000)
└── OpenClaw (port 18789)
```

### Separate Frontend/Backend (Future)
```
[Frontend Server]       [Backend Server]       [OpenClaw Server]
    :3000          →        :3001         ←         :18789
```

### Container Deployment (Future)
```
Docker Compose:
  - clawmander-backend
  - clawmander-frontend
  - openclaw (external)
```

## Technology Choices: Rationale

| Choice | Why | Alternative |
|--------|-----|-------------|
| Next.js | SSR, fast, popular | Create React App, Vite |
| Tailwind | Utility-first, fast | Styled Components, CSS Modules |
| Recharts | Simple, React-native | Chart.js, D3.js |
| Express | Minimal, flexible | Fastify, Koa |
| File Storage | No dependencies | SQLite, PostgreSQL |
| SSE | Simple, built-in | WebSocket, long polling |

## Future Architecture

See [GitHub Issues](https://github.com/scottgl9/clawmander/issues) for planned enhancements.
