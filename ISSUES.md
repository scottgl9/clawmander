# Known Issues

## OpenClaw WebSocket Connection Failure

**Status**: Resolved
**Severity**: High (non-critical - dashboard works without it)
**Date Reported**: 2026-02-08
**Date Resolved**: 2026-02-08

### Description

The backend fails to establish a persistent connection to OpenClaw gateway (ws://127.0.0.1:18789). The connection establishes but immediately disconnects, entering a reconnection loop with 1-10 second backoff delays.

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

**Fix Applied**: Updated `backend/collectors/OpenClawCollector.js` (lines 58-77) with correct protocol constants:

1. Changed `client.id` from "clawmander" to **"cli"**
2. Changed `client.mode` from "observer" to **"operator"**
3. Kept `role` as "operator" (already correct)

**References**:
- [OpenClaw Gateway Protocol Documentation](https://docs.openclaw.ai/gateway/protocol)
- [OpenClaw Network Configuration](https://deepwiki.com/openclaw/openclaw/13.4-network-configuration)
- [GitHub Issue #5710](https://github.com/openclaw/openclaw/issues/5710) - Similar client.id validation error

**Testing Required**:
- Restart backend service
- Verify WebSocket connection establishes without immediate disconnect
- Confirm "hello-ok" response received from gateway
- Check dashboard shows "OpenClaw gateway connection - Connected"
