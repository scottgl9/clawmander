# Skill: Gateway Management

Manage the OpenClaw gateway and agent exec security policies.

**Base URL**: `http://localhost:3001`

---

## Gateway Restart

### Restart Gateway
```
POST /api/gateway/restart
```
Fire-and-forget restart of the OpenClaw gateway process. Returns immediately with 202.

**Response 202:**
```json
{ "ok": true, "message": "Gateway restart initiated." }
```

### Gateway Health Check
```
GET /api/gateway/status
```
Returns connectivity status.

**Response 200:**
```json
{ "connected": true }
```

---

## Exec Approvals

Manage exec security policies that control which commands agents can run.

### Security Levels
- **full** — Agent can run any command without approval
- **allowlist** — Only pre-approved command patterns are allowed
- **deny** — All exec commands are blocked

### Ask Behaviors
- **on-miss** — Prompt user when command is not in allowlist
- **always** — Prompt for every command
- **never** — Never prompt (deny or allow based on allowlist)

### Get Approval Config
```
GET /api/approvals
```
Returns global defaults, per-agent overrides, and allowlists.

### Update Global Defaults
```
PUT /api/approvals/defaults
Content-Type: application/json

{ "security": "allowlist", "ask": "on-miss" }
```

### Update Per-Agent Security
```
PUT /api/approvals/agents/:agentId
Content-Type: application/json

{ "security": "full" }
```

### Add Allowlist Pattern
```
POST /api/approvals/agents/:agentId/allowlist
Content-Type: application/json

{ "pattern": "npm run *" }
```
Use `*` as agentId for global wildcard allowlist.

### Remove Allowlist Entry
```
DELETE /api/approvals/agents/:agentId/allowlist/:entryId
```
