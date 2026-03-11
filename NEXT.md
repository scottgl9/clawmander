# Next Steps — SSE Fix & Backend Localhost-Only

## Deploy the Changes

```bash
# 1. Reload nginx (picks up SSE location block fix)
sudo nginx -s reload

# 2. Rebuild frontend (regenerates public/sw.js with custom worker bypass)
cd frontend && npm run build

# 3. Restart backend (binds to 127.0.0.1 instead of 0.0.0.0)
# e.g.: pm2 restart clawmander-backend
```

## Verify

1. Open `https://scottgl-aipc.taile589de.ts.net` in browser
2. DevTools → Application → Service Workers → **Unregister** old SW → hard reload
3. Header should show **Connected** (green dot)
4. Send a chat message — response should stream back in real time
5. Confirm backend is no longer reachable directly on port 3001 from another machine

## What Was Changed

| File | Change |
|------|--------|
| `nginx-clawmander.conf` | Replaced `chunked_transfer_encoding on` with `gzip off` + `add_header X-Accel-Buffering no` in SSE location |
| `frontend/next.config.js` | Added `customWorkerDir: 'worker'`; removed SSE `NetworkOnly` entry from `runtimeCaching` |
| `frontend/worker/index.js` | New file — bypasses Workbox for `/api/sse/` requests with raw `fetch()` |
| `backend/server.js` | Changed bind address from `0.0.0.0` to `127.0.0.1` |
