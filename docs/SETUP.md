# Clawmander Setup Guide

Complete guide to setting up Clawmander Dashboard from scratch.

## Prerequisites

- **Node.js** 18+ and npm
- **Git** for cloning the repository
- **OpenClaw** running at `ws://127.0.0.1:18789` (optional, dashboard works without it)
- **Linux** with systemd (for service deployment) or any OS for manual deployment

## Quick Start

### 1. Clone Repository

```bash
cd ~/sandbox/personal
git clone git@github.com:scottgl9/clawmander.git
cd clawmander
```

### 2. Install Dependencies

```bash
# Backend (includes multer for image uploads)
cd backend
npm install

# Frontend (includes react-markdown, remark-gfm for chat markdown)
cd ../frontend
npm install
```

### 3. Configure Environment

**Backend** (`backend/.env`):
```bash
cd ../backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=3001
NODE_ENV=development
AUTH_TOKEN=your-secure-token-here
OPENCLAW_WS_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-openclaw-token
```

**Frontend** (`frontend/.env.local`):
```bash
cd ../frontend
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
```

### 4. Run Development Servers

**Option A: Manual (two terminals)**

Terminal 1 - Backend:
```bash
cd backend
npm start
# Backend running on http://localhost:3001
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:3000
```

**Option B: Service (Linux only)**

```bash
# One-time setup
./service.sh install

# Start both services
./service.sh start

# Check status
./service.sh status

# View logs
./service.sh logs
```

### 5. Access Dashboard

Open browser to **http://localhost:3000**

You should see:
- Kanban board with sample tasks
- 4 sample agents (WhatsApp, Telegram, Discord, Job Search)
- Budget, work, and jobs widgets
- Live connection indicator in header

## Production Deployment

### Using Systemd Services (Recommended for Linux)

1. **Install services:**
   ```bash
   ./service.sh install
   ```

2. **Enable auto-start on boot:**
   ```bash
   ./service.sh enable-boot
   ```

3. **Start services:**
   ```bash
   ./service.sh start
   ```

4. **Verify running:**
   ```bash
   ./service.sh status
   ```

Services will:
- Start automatically on boot (if enabled)
- Restart on failure (10 second delay)
- Log to systemd journal

### Using PM2 (Cross-platform)

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start server.js --name clawmander-backend

# Start frontend
cd ../frontend
pm2 start npm --name clawmander-frontend -- run dev

# Save configuration
pm2 save

# Enable startup
pm2 startup
```

### Using Docker (Future)

Docker support planned. See GitHub issues.

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `AUTH_TOKEN` | Yes | `changeme` | Bearer token for write endpoints |
| `OPENCLAW_WS_URL` | No | `ws://127.0.0.1:18789` | OpenClaw WebSocket URL |
| `OPENCLAW_TOKEN` | No | `''` | OpenClaw authentication token |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `''` (uses Next.js proxy) | Backend API URL |

## Port Configuration

Default ports:
- **Backend API**: 3001
- **Frontend**: 3000
- **OpenClaw WS**: 18789

To change ports:
1. Update `backend/.env` → `PORT=<new-port>`
2. Update `frontend/next.config.js` → rewrites destination
3. Update systemd service files (if using services)

## Initial Data

On first run, the backend auto-seeds:
- **4 sample agents**: WhatsApp, Telegram, Discord, Job Search
- **6 sample tasks**: Various statuses and priorities

Seed data is saved to `backend/storage/data/*.json` (gitignored).

To reset data:
```bash
cd backend/storage/data
rm -f *.json
# Restart backend to reseed
```

## Firewall Configuration

If accessing from other devices:

```bash
# Allow backend port
sudo ufw allow 3001/tcp

# Allow frontend port
sudo ufw allow 3000/tcp
```

Update `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://your-server-ip:3001
```

## Health Checks

Verify services are running:

```bash
# Backend health
curl http://localhost:3001/api/health
# Expected: {"status":"ok","uptime":123.45,"sseClients":0}

# Agent status
curl http://localhost:3001/api/agents/status
# Expected: [array of agents]

# Tasks
curl http://localhost:3001/api/tasks
# Expected: [array of tasks]
```

## Upgrading

```bash
# Pull latest
git pull origin main

# Update backend dependencies
cd backend
npm install

# Update frontend dependencies
cd ../frontend
npm install

# Restart services
cd ..
./service.sh restart
```

## Uninstalling

### Remove Services
```bash
./service.sh uninstall
```

### Remove Data
```bash
rm -rf backend/storage/data/*.json
```

### Remove Installation
```bash
cd ~/sandbox/personal
rm -rf clawmander
```

## Next Steps

- [Architecture Documentation](./ARCHITECTURE.md)
- [Development Guide](./DEVELOPMENT.md)
- [OpenClaw Integration](./OPENCLAW_INTEGRATION.md)
- [API Reference](./API.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
