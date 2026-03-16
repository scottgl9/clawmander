# Nginx Setup — Single-Hostname Reverse Proxy

All services share one Tailscale hostname (`scottgl-aipc.taile589de.ts.net`) with nginx routing by path. TLS is terminated at nginx using Tailscale-managed certificates.

## Services and ports

| Service | Local port | nginx path |
|---------|-----------|------------|
| Clawmander frontend (Next.js) | 3000 | `/` |
| Clawmander backend API | 3001 | `/api/` |
| Clawmander SSE | 3001 | `/api/sse/` |
| OpenClaw Gateway | 18789 | `/openclaw/` (Control UI) and `/` (WebSocket) |
| Matrix Synapse | 8008 | `/_matrix/`, `/_synapse/`, `/.well-known/matrix/` |

## Prerequisites

- nginx installed (`sudo apt install nginx`)
- Tailscale running with HTTPS certificates
- All backend services running on their respective ports

### Tailscale certificates

```bash
sudo tailscale cert \
  --cert-file /etc/ssl/tailscale/scottgl-aipc.taile589de.ts.net.crt \
  --key-file  /etc/ssl/tailscale/scottgl-aipc.taile589de.ts.net.key \
  scottgl-aipc.taile589de.ts.net
```

Certificates auto-renew. See `docs/PWA.md` for the renewal cron setup.

## Deploying the config

The canonical nginx config lives in this repo at `nginx-clawmander.conf`.

```bash
sudo cp nginx-clawmander.conf /etc/nginx/sites-available/clawmander
sudo ln -sf /etc/nginx/sites-available/clawmander /etc/nginx/sites-enabled/clawmander
sudo nginx -t && sudo systemctl reload nginx
```

## Key design decisions

### Root-path WebSocket routing (Android app compatibility)

The OpenClaw Android app constructs WebSocket URLs as `wss://host:port` with **no path
component** (hardcoded in `GatewaySession.kt`). This means WebSocket upgrade requests
arrive at `/`, which would normally proxy to the Next.js frontend and fail with 502.

The fix uses nginx `map` directives to inspect the `Upgrade` header and route accordingly:

```nginx
map $http_upgrade $root_backend {
    websocket http://127.0.0.1:18789;   # WS upgrades -> OpenClaw Gateway
    default   http://127.0.0.1:3000;    # Normal HTTP -> Next.js
}
```

This means:
- **Browser visiting `https://scottgl-aipc.taile589de.ts.net/`** → Clawmander frontend
- **Android app connecting `wss://scottgl-aipc.taile589de.ts.net`** → OpenClaw Gateway

### OpenClaw behind a basePath

OpenClaw Gateway is configured with `controlUi.basePath: "/openclaw"` so the Control UI
is served at `/openclaw/`. The nginx block preserves the path when proxying:

```nginx
location /openclaw/ {
    proxy_pass http://127.0.0.1:18789/openclaw/;
    ...
}
```

### Required forwarded headers

OpenClaw Gateway needs these headers to trust the reverse proxy (per OpenClaw docs
§18 Reverse proxy setup):

- `Host` — original hostname
- `X-Forwarded-For` — real client IP
- `X-Forwarded-Proto` — `https`
- `X-Forwarded-Host` — original hostname (used for origin validation)

The gateway config must include `trustedProxies: ["127.0.0.1", "::1"]` for these to be
honoured.

### SSE endpoint

The `/api/sse/` block disables buffering (`proxy_buffering off`) and gzip to ensure
Server-Sent Events stream without delay. It has a separate 1-hour read timeout.

## OpenClaw Gateway config requirements

In `/home/clawmander/openclaw.json`, the `gateway` section must have:

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "trustedProxies": ["127.0.0.1", "::1"],
    "controlUi": {
      "basePath": "/openclaw",
      "allowedOrigins": [
        "http://localhost:18789",
        "http://127.0.0.1:18789",
        "https://scottgl-aipc.taile589de.ts.net"
      ]
    },
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    }
  }
}
```

Key settings:
- `bind: "loopback"` — only listen on 127.0.0.1; nginx handles external traffic
- `trustedProxies` — accept `X-Forwarded-*` from nginx
- `controlUi.basePath` — serve UI at `/openclaw/` instead of `/`
- `tailscale.mode: "off"` — prevent Tailscale Serve from hijacking port 443

## Tailscale Serve must be disabled

If a stale Tailscale Serve rule exists (`tailscale serve status`), it intercepts all HTTPS
traffic to the hostname and bypasses nginx entirely. Remove it:

```bash
sudo tailscale serve reset
```

## Verification

```bash
# Clawmander frontend
curl -s https://scottgl-aipc.taile589de.ts.net/ | grep -o '<title>.*</title>'

# OpenClaw Control UI
curl -sI https://scottgl-aipc.taile589de.ts.net/openclaw/

# Matrix
curl -s https://scottgl-aipc.taile589de.ts.net/_matrix/client/versions | head -1

# WebSocket at root (Android app path) — should return 101
curl -sI \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://scottgl-aipc.taile589de.ts.net/

# Tailscale Serve — should show "No serve config"
tailscale serve status
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All paths return OpenClaw UI | Tailscale Serve rule active | `sudo tailscale serve reset` |
| Android app: 502 on WS | Missing `map` blocks in nginx | Redeploy `nginx-clawmander.conf` |
| OpenClaw logs `fwd=n/a` | `trustedProxies` not set or missing `X-Forwarded-Host` | Check gateway config + nginx headers |
| OpenClaw rejects WS with `pairing required` | Device not paired, or origin not in `allowedOrigins` | Approve device: `openclaw devices approve <id>` |
| Matrix returns 502 | Synapse not running on port 8008 | `sudo systemctl status matrix-synapse` |
