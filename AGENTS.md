# AGENTS.md — Clawmander Dashboard

Developer and AI agent guide for working on the Clawmander dashboard.

## Architecture

- **Backend** — Node.js/Express, runs on `http://localhost:3001`
- **Frontend** — Next.js (React), runs on `http://localhost:3000`
- **Services** — User-level systemd services (no sudo required)

---

## ⚠️ After Every Code Change

Clawmander runs as **user systemd services** with a pre-built Next.js frontend. Any code change
requires a rebuild and service restart before changes take effect.

### Frontend change (pages, components, styles):
```bash
cd ~/sandbox/personal/clawmander

# Rebuild the frontend
./service.sh build

# Restart both services
./service.sh restart
```

### Backend-only change (routes, services, models):
```bash
# No build needed — just restart
./service.sh restart
```

### Full rebuild + restart (when in doubt):
```bash
cd ~/sandbox/personal/clawmander
./service.sh build && ./service.sh restart
```

---

## Service Management

All service management goes through `service.sh`:

| Command | Effect |
|---|---|
| `./service.sh build` | Install deps + build frontend (`npm run build`) |
| `./service.sh start` | Start backend + frontend services |
| `./service.sh stop` | Stop both services |
| `./service.sh restart` | Restart both services |
| `./service.sh status` | Show systemd status for both |
| `./service.sh logs` | Tail live logs (both services) |
| `./service.sh logs backend` | Backend logs only |
| `./service.sh logs frontend` | Frontend logs only |
| `./service.sh install` | First-time setup: build + install + enable services |

### Checking logs after a restart:
```bash
cd ~/sandbox/personal/clawmander
./service.sh logs
```

---

## Development Notes

- Frontend source: `frontend/src/`
- Backend source: `backend/`
- Service files: `clawmander-frontend.service`, `clawmander-backend.service`
- systemd user service dir: `~/.config/systemd/user/`

### Quick health check:
```bash
./service.sh status
curl http://localhost:3001/api/health   # backend
curl http://localhost:3000              # frontend
```

---

## Documentation Requirements

When making code changes, **always update relevant documentation**:

- **`docs/API.md`** — Update when adding/modifying API endpoints, SSE events, or response formats
- **`docs/ARCHITECTURE.md`** — Update when adding new design patterns, services, or architectural changes
- **`docs/DEVELOPMENT.md`** — Update when adding new hooks, component patterns, or dev workflows
- **`docs/GATEWAY.md`** — Update when modifying OpenClaw gateway interactions
- **`docs/EXCALIDRAW_SETUP.md`** — Excalidraw integration reference

### Checklist before committing:
1. If you added/changed an API endpoint → update `docs/API.md` (route, request/response format, auth)
2. If you added/changed SSE events → update the events table in `docs/API.md` AND add to `frontend/src/hooks/useSSE.js` listener array
3. If you added a new service/pattern → update `docs/ARCHITECTURE.md`
4. If you added a new frontend page → add nav item in `frontend/src/components/layout/Sidebar.js`

---

## Testing Requirements

All code changes **must include unit tests**. Tests use **Jest** and live in `tests/backend/`.

### Running tests:
```bash
cd ~/sandbox/personal/clawmander/backend
./node_modules/.bin/jest --verbose                          # all tests
./node_modules/.bin/jest --verbose --testPathPatterns=foo    # specific test
```

### What to test:
- **New routes** → Create `tests/backend/<feature>Routes.test.js` with mock services, test all CRUD endpoints including auth and 404 cases
- **New services** → Create `tests/backend/<Service>.test.js` testing create/read/update/delete + SSE broadcasts
- **Bug fixes** → Add regression tests covering the specific failure case
- **Modified endpoints** → Update existing tests if response format changed

### Test patterns:
- Use `jest.fn()` for mocking services and SSE managers
- Use Express test app pattern (see `tests/backend/chatRoutes.test.js` for reference)
- Auth-protected endpoints: use `Authorization: Bearer changeme` header (default dev token)
- Test both success paths AND error paths (404, missing params, disconnected state)

### Existing test files:
| File | Covers |
|------|--------|
| `chatRoutes.test.js` | Chat history, agents, sessions endpoints |
| `drawingsRoutes.test.js` | Drawings CRUD endpoints |
| `DrawingService.test.js` | DrawingService create/read/update/delete + SSE |
| `workRoutes.test.js` | Action items endpoints |
| `cronRoutes.test.js` | Cron job endpoints |
| `feedsRoutes.test.js` | Feed endpoints |
| `serverRoutes.test.js` | Server status endpoint |
| `FileStore.test.js` | File-based storage layer |
| `ActionItemService.test.js` | Action item service |
| `CronService.test.js` | Cron service |
| `MemoryService.test.js` | Memory service |
| `TaskService.test.js` | Task service |
| `Task.test.js` | Task model |

---

## Dependency Management

### Adding backend dependencies:
```bash
cd ~/sandbox/personal/clawmander/backend
npm install <package>
```

### Adding frontend dependencies:
```bash
cd ~/sandbox/personal/clawmander/frontend
npm install <package>
```

After adding dependencies, always rebuild: `./service.sh build && ./service.sh restart`

---

## Git Workflow

- Never commit to `main` directly — use feature branches
- Branch naming: `feature/`, `fix/`, `refactor/` prefixes
- Commit style: conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- After merging: rebuild + restart (see above)
