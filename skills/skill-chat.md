# Skill: Chat Gateway

Send messages to agents and manage chat sessions via the OpenClaw gateway proxy.

**Base URL**: `http://localhost:3001`
**Auth**: Chat endpoints do not require auth (gateway auth is handled server-side via `OPENCLAW_TOKEN`).

---

## Session Keys

Session keys follow the pattern: `agent:<agent-name>:clawmander:<number>`

Examples: `agent:general-agent:clawmander:1`, `agent:qwen-agent:clawmander:2`

---

## List Sessions

```
GET /api/chat/sessions
```

Response:
```json
{
  "sessions": [
    { "key": "agent:general-agent:clawmander:1", "agentId": "general-agent", "model": "anthropic/claude-opus-4" }
  ],
  "connected": true
}
```

## List Models

```
GET /api/chat/models
```

Response: `{ "models": [...], "connected": bool }`

---

## Send Message

```
POST /api/chat/send
Content-Type: application/json

{
  "sessionKey": "agent:general-agent:clawmander:1",
  "message": "What are you working on?",
  "attachments": []
}
```

Response: `{ "ok": true, "runId": "...", "messageId": "..." }`

The agent's streaming response arrives via SSE (`chat.delta` → `chat.final`). See [skill-system.md](./skill-system.md) for SSE details.

---

## Get Message History

```
GET /api/chat/history/agent:general-agent:clawmander:1
```

Response:
```json
{
  "messages": [...],
  "source": "gateway",
  "activeRunId": null
}
```

`activeRunId` is non-null when the agent has an active run in progress.

---

## Abort Active Run

```
POST /api/chat/abort
Content-Type: application/json

{ "sessionKey": "agent:general-agent:clawmander:1", "runId": "<optional>" }
```

---

## Reset Session (New Conversation)

Clears the conversation context and starts fresh.

```
POST /api/chat/sessions/:sessionKey/reset
Content-Type: application/json

{ "reason": "new" }
```

---

## Patch Session (Switch Model / Settings)

```
POST /api/chat/sessions/:sessionKey/patch
Content-Type: application/json

{ "model": "anthropic/claude-opus-4", "thinkingLevel": "auto" }
```

---

## Resolve Approval

When an agent requests permission for a dangerous action, approve or deny it:

```
POST /api/chat/approval/resolve
Content-Type: application/json

{ "approvalId": "<uuid>", "decision": "approve" }
```

**Decisions**: `"approve"`, `"deny"`

---

## Upload Image (Attach to Message)

```
POST /api/chat/upload
Content-Type: multipart/form-data

file: <image file>
```

Response: `{ "ok": true, "url": "/api/chat/uploads/<filename>", "filename": "..." }`

Then include the URL in `attachments` when sending a message:
```json
{
  "sessionKey": "...",
  "message": "What's in this image?",
  "attachments": [{ "url": "/api/chat/uploads/abc123.jpg", "type": "image" }]
}
```

---

## SSE Chat Events

Received on `GET /api/sse/subscribe`:

| Event | Payload | Description |
|-------|---------|-------------|
| `chat.delta` | `{ sessionKey, runId, text, seq }` | Streaming text chunk |
| `chat.final` | `{ sessionKey, runId, text, usage }` | Full response complete |
| `chat.error` | `{ sessionKey, runId, error }` | Error during response |
| `chat.aborted` | `{ sessionKey, runId }` | Run was aborted |
| `chat.approval` | `{ approvalId, sessionKey, command, description }` | Agent needs permission |
| `chat.subagent` | `{ sessionKey, childSessionKey, state, label }` | Subagent activity |
| `agent.status` | `{ agentId, isWorking, runId, sessionKey }` | Agent work state |
