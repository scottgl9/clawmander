# Known Issues

## OpenClaw WebSocket Connection Failure

**Status**: Open
**Severity**: High (non-critical - dashboard works without it)
**Date Reported**: 2026-02-08

### Description

The backend fails to establish a persistent connection to OpenClaw gateway (ws://127.0.0.1:18789). The connection establishes but immediately disconnects, entering a reconnection loop with 1-10 second backoff delays.

### Symptoms

- Dashboard shows "Server Status: OpenClaw gateway connection - Disconnected"
- Backend logs: `[OpenClaw] Connected` followed immediately by `[OpenClaw] Disconnected`
- Reconnection attempts continue indefinitely every 1-30 seconds
- No automatic agent status updates from OpenClaw

### Root Cause

**Protocol Mismatch**: The backend attempts to use OpenClaw protocol v3 with the following connection parameters:

```json
{
  "type": "req",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "clawmander",
      "version": "1.0.0",
      "platform": "linux",
      "mode": "observer"
    },
    "role": "operator",
    "scopes": ["operator.read"],
    "auth": { "token": "" }
  }
}
```

The OpenClaw server rejects this with:
- `client.id` must be a specific constant (value unknown)
- `client.mode` must be a specific constant (value unknown)

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

### Next Steps

1. Determine correct OpenClaw protocol v3 constants
2. Update connection parameters in OpenClawCollector
3. Test connection with corrected parameters
4. Update OPENCLAW_INTEGRATION.md if protocol has changed
