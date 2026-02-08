# Known Issues

## OpenClaw WebSocket Connection Failure

**Status**: Unresolved - Mitigated
**Severity**: High (causes extreme dashboard slowness due to reconnection loop)
**Date Reported**: 2026-02-08
**Date Mitigated**: 2026-02-08
**Workaround**: Disabled OpenClaw collector to prevent reconnection spam

### Description

The backend fails to establish a persistent connection to OpenClaw gateway (ws://127.0.0.1:18789). The connection establishes but immediately disconnects, entering a reconnection loop with 1-10 second backoff delays. This continuous reconnection causes extreme slowness in the dashboard due to repeated failed handshakes and connection attempts.

### Symptoms

- Dashboard shows "Server Status: OpenClaw gateway connection - Disconnected"
- Backend logs: `[OpenClaw] Connected` followed immediately by `[OpenClaw] Disconnected`
- Reconnection attempts continue indefinitely every 1-30 seconds
- No automatic agent status updates from OpenClaw

### Root Cause

**Protocol Mismatch**: The backend was using incorrect OpenClaw protocol v3 connection parameters:

**Incorrect Parameters** (BEFORE FIX):
```json
{
  "client": {
    "id": "clawmander",  ❌ Wrong - must be "cli" for operator clients
    "mode": "observer"   ❌ Wrong - must be "operator" or "node"
  },
  "role": "operator"
}
```

**Correct Parameters** (AFTER FIX):
```json
{
  "client": {
    "id": "cli",         ✅ Correct - standard constant for operator clients
    "mode": "operator"   ✅ Correct - matches the role
  },
  "role": "operator"
}
```

The OpenClaw Gateway enforces strict schema validation where:
- `client.id` must be a protocol constant: **"cli"** for operator clients, or device identifiers like "ios-node" for nodes
- `client.mode` must be either **"operator"** or **"node"** (matches the role)
- `role` must match the client mode

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

**Previous Attempt**: Updated `backend/collectors/OpenClawCollector.js` (commit 6bfee19) with protocol constants:
- Changed `client.id` from "clawmander" to "cli"
- Changed `client.mode` from "observer" to "operator"

**Result**: ❌ FAILED - OpenClaw gateway still rejects connection with:
```
invalid connect params: at /client/mode: must be equal to constant; at /client/mode: must match a schema in anyOf
```

**Testing Performed** (2026-02-08 11:30 UTC):
- Tested all client.mode values: operator, node, device, cli, gateway, console, viewer, admin, monitor, agent
- Only "node" mode passes initial validation but requires "device identity" parameter
- "operator" mode is consistently rejected with schema validation error
- Connection establishes successfully, then immediately closes after connect request
- Reconnection loop causes 1-30 second backoff delays and repeated failures

**Mitigation Applied**:
1. Disabled OpenClaw collector in `backend/server.js` (lines 113-115)
2. Dashboard now functions normally without WebSocket spam
3. Services start cleanly and respond immediately to API requests

**Next Steps**:
1. Contact OpenClaw support to clarify current Gateway Protocol v3 specification
2. Determine if protocol has changed since v3 was introduced
3. May need to implement v4 protocol or alternative integration method
4. Consider alternative approaches: REST API polling, gRPC, or direct agent API calls

**Impact**:
- ✅ Dashboard performance restored (no slow reconnection attempts)
- ✅ All core features functional (tasks, agents, budget, activity)
- ❌ OpenClaw agent status auto-sync disabled
- ❌ Missing real-time agent health monitoring from gateway
- ❌ Manual agent status updates via REST API required
