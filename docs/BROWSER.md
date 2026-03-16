# Clawmander Virtual Browser

## Vision

A persistent, shared browser instance running on the gateway machine that both OpenClaw agents and the human user can access simultaneously. The browser is a **collaboration surface** — agents do the automated work, and the user steps in when human presence is required (login, CAPTCHA, 2FA, consent flows).

---

## Core Concept

```
Gateway machine (scottgl-aipc)
  └── Chromium (headless, persistent profile)
        ↕ CDP (Chrome DevTools Protocol)
  └── BrowserService (Node.js)
        ↕ WebSocket (/ws/browser)
  └── OpenClaw Agent ──→ browser tools (navigate, click, type, screenshot, scrape)
        ↕
  └── Clawmander Frontend (any Tailscale node)
        └── <BrowserPanel> — live view, URL bar, mouse/keyboard passthrough
```

The browser runs **headless but persistent** on the gateway. Its state (cookies, sessions, localStorage) survives across agent tasks. Agents can navigate and interact programmatically. The user can watch and take over at any time via the frontend panel.

---

## Use Cases

### Agent-driven
- Web research: navigate, read, extract structured data
- Form filling: fill and submit forms on behalf of the user
- Monitoring: check dashboards, prices, statuses on a schedule
- Automation: multi-step workflows (purchase flows, booking, etc.)
- Screenshot capture: visual confirmation of agent actions

### Human-assisted
- **Login hand-off**: agent hits a login wall → notifies user → user logs in via the panel → agent resumes
- **CAPTCHA / 2FA**: agent pauses, user solves in the live view, agent continues
- **Confirmation gates**: agent presents a prefilled form → user reviews and submits
- **Guided exploration**: user navigates to a page → hands control back to agent for scraping/interaction

### Collaborative
- Agent navigates to a complex page, highlights elements it's uncertain about, asks user to confirm before clicking
- User opens a page manually, agent takes over to fill/extract
- Shared session state: agent logs in once (with user help), agent reuses session for subsequent tasks

---

## Architecture

### Backend: BrowserService

`backend/services/BrowserService.js`

- Launches a **persistent Chromium instance** via Playwright with a named profile directory (survives restarts)
- Uses **CDP Page.startScreencast** for efficient JPEG frame streaming
- Exposes a **control API** used by both agent tools and the WebSocket handler:
  - `navigate(url)`
  - `click(x, y)`
  - `type(text)`
  - `scroll(x, y, deltaY)`
  - `screenshot()` → base64 PNG
  - `getPageContent()` → HTML / text / DOM snapshot
  - `evaluate(js)` → run arbitrary JS in page context
  - `waitForSelector(selector, timeout)`
  - `getCurrentUrl()` / `getTitle()`
- Manages **control mode**: `agent` | `user` | `shared`
  - In `agent` mode: user input from frontend is ignored
  - In `user` mode: agent actions are queued but not executed
  - In `shared` mode: both active (last-write-wins, visually indicated)
- Emits **events** over an internal EventEmitter: `frame`, `url-changed`, `page-loaded`, `control-changed`, `browser-message`

### Backend: WebSocket Endpoint

`backend/routes/browser.js` → `/ws/browser`

**Server → Client messages:**
```jsonc
{ "type": "frame", "data": "<base64 JPEG>", "width": 1280, "height": 800 }
{ "type": "url", "url": "https://example.com" }
{ "type": "control", "mode": "agent" | "user" | "shared", "reason": "Login required" }
{ "type": "agent-message", "text": "I need you to log in to continue." }
{ "type": "page-loaded", "url": "...", "title": "..." }
{ "type": "cursor", "x": 0.5, "y": 0.3 }  // agent cursor position (normalized 0–1)
```

**Client → Server messages:**
```jsonc
{ "type": "navigate", "url": "https://..." }
{ "type": "click", "x": 0.4, "y": 0.6 }    // normalized coordinates
{ "type": "type", "text": "hello" }
{ "type": "key", "key": "Enter" }
{ "type": "scroll", "x": 0.5, "y": 0.5, "delta": -300 }
{ "type": "take-control" }   // user requests control
{ "type": "release-control" } // user hands back to agent
```

### Frontend: BrowserPanel Component

`frontend/src/components/browser/BrowserPanel.js`

- **Canvas element** rendering incoming JPEG frames at native resolution
- **URL bar** showing current URL, editable to navigate
- **Control indicator**: colored badge — 🤖 Agent / 👤 You / 🤝 Shared
- **Take Control / Hand Back** button
- **Agent message overlay**: when agent needs user help, shows a prominent banner with context (e.g. "Please log in to Gmail to continue")
- **Agent cursor ghost**: semi-transparent dot showing where the agent last clicked
- Input forwarding:
  - Mouse: `click`, `mousemove` (for hover), `wheel` for scroll
  - Keyboard: captured when panel is focused
  - Coordinates normalized to 0–1, denormalized server-side against actual viewport

### Frontend: Browser Page / Tab

`frontend/src/pages/browser.js`

- Dedicated `/browser` route in the UI
- Can also be embedded as a drawer/panel alongside the chat UI
- Connection status, reconnect on drop
- History/back/forward buttons (calls `window.history` equivalent via CDP)

---

## Agent Integration

### OpenClaw Tool Interface

Agents access the browser via a set of tools exposed through the backend:

```
browser_navigate(url)
browser_click(selector | {x, y})
browser_type(text)
browser_screenshot() → base64
browser_get_text(selector?) → string
browser_evaluate(js) → any
browser_wait_for(selector, timeout?)
browser_request_user_control(reason) → waits until user releases
browser_get_current_url() → string
```

`browser_request_user_control(reason)` is the key human-in-the-loop primitive:
1. Agent calls it with a reason string ("Login required for Gmail")
2. BrowserService switches mode to `user`, emits `control` event with the reason
3. Frontend shows prominent banner: "Agent needs your help: Login required for Gmail"
4. User performs the action in the live browser panel
5. User clicks "Done / Hand Back"
6. BrowserService switches mode back to `agent`, tool resolves
7. Agent continues

### Wiring into OpenClaw

These tools are registered as capabilities on agents that have browser access. Only agents explicitly granted `browser` capability can call them. The gateway exposes a `/browser-tools` internal API that the OpenClaw runtime calls.

---

## Session Persistence

- Chromium runs with a **named user data directory** (`~/.openclaw/browser-profile/`)
- Cookies, localStorage, and logged-in sessions persist across gateway restarts
- Profile is per-gateway-machine (not per-user — this is a single-user setup)
- Optional: multiple named profiles for different identities/contexts

---

## Security Considerations

- The `/ws/browser` endpoint is only accessible to authenticated Clawmander users
- Agent browser access is gated by capability config in `openclaw.json`
- No public exposure — all traffic over Tailscale
- User can always take control and override agent actions
- Sensitive pages (password managers, banking) should be noted in agent instructions as off-limits unless user-initiated

---

## Implementation Phases

### Phase 1 — Live View (MVP)
- BrowserService with Playwright + CDP screencast
- `/ws/browser` WebSocket (frames only, no input yet)
- `<BrowserPanel>` canvas rendering frames
- `/browser` page in frontend
- URL bar (read-only display)

### Phase 2 — User Control
- Input forwarding (click, type, scroll, key)
- Editable URL bar with navigate
- Take Control / Release buttons
- Control mode indicator

### Phase 3 — Agent Tools
- `browser_*` tool functions in BrowserService
- OpenClaw tool registration
- Agent cursor ghost overlay in frontend
- `browser_request_user_control` hand-off flow

### Phase 4 — Polish
- Agent message overlay / banner
- Session persistence (named profile)
- Multiple tab support
- Back/forward/reload controls
- Keyboard shortcut to toggle browser panel alongside chat

---

## File Layout

```
backend/
  services/
    BrowserService.js        ← core Playwright + CDP service
  routes/
    browser.js               ← /ws/browser WebSocket handler
  tools/
    browserTools.js          ← agent tool definitions

frontend/
  src/
    pages/
      browser.js             ← /browser route
    components/
      browser/
        BrowserPanel.js      ← canvas + controls
        ControlBadge.js      ← agent/user/shared indicator
        AgentMessageBanner.js ← "agent needs help" overlay
        UrlBar.js            ← address bar component
    hooks/
      useBrowser.js          ← WebSocket connection + state
```

---

## Dependencies to Add

```
backend:  playwright (already likely present), ws (already used)
frontend: none (canvas API is native)
system:   chromium-browser or chromium (apt) on the gateway machine
```

---

*Written: 2026-03-11*
