# OpenClaw Gateway Technical Reference

Comprehensive reference for the OpenClaw Gateway WebSocket protocol, as used by Clawmander.

---

## 1. Protocol Overview

- **Transport**: WebSocket (ws:// or wss://)
- **Default Port**: 18789
- **Protocol Version**: 3
- **Message Format**: JSON (newline-delimited frames)
- **Direction**: Bidirectional — clients send RPC requests, gateway sends responses and events

---

## 2. Connection Handshake

The connection handshake is a 3-step process:

### Step 1: Challenge (Gateway → Client)

On WebSocket connect, the gateway may immediately send a challenge:

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "abc123",
    "ts": 1234567890
  }
}
```

On **localhost (127.0.0.1)**, the challenge is optional. If no challenge is received within ~2 seconds, the client should proceed directly to Step 2.

### Step 2: Connect (Client → Gateway)

```json
{
  "type": "req",
  "id": "1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.0.0",
      "platform": "linux",
      "mode": "cli"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write", "operator.admin"],
    "auth": {
      "token": "<OPENCLAW_TOKEN>"
    }
  }
}
```

**Critical requirements:**
- `client.id` **must** be `"cli"` (not a custom value)
- `client.mode` **must** be `"cli"` or `"operator"`
- `auth.token` is **required** for non-localhost connections; on localhost, device pairing is auto-approved

### Step 3: Hello-OK (Gateway → Client)

```json
{
  "type": "res",
  "id": "1",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 3,
    "server": {
      "version": "1.x.x",
      "connId": "conn-uuid"
    },
    "features": {
      "methods": ["chat.send", "chat.history", "sessions.list", "..."],
      "events": ["chat", "presence.update", "start", "end", "..."]
    },
    "snapshot": {
      "presence": [],
      "sessionDefaults": {},
      "uptimeMs": 12345
    },
    "auth": {
      "role": "operator",
      "scopes": ["operator.read", "operator.write", "operator.admin"]
    },
    "policy": {
      "maxPayload": 4194304,
      "tickIntervalMs": 10000
    }
  }
}
```

---

## 3. Frame Types

All messages are JSON objects with a `type` field.

### Request Frame (Client → Gateway)

```json
{
  "type": "req",
  "id": "<unique-string>",
  "method": "<rpc-method>",
  "params": { ... }
}
```

### Response Frame (Gateway → Client)

```json
{
  "type": "res",
  "id": "<matching-request-id>",
  "ok": true,
  "payload": { ... }
}
```

On error:
```json
{
  "type": "res",
  "id": "<matching-request-id>",
  "ok": false,
  "error": {
    "code": "ERR_CODE",
    "message": "Human-readable description",
    "retryable": false,
    "retryAfterMs": 0
  }
}
```

### Event Frame (Gateway → Client)

```json
{
  "type": "event",
  "event": "<event-name>",
  "payload": { ... },
  "seq": 42
}
```

---

## 4. Authentication

### Token-Based Auth

The gateway uses a token configured via `gateway.auth.token` or `OPENCLAW_GATEWAY_TOKEN` environment variable. Pass it in the connect params:

```json
"auth": { "token": "<token>" }
```

### Scopes

| Scope | Permissions |
|---|---|
| `operator.read` | Read-only: status, presence, session list, history |
| `operator.write` | Read + write: send messages, patch sessions, reset sessions |
| `operator.admin` | Read + write + admin: resolve approvals, delete sessions |

The **OpenClawCollector** (passive monitor) uses `operator.read` only.
The **ChatGatewayClient** (interactive) uses `operator.read`, `operator.write`, `operator.admin`.

### Localhost Behavior

- Localhost (127.0.0.1): Challenge is optional; device pairing auto-approved; token required if set
- LAN/Remote: Token **required**; challenge always sent

---

## 5. RPC Methods Reference

### `connect`
Handshake. See Section 2.

---

### `chat.send`

Send a message to an agent session.

**Params:**
```json
{
  "sessionKey": "agent:my-agent:main",
  "message": "Hello, what are you working on?",
  "idempotencyKey": "<uuid>",
  "attachments": [],
  "thinking": "auto",
  "timeoutMs": 120000
}
```

**Response:** `{}` (empty on success; streaming response arrives as `chat` events)

---

### `chat.history`

Retrieve the transcript for a session.

**Params:**
```json
{
  "sessionKey": "agent:my-agent:main",
  "limit": 50
}
```

**Response:** Array of message objects.

---

### `chat.abort`

Abort an active run.

**Params:**
```json
{
  "sessionKey": "agent:my-agent:main",
  "runId": "<optional-run-id>"
}
```

---

### `chat.inject`

Inject a message into a session without triggering a response.

**Params:**
```json
{
  "sessionKey": "agent:my-agent:main",
  "message": "System injection",
  "label": "system"
}
```

---

### `sessions.list`

List available sessions.

**Params:**
```json
{
  "limit": 50,
  "agentId": "my-agent",
  "search": "keyword",
  "includeGlobal": false,
  "includeDerivedTitles": true,
  "includeLastMessage": false
}
```

**Response:** Array of session objects:
```json
[
  {
    "key": "agent:my-agent:main",
    "agentId": "my-agent",
    "displayName": "My Agent",
    "model": "anthropic/claude-opus-4",
    "modelProvider": "anthropic"
  }
]
```

---

### `sessions.resolve`

Find a session by key, ID, or label.

**Params:**
```json
{ "key": "agent:my-agent:main" }
```

---

### `sessions.patch`

Update session settings.

**Params:**
```json
{
  "key": "agent:my-agent:main",
  "model": "anthropic/claude-sonnet-4-5",
  "thinkingLevel": "auto",
  "verboseLevel": "off",
  "elevatedLevel": "ask",
  "responseUsage": "tokens",
  "label": "My Custom Label",
  "sendPolicy": "allow"
}
```

---

### `sessions.reset`

Reset a session (clear context / start fresh).

**Params:**
```json
{
  "key": "agent:my-agent:main",
  "reason": "new"
}
```

`reason` values: `"new"` (new conversation), `"reset"` (full reset)

---

### `sessions.delete`

Delete one or more sessions.

**Params:**
```json
{ "keys": ["agent:my-agent:main"] }
```

---

### `models.list`

List available models.

**Params:** `{}` (empty)

**Response:** Array of model objects:
```json
[
  {
    "id": "anthropic/claude-opus-4",
    "name": "Claude Opus 4",
    "provider": "anthropic"
  }
]
```

---

### `agents.list`

List registered agents.

**Params:** `{}`

---

### `exec.approval-request`

Request approval for a shell command (agent → gateway).

**Params:**
```json
{
  "id": "<approval-uuid>",
  "command": "rm -rf /tmp/build",
  "sessionKey": "agent:my-agent:main",
  "agentId": "my-agent"
}
```

---

### `exec.approval-resolve`

Resolve a pending approval request (operator → gateway).

**Params:**
```json
{
  "id": "<approval-uuid>",
  "decision": "approve"
}
```

`decision` values: `"approve"`, `"deny"`

---

### `status`

Get gateway status snapshot.

**Params:** `{}`

**Response:** Status object including sessions count, heartbeat info, channel summary.

---

### `health`

Get health snapshot.

**Params:** `{}`

---

## 6. Event Types

### `chat` — Streaming response

Emitted for each message delta, final, error, or abort.

```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "state": "delta",
    "runId": "<run-uuid>",
    "sessionKey": "agent:my-agent:main",
    "seq": 5,
    "message": {
      "content": [
        { "type": "text", "text": "Hello! I'm currently " }
      ]
    }
  }
}
```

**States:**
- `delta` — partial text chunk; `message.content[]` contains text blocks
- `final` — run complete; full response in `message`; `usage` field available
- `error` — run failed; `errorMessage` contains description
- `aborted` — run was aborted by operator

---

### `start` / `end` / `error` — Run lifecycle

```json
{
  "type": "event",
  "event": "start",
  "payload": {
    "runId": "<uuid>",
    "sessionKey": "agent:my-agent:main",
    "agentId": "my-agent"
  }
}
```

---

### `presence` / `agent` — Agent presence

```json
{
  "type": "event",
  "event": "presence",
  "payload": {
    "agentId": "my-agent",
    "name": "My Agent",
    "status": "running",
    "lastInputSeconds": 5
  }
}
```

**Status values:** `running` → active, `connected` → active, `idle` → idle, `disconnected` → offline, `error` → error

---

### `connect.challenge` — Pre-connect challenge

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "abc123", "ts": 1234567890 }
}
```

---

### `heartbeat` / `tick` — Periodic updates

Sent on a configurable interval (default 10s). Contains agent health info.

---

## 7. Session Management

### Session Keys

Format: `agent:<agentId>:<kind>` or `agent:<agentId>:subagent:<subagentId>`

Examples:
- `agent:general-agent:main` — main session for general-agent
- `agent:research:main` — main session for research agent
- `agent:general-agent:subagent:researcher` — subagent session

### Session Kinds

- `direct` — Direct 1:1 operator chat session (shown in chat UI)
- `group` — Multi-agent group channel (excluded from chat sidebar)
- `cron` — Scheduled/automated session (excluded from chat sidebar)

Filter to `direct` sessions only for the chat interface.

---

## 8. Presence System

Track working vs idle agents via the `presence` event:

- `lastInputSeconds` — seconds since last agent input; low value = actively working
- `status` / `state` — raw status string
- Mapped to: `active` (running/connected), `idle`, `offline` (disconnected), `error`

---

## 9. Subagent Tracking

When an agent spawns a subagent, the `chat.subagent` event is emitted:

```json
{
  "sessionKey": "agent:main:main",
  "childSessionKey": "agent:main:subagent:researcher",
  "state": "working",
  "label": "research"
}
```

`state` values: `working`, `done`, `error`

---

## 10. Error Handling

### ErrorShape

```json
{
  "code": "ERR_CODE",
  "message": "Human-readable",
  "retryable": false,
  "retryAfterMs": 0
}
```

### Common Error Codes

| Code | Meaning |
|---|---|
| `ERR_AUTH` | Authentication failed (bad token) |
| `ERR_SCOPE` | Insufficient scopes for operation |
| `ERR_NOT_FOUND` | Session or resource not found |
| `ERR_CONFLICT` | Idempotency key collision |
| `ERR_RATE_LIMIT` | Rate limited; use `retryAfterMs` |
| `ERR_TIMEOUT` | RPC timed out |

---

## 11. Reconnection Strategy

Use exponential backoff:

```
delay = min(delay * 2, 30000)
starting delay = 1000ms
max delay = 30000ms (30s)
```

**Do NOT retry** on auth errors (`ERR_AUTH`) — fix the token first.

On reconnect, re-send the full handshake (challenge → connect → hello-ok).

---

## 12. Security

- **TLS/WSS**: Use `wss://` in production; `ws://` acceptable for localhost-only
- **Device Identity**: Optional device pairing for enhanced trust on localhost
- **Tailscale**: Recommended for LAN access without exposing port to internet
- **Token**: Store in environment variable (`OPENCLAW_TOKEN`), never in code
- **Scopes**: Use minimum required scopes per client (read-only for monitoring)
