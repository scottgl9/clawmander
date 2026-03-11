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

## Git Workflow

- Never commit to `main` directly — use feature branches
- Branch naming: `feature/`, `fix/`, `refactor/` prefixes
- Commit style: conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- After merging: rebuild + restart (see above)
