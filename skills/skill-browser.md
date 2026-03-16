# Skill: Virtual Browser

Drive a persistent headless browser via REST API. Use this for web research, form filling, monitoring, and any task that requires navigating real web pages. The user can see your browser activity in real-time on the Clawmander UI.

**Base URL**: `http://localhost:3001`
**Auth**: Browser endpoints require auth via `anyAuth`:
- `Authorization: Bearer <AUTH_TOKEN>` (agent token), or
- `Authorization: Bearer <JWT_ACCESS_TOKEN>` (logged-in user token)

---

## Key Concepts

- **Live viewer socket**: browser live-view/control is available at `ws://<host>/ws/browser/:id`.
- **REST vs WS split**: use REST (`/api/browser/...`) for deterministic agent actions; use WS for interactive live control/observability.

- **Instances**: Each browser instance is an isolated Chrome process with its own cookies, localStorage, and session. Create one per task or reuse the `default` instance.
- **Persistent profiles**: Sessions survive restarts. Cookies and logins are preserved in `~/.openclaw/browser-profiles/<id>/`.
- **Stealth mode**: The browser uses the system-installed Google Chrome with anti-detection patches (spoofed navigator properties, WebGL, Client Hints). Google search, Maps, and most sites work without CAPTCHA or robot detection.
- **Control modes**: `shared` (default — both agent and user can interact), `agent` (user input blocked), `user` (agent has handed control to the user).
- **Human-in-the-loop**: When you encounter a login page, CAPTCHA, or 2FA, call `request-user-control` to hand the browser to the user. The call blocks until the user clicks "Hand Back".

---

## Instance Lifecycle

### Create Instance

```
POST /api/browser
Content-Type: application/json

{ "id": "my-research" }
```

Response `201`:
```json
{ "id": "my-research", "url": "about:blank", "controlMode": "shared", "viewers": 0 }
```

Omit `id` to auto-generate one. Returns `409` if the ID already exists, `429` if the max instance limit (5) is reached.

### List Instances

```
GET /api/browser
```

Returns an array of instance info objects.

### Get Instance Detail

```
GET /api/browser/:id
```

### Destroy Instance

```
DELETE /api/browser/:id
```

---

## Navigation

### Navigate to URL

```
POST /api/browser/:id/navigate
Content-Type: application/json

{ "url": "https://example.com" }
```

Response: `{ "url": "https://example.com/", "title": "Example Domain" }`

The `url` field accepts bare domains (e.g. `example.com`) — `https://` is added automatically.

---

## Reading Page Content

### Get Page Text/HTML

```
POST /api/browser/:id/content
Content-Type: application/json

{ "selector": "#main-content" }
```

Response: `{ "text": "...", "html": "..." }`

Omit `selector` to get the full page body. **Use this to read what's on the page** — it's much more reliable than screenshots for extracting data.

### Take Screenshot

```
POST /api/browser/:id/screenshot
```

Response: `{ "image": "<base64 PNG>", "width": 1280, "height": 800 }`

Use screenshots to understand visual layout, verify actions worked, or when text extraction isn't sufficient.

### Evaluate JavaScript

```
POST /api/browser/:id/evaluate
Content-Type: application/json

{ "script": "document.querySelectorAll('a').length" }
```

Response: `{ "result": 42 }`

The script runs in the page context. Return values must be JSON-serializable.

### Wait for Element

```
POST /api/browser/:id/wait
Content-Type: application/json

{ "selector": ".results-loaded", "timeout": 10000 }
```

Response: `{ "found": true }` or `{ "found": false }` if timeout.

Default timeout is 5000ms. Use this after navigation or clicks to wait for dynamic content to load.

---

## Interaction

### Click

By CSS selector (preferred — more reliable):
```
POST /api/browser/:id/click
Content-Type: application/json

{ "selector": "button.submit" }
```

By pixel coordinates:
```
POST /api/browser/:id/click
Content-Type: application/json

{ "x": 640, "y": 400 }
```

### Type Text

Types text character-by-character into the currently focused element:
```
POST /api/browser/:id/type
Content-Type: application/json

{ "text": "hello world" }
```

### Press Key

Press a single key or key combination:
```
POST /api/browser/:id/key
Content-Type: application/json

{ "key": "Enter" }
```

Common keys: `Enter`, `Tab`, `Escape`, `Backspace`, `ArrowDown`, `ArrowUp`, `Space`, `Delete`

### Scroll

```
POST /api/browser/:id/scroll
Content-Type: application/json

{ "x": 640, "y": 400, "delta": 300 }
```

Positive `delta` scrolls down, negative scrolls up. `x`/`y` are the mouse position for the scroll event.

---

## Control Modes & Human-in-the-Loop

### Set Control Mode

```
POST /api/browser/:id/control
Content-Type: application/json

{ "mode": "agent", "reason": "Filling out search form" }
```

Modes: `shared`, `agent`, `user`

### WebSocket interactive actions (live panel)
When connected to `ws://<host>/ws/browser/:id`, the frontend/live client can send:
- `navigate` (`{ type:"navigate", url }`)
- `back`, `forward`, `reload`
- `click` (`x`,`y` normalized 0..1)
- `type`, `key`
- `scroll` (`x`,`y`,`delta`)
- `mousemove`
- `take-control`, `release-control`

Use REST endpoints for scriptable agent workflows; use WS actions for user live steering.
### Request User Control (Blocking)

**This is the key endpoint for human-in-the-loop.** Call this when you need the user to intervene (login, CAPTCHA, 2FA, manual selection). The request **blocks** until the user clicks "Hand Back to Agent" in the UI.

```
POST /api/browser/:id/request-user-control
Content-Type: application/json

{ "reason": "Please log in to your account" }
```

Response (after user hands back): `{ "timedOut": false }`

Times out after 5 minutes with `{ "timedOut": true }` and control returns to shared mode.

---

## Common Patterns

### Web Research

```bash
BASE=http://localhost:3001
TOKEN=changeme
ID=research

# 1. Create a browser instance
curl -s -X POST $BASE/api/browser \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$ID\"}"

# 2. Navigate to a search engine
curl -s -X POST $BASE/api/browser/$ID/navigate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.google.com"}'

# 3. Type a search query
curl -s -X POST $BASE/api/browser/$ID/click \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":"textarea[name=q]"}'

curl -s -X POST $BASE/api/browser/$ID/type \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Austin TX weather"}'

curl -s -X POST $BASE/api/browser/$ID/key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"Enter"}'

# 4. Wait for results to load
curl -s -X POST $BASE/api/browser/$ID/wait \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":"#search"}'

# 5. Read the results
curl -s -X POST $BASE/api/browser/$ID/content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":"#search"}'

# 6. Clean up when done
curl -s -X DELETE $BASE/api/browser/$ID \
  -H "Authorization: Bearer $TOKEN"
```

### Login with User Help

```bash
# 1. Navigate to login page
curl -s -X POST $BASE/api/browser/$ID/navigate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://app.example.com/login"}'

# 2. Hand off to user — this BLOCKS until user is done
curl -s -X POST $BASE/api/browser/$ID/request-user-control \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Please log in to your Example account. Click Hand Back when done."}'

# 3. Control returns here after user clicks "Hand Back"
# Continue with authenticated actions...
curl -s -X POST $BASE/api/browser/$ID/content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":".dashboard"}'
```

### Form Filling

```bash
# Click a field, type into it, tab to next
curl -s -X POST $BASE/api/browser/$ID/click \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":"input[name=email]"}'

curl -s -X POST $BASE/api/browser/$ID/type \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"user@example.com"}'

curl -s -X POST $BASE/api/browser/$ID/key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"Tab"}'

curl -s -X POST $BASE/api/browser/$ID/type \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"some value"}'

# Submit the form
curl -s -X POST $BASE/api/browser/$ID/click \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selector":"button[type=submit]"}'
```

---

## Best Practices

1. **Prefer `selector` clicks over coordinates** — selectors are stable across page layouts
2. **Always `wait` after navigation or clicks** that trigger page loads — don't assume content is ready
3. **Use `content` to read data**, not `screenshot` — text extraction is faster and more actionable
4. **Use `screenshot` to verify** visual state when text alone is ambiguous
5. **Request user control early** for login/auth — don't try to automate credentials
6. **Reuse instances** when working on the same site — cookies persist, so you stay logged in
7. **Destroy instances** when done to free resources (max 5 concurrent)
8. **Set control mode to `agent`** during multi-step automation to prevent user interference, then switch back to `shared` when idle
9. **Google search works** — the browser has stealth anti-detection, so you can search Google directly without triggering CAPTCHA. Use `textarea[name=q]` as the search input selector
10. **If you hit a CAPTCHA despite stealth** — call `request-user-control` with a reason like "Please solve the CAPTCHA" rather than retrying
