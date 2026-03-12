# Virtual Browser System

A persistent, shared browser running on the gateway machine that agents can drive programmatically and the user can view/control from the frontend.

## Architecture

```
Gateway Machine
  └── BrowserManager (orchestrates instances)
        └── BrowserInstance "default" → Chromium (persistent profile ~/.openclaw/browser-profiles/default/)
        └── BrowserInstance "agent-xyz" → Chromium (persistent profile ~/.openclaw/browser-profiles/agent-xyz/)
  └── WebSocket /ws/browser/:id (JPEG frame streaming + user input)
  └── REST /api/browser/* (agent tools + CRUD)
  └── SSE (browser.* events for UI state)
```

**Key design decisions:**
- Each instance uses `chromium.launchPersistentContext()` with its own profile directory — cookies, localStorage, and sessions persist across restarts.
- Binary WebSocket frames (JPEG bytes, not base64-in-JSON) for half the bandwidth.
- CDP `Page.startScreencast` only active when viewers are connected.
- Control modes (`agent` | `user` | `shared`) enable human-in-the-loop hand-off.

## Setup

### Install Chromium

```bash
cd backend
npm install
npx playwright install chromium
```

### Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `BROWSER_MAX_INSTANCES` | `5` | Maximum concurrent browser instances |
| `BROWSER_IDLE_TIMEOUT_MS` | `1800000` (30min) | Idle timeout before auto-destroying instance |
| `BROWSER_PROFILE_DIR` | `~/.openclaw/browser-profiles` | Directory for persistent browser profiles |

## REST API Reference

All endpoints require authentication via `Authorization: Bearer <token>` header.

### List Instances
```
GET /api/browser
→ [{ id, url, controlMode, viewers, lastActivity, viewport }]
```

### Create Instance
```
POST /api/browser
Body: { "id": "my-browser" }  (optional, auto-generated if omitted)
→ 201 { id, url, controlMode, viewers, lastActivity, viewport }
→ 409 if ID already exists
→ 429 if max instances reached
```

### Get Instance Detail
```
GET /api/browser/:id
→ { id, url, controlMode, viewers, lastActivity, viewport }
→ 404 if not found
```

### Destroy Instance
```
DELETE /api/browser/:id
→ { ok: true }
→ 404 if not found
```

### Navigate
```
POST /api/browser/:id/navigate
Body: { "url": "https://example.com" }
→ { url, title }
```

### Click
```
POST /api/browser/:id/click
Body: { "x": 100, "y": 200 }  or  { "selector": "#button" }
→ { ok: true }
```

### Type Text
```
POST /api/browser/:id/type
Body: { "text": "hello world" }
→ { ok: true }
```

### Press Key
```
POST /api/browser/:id/key
Body: { "key": "Enter" }
→ { ok: true }
```

### Scroll
```
POST /api/browser/:id/scroll
Body: { "x": 640, "y": 400, "delta": -300 }
→ { ok: true }
```

### Screenshot
```
POST /api/browser/:id/screenshot
→ { image: "<base64 PNG>", width: 1280, height: 800 }
```

### Evaluate JavaScript
```
POST /api/browser/:id/evaluate
Body: { "script": "document.title" }
→ { result: "Page Title" }
```

### Get Page Content
```
POST /api/browser/:id/content
Body: { "selector": "#main" }  (optional)
→ { text: "...", html: "..." }
```

### Wait for Selector
```
POST /api/browser/:id/wait
Body: { "selector": ".loaded", "timeout": 5000 }
→ { found: true }
```

### Set Control Mode
```
POST /api/browser/:id/control
Body: { "mode": "agent", "reason": "Automated browsing" }
→ { ok: true, mode: "agent" }
```

### Request User Control (Blocking)
```
POST /api/browser/:id/request-user-control
Body: { "reason": "Please complete 2FA" }
→ Blocks until user clicks "Hand Back to Agent"
→ { timedOut: false }  or  { timedOut: true } (after 5min)
```

## WebSocket Protocol

Connect to `/ws/browser/:id`. Frames are binary (JPEG); control messages are JSON.

### Server → Client

| Type | Format | Description |
|---|---|---|
| (binary) | Raw JPEG bytes | Screencast frame |
| `connected` | JSON | Initial connection info: `{ type, id, url, title, controlMode, viewport }` |
| `meta` | JSON | URL/title update: `{ type, url, title, controlMode }` |
| `control` | JSON | Control mode change: `{ type, mode, reason }` |
| `agent-message` | JSON | Agent needs help: `{ type, message }` |

### Client → Server

| Type | Fields | Description |
|---|---|---|
| `navigate` | `{ url }` | Navigate to URL |
| `click` | `{ x, y }` | Click (normalized 0-1 coordinates) |
| `type` | `{ text }` | Type text |
| `key` | `{ key }` | Press key |
| `scroll` | `{ x, y, delta }` | Scroll (normalized coords + deltaY) |
| `mousemove` | `{ x, y }` | Mouse move (normalized) |
| `take-control` | `{}` | User takes control |
| `release-control` | `{}` | User releases control back to agent |

Input from WebSocket is dropped when `controlMode === 'agent'`.

## SSE Events

| Event | Data | Description |
|---|---|---|
| `browser.created` | Instance info | New instance created |
| `browser.destroyed` | `{ id }` | Instance destroyed |
| `browser.control_changed` | `{ id, mode, reason }` | Control mode changed |
| `browser.url_changed` | `{ id, url }` | Browser navigated |

## Agent Tool Usage Examples

### Basic Navigation
```bash
# Create an instance
curl -X POST localhost:3001/api/browser \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"id":"research"}'

# Navigate to a page
curl -X POST localhost:3001/api/browser/research/navigate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"url":"https://example.com"}'

# Take a screenshot
curl -X POST localhost:3001/api/browser/research/screenshot \
  -H 'Authorization: Bearer <token>'

# Get page text
curl -X POST localhost:3001/api/browser/research/content \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"selector":"body"}'
```

### Human-in-the-Loop Hand-off

1. Agent navigates to a login page
2. Agent calls `POST /api/browser/:id/request-user-control` with `{ "reason": "Please log in" }`
3. Frontend shows amber banner: "Agent needs your help: Please log in"
4. User logs in manually via the browser canvas
5. User clicks "Hand Back to Agent"
6. The `request-user-control` endpoint returns `{ timedOut: false }`
7. Agent continues automated work

## Multi-Instance Usage

Each agent can create its own browser instance. All instances are listed in the frontend with tabbed navigation. Instances auto-destroy after 30 minutes of inactivity (no viewers and no agent API calls).

## Troubleshooting

- **"Failed to load playwright"**: Run `cd backend && npm install && npx playwright install chromium`
- **Chromium crashes**: Try increasing shared memory: `--disable-dev-shm-usage` (already set by default)
- **Blank canvas**: Check that the WebSocket connection is established (green status indicator)
- **"Maximum browser instances reached"**: Destroy unused instances or increase `BROWSER_MAX_INSTANCES`
- **Stale sessions**: Browser profiles persist in `~/.openclaw/browser-profiles/`. Delete the profile directory to reset.
