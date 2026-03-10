# Known Issues

## Agent Tasks View Bugs

**Status**: Resolved (2026-03-10)
**Severity**: Medium

### Issues Fixed

1. **Duplicate SSE connections** (`pages/agents.js` + `KanbanBoard.js`): `pages/agents.js` was creating its own `useSSE` hook with an empty callback AND `KanbanBoard.js` created its own. Fixed: removed `useSSE` from `pages/agents.js`; `KanbanBoard` now exposes `onConnectionChange` callback and owns the SSE connection.

2. **Double-update on status change**: `task.updated` + `task.status_changed` both fired for the same task change. Fixed: `task.updated` now uses `event.data` directly (full task); `task.status_changed` uses `event.data.task` (nested). These handlers are now distinct and don't overlap.

3. **Poor task titles from gateway**: `_handleRunStart` used `data.title || 'Run ${data.runId}'` resulting in "Run <uuid>" titles. Fixed: derives title from `parseSessionKey()` → e.g., "Agent: general-agent" or "Subagent: researcher".

4. **Done task accumulation**: Done tasks never got cleaned up. Fixed: `TaskService.cleanupDoneTasks()` removes done tasks older than today (midnight CST); called on server startup + hourly + on each run end.

---



## OpenClaw WebSocket Connection Failure

**Status**: Resolved
**Severity**: High (causes extreme dashboard slowness due to reconnection loop)
**Date Reported**: 2026-02-08
**Date Mitigated**: 2026-02-08
**Date Resolved**: 2026-02-08

### Description

The backend fails to establish a persistent connection to OpenClaw gateway (ws://127.0.0.1:18789). The connection establishes but immediately disconnects, entering a reconnection loop with 1-10 second backoff delays. This continuous reconnection causes extreme slowness in the dashboard due to repeated failed handshakes and connection attempts.

### Symptoms

- Dashboard shows "Server Status: OpenClaw gateway connection - Disconnected"
- Backend logs: `[OpenClaw] Connected` followed immediately by `[OpenClaw] Disconnected`
- Reconnection attempts continue indefinitely every 1-30 seconds
- No automatic agent status updates from OpenClaw

### Root Cause

**ACTUAL ROOT CAUSE: Missing Authentication Token**

Research into OpenClaw Gateway Protocol v3 (2026-02-08) revealed the true issue:

**OpenClaw Gateway requires authentication** for WebSocket connections. The connection failures were caused by:

1. **Missing auth token** in the connect handshake
2. Gateway rejecting connections without valid authentication
3. Error messages were misleading ("invalid connect params" instead of "authentication failed")

**Authentication Requirements**:
- **Localhost (127.0.0.1)**: Token optional, device pairing auto-approved
- **LAN/Remote**: Token **required**, Gateway refuses to start without it
- **Token location**: `gateway.auth.token` in config or `OPENCLAW_GATEWAY_TOKEN` env var

**Incorrect Parameters** (BEFORE):
```json
{
  "client": {
    "id": "clawmander",  ❌ Wrong - must be "cli"
    "mode": "observer"   ❌ Wrong - must be "operator"
  },
  "role": "operator",
  "auth": {
    "token": ""          ❌ CRITICAL: Empty token causes rejection
  }
}
```

**Correct Parameters** (AFTER):
```json
{
  "client": {
    "id": "cli",         ✅ Correct - standard constant
    "mode": "operator",  ✅ Correct - matches role
    "version": "1.0.0",
    "platform": "linux"
  },
  "role": "operator",
  "scopes": ["operator.read"],
  "auth": {
    "token": "<gateway-token>"  ✅ REQUIRED: Valid Gateway token
  }
}
```

**Key Protocol Requirements**:
- `client.id`: Must be "cli" for operators (NOT custom values)
- `client.mode`: Must be "operator" or "node"
- `auth.token`: **REQUIRED** - must match Gateway's configured token
- Gateway enforces strict schema validation AND authentication

### Testing Performed

Attempted multiple client ID and mode combinations:
- `id: "client"`, `mode: "client"` ❌
- `id: "remote"`, `mode: "remote"` ❌
- `id: "gateway"`, `mode: "gateway"` ❌
- `id: "dashboard"`, `mode: "observer"` ❌

All rejected with: "must be equal to constant" errors.

### Impact

**Non-critical**:
- Dashboard functions normally without OpenClaw
- Manual task creation and tracking works
- Real-time SSE updates work
- All pages accessible

**Missing Features**:
- Automatic agent status sync from OpenClaw
- Live agent health monitoring
- Automatic task updates from OpenClaw agents

### Solution Options

1. **Disable Reconnection Attempts** (Temporary)
   - Stop the reconnection loop to reduce log noise
   - Accept graceful degradation until protocol is clarified

2. **Update Protocol** (Proper Fix)
   - Contact OpenClaw documentation or support
   - Determine correct `client.id` and `client.mode` values
   - Update `OpenClawCollector.js` with correct parameters

3. **Check OpenClaw Version**
   - Current OpenClaw process: `openclaw-gateway` (no version info available)
   - Verify compatibility with Clawmander protocol expectations
   - May require updating clawmander to match newer OpenClaw protocol

### Related Files

- `backend/collectors/OpenClawCollector.js` - Lines 54-77 (connection handshake)
- `backend/config/config.js` - Lines 8-11 (OpenClaw configuration)
- `docs/OPENCLAW_INTEGRATION.md` - Protocol documentation (may be outdated)

### Notes

- No OPENCLAW_TOKEN is configured (empty by default)
- Documentation mentions simpler protocol (`type: "connect"` with `token` and `subscribe`)
- Current implementation uses complex v3 protocol with RPC-style messages
- Discrepancy suggests protocol may have evolved since documentation was written

### Resolution

**Attempt 1** (commit 6bfee19): Updated protocol constants
- Changed `client.id` from "clawmander" to "cli" ✅
- Changed `client.mode` from "observer" to "operator" ✅
- **Result**: Still failed - token was still empty ❌

**Attempt 2** (2026-02-08 11:30 UTC): Extensive testing
- Tested all client.mode values: operator, node, device, cli, gateway, console, etc.
- All failed with various errors
- **Finding**: "node" mode returned "device identity required" - hinted at auth issue
- **Result**: Identified authentication as the root cause ✅

**Mitigation Applied** (2026-02-08):
1. Disabled OpenClaw collector in `backend/server.js` (lines 113-115)
2. Dashboard functions normally without WebSocket reconnection spam
3. Services respond quickly (15-20ms API response times)

**Fix Applied** (2026-02-08):

Three bugs were fixed in `OpenClawCollector.js`:

1. **Missing challenge handling**: Protocol v3 requires a 3-step handshake where the
   Gateway sends a pre-connect challenge before the client sends its connect frame.
   The collector was sending connect immediately on `ws.open`, skipping step 1.
   Fixed: wait for `challenge` message, then send connect with nonce. Falls back
   to sending connect after 2s timeout for localhost connections where challenge
   is optional.

2. **Wrong hello-ok parsing**: The collector checked for `msg.type === 'hello-ok'`,
   but the Gateway responds with `{type: "res", id, ok: true, result: ...}`. The
   hello-ok data is inside a `res`-type message matching the connect request ID.
   Fixed: detect connect response by matching `msg.type === 'res'` and
   `msg.id === connectReqId`. Backward compatibility with bare `hello-ok` preserved.

3. **Collector re-enabled**: Uncommented the collector instantiation in `server.js`.

**Impact**:
- ✅ Dashboard performance restored
- ✅ All core features functional (tasks, agents, budget, activity)
- ✅ OpenClaw agent status auto-sync re-enabled
- ✅ Real-time agent health monitoring from gateway restored

### References

**Official OpenClaw Documentation**:
- [Gateway Protocol Specification](https://docs.openclaw.ai/gateway/protocol) - WebSocket connect method spec
- [Gateway Security & Authentication](https://docs.openclaw.ai/gateway/security) - Token requirements
- [Gateway Configuration](https://deepwiki.com/openclaw/openclaw/3.1-gateway-configuration) - Config options
- [Network Configuration](https://deepwiki.com/openclaw/openclaw/13.4-network-configuration) - Network setup

**Relevant GitHub Issues**:
- [Issue #5710](https://github.com/openclaw/openclaw/issues/5710) - "invalid connect params" error (version mismatch)
- [Issue #1679](https://github.com/openclaw/openclaw/issues/1679) - allowInsecureAuth issues
- [Issue #4833](https://github.com/openclaw/openclaw/issues/4833) - "pairing required" error
- [Issue #8529](https://github.com/openclaw/openclaw/issues/8529) - "device identity required" error

**Key Findings from Research**:
1. Authentication is **mandatory** for non-localhost Gateway connections
2. Token is set via `gateway.auth.token` or `OPENCLAW_GATEWAY_TOKEN`
3. Device pairing is auto-approved for localhost/loopback connections
4. Protocol v3 requires exact parameter structure with valid auth token
5. Missing/invalid token causes cryptic error messages
