# SMS/MMS Gateway Integration

Clawmander includes a built-in SMS/MMS gateway that integrates with the
[android-sms-gateway](https://github.com/capcom6/android-sms-gateway) Android app.
This lets OpenClaw agents query incoming SMS and MMS messages via a stable REST API,
with the phone proactively pushing new messages as they arrive.

---

## Architecture

```
Android Phone (android-sms-gateway app)
    │
    │  outbound push over Tailscale or local WiFi
    ▼
Clawmander Backend (scottgl-aipc)
    │  Stores SMS/MMS in SQLite
    │  Exposes REST API at /api/sms/*
    ▼
OpenClaw Agents → GET /api/sms/messages
```

- The phone connects **outbound** to the clawmander backend — no port forwarding needed on the phone
- Messages are stored persistently in SQLite (`messages.db`)
- Three webhook events are registered automatically on startup:
  - `sms:received` — new SMS arrives
  - `mms:received` — new MMS arrives (metadata only)
  - `mms:downloaded` — MMS fully downloaded (adds body text + attachment list)

---

## Prerequisites

- Android device with [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) installed
- Use the **insecure** build (`app-insecure.apk`) from the releases page — the secure build requires HTTPS for webhooks which doesn't work over a local Tailscale IP
- Android app configured in **Local Server** mode
- Both devices on the same network or Tailscale VPN

---

## Android App Setup

### 1. Install the app

Download `app-insecure.apk` from the latest release:

```
https://github.com/capcom6/android-sms-gateway/releases/latest
```

Install on your Android device. If blocked:
- Settings → Apps → [your browser] → Install unknown apps → Allow

### 2. Grant permissions

In the app, or via Settings → Apps → SMSGate → Permissions, grant:
- **SMS** (send + receive + read)
- **Phone** (for SIM number detection)
- **Notifications**

If permissions are blocked by "restricted settings" on Android 13+:
1. Go to Settings → Apps → SMSGate
2. Tap the ⋮ three-dot menu → **Allow restricted settings**
3. Then grant permissions normally

### 3. Enable Local Server mode

Open the app and toggle **Local Server** on. Note the displayed IP, port, username, and password.

### 4. Disable internet requirement for webhooks

By default the app won't fire webhooks without internet. Disable this:

```bash
curl -s -u <user>:<pass> -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"webhooks": {"internet_required": false}}' \
  http://<phone-ip>:8080/settings
```

---

## Backend Configuration

Add to `backend/.env`:

```ini
# android-sms-gateway connection
ASG_URL=http://<phone-tailscale-ip>:8080
ASG_USER=<username-from-app>
ASG_PASS=<password-from-app>

# Callback URL the phone uses to push webhooks back
ASG_CALLBACK_HOST=<clawmander-tailscale-ip>
ASG_CALLBACK_PORT=3001
ASG_CALLBACK_PATH=/api/sms/webhook

# Bind backend to all interfaces so Tailscale devices can reach it
BIND_HOST=0.0.0.0
```

Restart the backend — it will automatically:
1. Register `sms:received`, `mms:received`, and `mms:downloaded` webhooks on the phone
2. Sync any existing messages from the phone's inbox

---

## Backfill Historical Messages

After setup, pull existing SMS history from the phone:

```bash
curl -s -u <user>:<pass> \
  -H "Content-Type: application/json" \
  -d '{"since": "2026-01-01T00:00:00Z", "until": "2026-12-31T23:59:59Z"}' \
  http://<phone-ip>:8080/messages/inbox/export
```

The phone will fire `sms:received` webhooks for each message in the date range.
Note: only SMS history is exportable — MMS history cannot be backfilled.

---

## API Reference

All endpoints require `Authorization: Bearer <AUTH_TOKEN>` except `/webhook` and `/health`.

### `GET /api/sms/health`
No auth required.
```json
{
  "reachable": true,
  "message_count": 212,
  "asg_url": "http://100.74.34.101:8080"
}
```

### `GET /api/sms/messages`
Query stored messages.

| Param | Type | Description |
|-------|------|-------------|
| `since` | ISO datetime | Filter messages after this time |
| `limit` | integer | Max results (default 50, max 500) |
| `contact` | phone number | Filter by sender or recipient |
| `type` | `sms\|mms\|all` | Filter by message type (default: all) |

```bash
# Last 24h from a specific contact
GET /api/sms/messages?since=2026-04-12T00:00:00Z&contact=+12814144395

# All MMS messages
GET /api/sms/messages?type=mms&limit=20
```

### `GET /api/sms/messages/:id`
Get a single message by ID.

### `POST /api/sms/webhook`
No auth required. Receives push events from android-sms-gateway.
Handles: `sms:received`, `mms:received`, `mms:downloaded`.

### `POST /api/sms/sync`
Trigger a manual sync from the phone (polls `GET /messages` on the device).
```json
{ "new_messages": 5, "reachable": true }
```

---

## Message Schema

```
id              TEXT    Primary key
type            TEXT    'sms' or 'mms'
sender          TEXT    Sender phone number
recipient       TEXT    Device's phone number (may be null)
body            TEXT    SMS text body
body_downloaded TEXT    MMS full text body (after mms:downloaded)
parts           TEXT    JSON array of MMS attachment parts
subject         TEXT    MMS subject line
size            INTEGER MMS size in bytes
content_class   TEXT    MMS content classification
sim_number      INTEGER SIM index
received_at     DATETIME
stored_at       DATETIME
downloaded_at   DATETIME When mms:downloaded fired
raw_payload     TEXT    Full webhook JSON blob
```

---

## MMS Group Messages

For group MMS threads:
- `mms:received` fires immediately with `sender` (individual who sent it) and subject/metadata
- `mms:downloaded` follows with the actual text body and attachment list in `parts`
- Group participant list is not included in the webhook payload (android-sms-gateway limitation)
- Old MMS history cannot be backfilled — only new incoming MMS from setup onwards

---

## OpenClaw Agent Usage

Example query from sentinel-personal or personal-agent:

```bash
# Check for messages from a contact in the last 24h
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  "http://localhost:3001/api/sms/messages?contact=+19798204394&since=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"

# All recent MMS
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  "http://localhost:3001/api/sms/messages?type=mms&limit=10"
```

---

## Troubleshooting

**Phone shows as unreachable:**
- Check Tailscale is connected on both devices
- Verify `ASG_URL` in `.env` matches the phone's Tailscale IP
- Check android-sms-gateway Local Server is toggled on

**No webhooks arriving:**
- Verify `BIND_HOST=0.0.0.0` in `.env` and backend was restarted
- Check `webhooks.internet_required` is `false` in the app settings
- Check `ss -tlnp | grep 3001` — should show `0.0.0.0:3001`

**Duplicate webhooks after restart:**
- The backend deduplicates on startup — no action needed

**MMS body is null:**
- Body is only available after `mms:downloaded` fires
- Check the `body_downloaded` field, not `body`
