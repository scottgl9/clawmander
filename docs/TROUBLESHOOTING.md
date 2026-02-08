# Troubleshooting Guide

Common issues and solutions for Clawmander Dashboard.

## Installation Issues

### npm install fails

**Symptom**: `npm install` throws errors

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use specific Node version (18+)
node --version  # Check version
nvm use 18      # If using nvm
```

### Permission denied

**Symptom**: `EACCES: permission denied`

**Solutions**:
```bash
# Don't use sudo with npm
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Or reinstall Node via nvm (recommended)
```

## Backend Issues

### Backend won't start

**Symptom**: `npm start` exits immediately or throws error

**Check 1 - Port already in use**:
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process using port
kill -9 <PID>

# Or change port in .env
PORT=3002
```

**Check 2 - Missing .env file**:
```bash
cd backend
ls -la .env  # Should exist

# If missing, copy example
cp .env.example .env
```

**Check 3 - Invalid Node version**:
```bash
node --version
# Should be 18+

# Upgrade Node if needed
```

### OpenClaw connection errors

**Symptom**: `[OpenClaw] Error: connect ECONNREFUSED 127.0.0.1:18789`

**This is normal** if OpenClaw isn't running. The collector will keep trying to reconnect.

**To verify OpenClaw is running**:
```bash
# Check if OpenClaw WebSocket is listening
lsof -i :18789

# Or try connecting manually
wscat -c ws://127.0.0.1:18789
```

**If OpenClaw should be running**:
```bash
# Start OpenClaw (adjust path as needed)
cd ~/openclaw
./start.sh
```

### Tasks not persisting

**Symptom**: Tasks disappear on restart

**Check data directory**:
```bash
cd backend/storage/data
ls -la
# Should see: tasks.json, agents.json, etc.

# Check permissions
chmod 755 backend/storage
chmod 755 backend/storage/data
```

**Check for write errors**:
```bash
# View backend logs
journalctl --user -u clawmander-backend -n 50
# Or if running manually, check console output
```

### SSE not working

**Symptom**: Frontend shows "Disconnected"

**Check 1 - Backend is running**:
```bash
curl http://localhost:3001/api/health
# Should return JSON
```

**Check 2 - SSE endpoint accessible**:
```bash
curl -N http://localhost:3001/api/sse/subscribe
# Should keep connection open
```

**Check 3 - CORS issues**:
```bash
# Check browser console for CORS errors
# If accessing from different origin, update backend CORS config
```

### Auth errors

**Symptom**: `401 Unauthorized` or `403 Forbidden`

**Check Authorization header**:
```bash
# Test with correct token
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","task":{"title":"Test"}}'

# Check .env has AUTH_TOKEN set
cat backend/.env | grep AUTH_TOKEN
```

## Frontend Issues

### Frontend won't start

**Symptom**: `npm run dev` fails

**Check 1 - Port 3000 in use**:
```bash
lsof -i :3000
kill -9 <PID>
```

**Check 2 - Dependencies installed**:
```bash
cd frontend
npm install
```

**Check 3 - Next.js cache**:
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Frontend shows blank page

**Symptom**: http://localhost:3000 loads but shows nothing

**Check browser console**:
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

**Common fixes**:
```bash
# Rebuild frontend
cd frontend
rm -rf .next
npm run build
npm run dev
```

### API calls fail (404)

**Symptom**: Frontend shows errors, Network tab shows 404

**Check backend is running**:
```bash
curl http://localhost:3001/api/health
```

**Check Next.js proxy config** (`frontend/next.config.js`):
```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3001/api/:path*',
    },
  ];
}
```

**Or set NEXT_PUBLIC_API_URL** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Real-time updates not working

**Symptom**: Tasks don't update automatically

**Check SSE connection**:
- Open browser DevTools → Network tab
- Filter for "sse/subscribe"
- Should show "pending" (stays open)

**Check EventSource**:
```javascript
// In browser console
const es = new EventSource('/api/sse/subscribe');
es.onmessage = (e) => console.log('SSE:', e.data);
```

### Styles not loading

**Symptom**: Page looks unstyled

**Rebuild Tailwind**:
```bash
cd frontend
npm run build
```

**Check globals.css imported** in `_app.js`:
```javascript
import '../styles/globals.css';
```

## Service Issues (Linux)

### Service won't install

**Symptom**: `./service.sh install` fails

**Check systemd user directory**:
```bash
mkdir -p ~/.config/systemd/user
ls -la ~/.config/systemd/user
```

**Check service files exist**:
```bash
ls -la clawmander-*.service
```

### Service won't start

**Symptom**: `./service.sh start` fails

**Check service status**:
```bash
systemctl --user status clawmander-backend
systemctl --user status clawmander-frontend
```

**Check logs**:
```bash
journalctl --user -u clawmander-backend -n 50
journalctl --user -u clawmander-frontend -n 50
```

**Common issues**:
```bash
# WorkingDirectory wrong
# Check paths in service files match your install location

# Node not in PATH
which node
# Update ExecStart in service files with full path

# Permissions
chmod +x backend/server.js
```

### Service keeps restarting

**Symptom**: `systemctl status` shows "activating/auto-restart"

**Check logs for crash reason**:
```bash
journalctl --user -u clawmander-backend -f
```

**Common causes**:
- Missing dependencies: `cd backend && npm install`
- Port in use: Change PORT in .env
- Missing .env file: `cp .env.example .env`

### Can't view logs

**Symptom**: `journalctl` permission denied

**Enable user journal**:
```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
```

**Or check systemd status**:
```bash
loginctl enable-linger $USER
```

## Data Issues

### Lost all tasks/agents

**Check data files**:
```bash
ls -la backend/storage/data/
cat backend/storage/data/tasks.json
```

**Restore from backup** (if you made one):
```bash
cp backup/tasks.json backend/storage/data/
```

**Reseed data**:
```bash
# Delete all data files
rm backend/storage/data/*.json

# Restart backend to reseed
./service.sh restart
```

### Duplicate tasks

**Symptom**: Same task appears multiple times

**Clean up duplicates**:
```bash
# Edit tasks.json manually
nano backend/storage/data/tasks.json

# Remove duplicate entries
# Restart backend
```

### Corrupted JSON

**Symptom**: Backend crashes on startup with JSON parse error

**Check file syntax**:
```bash
cat backend/storage/data/tasks.json | jq .
# If error, file is corrupted
```

**Fix**:
```bash
# Backup corrupted file
cp tasks.json tasks.json.bak

# Reset to empty array
echo "[]" > tasks.json

# Restart backend
```

## Network Issues

### Can't access from other devices

**Symptom**: Works on localhost but not from other machines

**Check firewall**:
```bash
# Allow ports
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw status
```

**Update frontend config**:
```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001
```

**Check backend CORS**:
```javascript
// backend/server.js
app.use(cors({
  origin: '*',  // Allow all origins (dev only!)
}));
```

### WebSocket connection fails

**Symptom**: OpenClaw collector can't connect

**Check URL**:
```bash
# In backend/.env
OPENCLAW_WS_URL=ws://127.0.0.1:18789  # Correct
# Not: http://127.0.0.1:18789           # Wrong
```

**Test connection**:
```bash
# Install wscat if needed
npm install -g wscat

# Test connection
wscat -c ws://127.0.0.1:18789
```

## Performance Issues

### Dashboard slow to load

**Check network tab** in DevTools:
- Slow API calls?
- Large data transfers?

**Optimize**:
```bash
# Use production build
cd frontend
npm run build
npm start
```

### High memory usage

**Check process**:
```bash
ps aux | grep node
```

**Monitor**:
```bash
# Backend memory
pmap $(pgrep -f "node server.js")

# Or use htop
htop -p $(pgrep -f "node server.js")
```

## Build Issues

### Frontend build fails

**Symptom**: `npm run build` errors

**Clear cache**:
```bash
rm -rf .next node_modules
npm install
npm run build
```

**Check for TypeScript errors** (even in .js files):
```bash
npx next build --debug
```

### ESLint errors

**Disable for build** (not recommended):
```javascript
// next.config.js
module.exports = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};
```

## Getting More Help

### Enable Debug Mode

**Backend**:
```bash
# In .env
NODE_ENV=development
DEBUG=*

# Or run with debug
DEBUG=* node server.js
```

**Frontend**:
```bash
# Verbose Next.js output
npm run dev -- --debug
```

### Collect Diagnostic Info

```bash
# System info
uname -a
node --version
npm --version

# Service status
./service.sh status

# Logs
./service.sh logs > clawmander-logs.txt

# File structure
tree -L 3 -I node_modules
```

### Report a Bug

1. Check [existing issues](https://github.com/scottgl9/clawmander/issues)
2. Create new issue with:
   - Symptom description
   - Steps to reproduce
   - Error messages/logs
   - System info (OS, Node version)
   - What you've tried

### Ask for Help

- GitHub Discussions
- Include diagnostic info above
- Be specific about what's not working
