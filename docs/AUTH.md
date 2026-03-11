# Authentication System

Clawmander uses a dual-auth model:

- **User auth** (JWT) — for browser sessions via login/register pages
- **Agent auth** (Bearer token) — for OpenClaw agents and automation scripts (unchanged)

Both mechanisms coexist. Agent endpoints that previously required only `AUTH_TOKEN` now also accept user JWTs via `anyAuth` middleware.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-jwt-secret-change-in-production` | Access token signing secret |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-in-production` | Refresh token signing secret |
| `JWT_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `AUTH_TOKEN` | `changeme` | Existing agent Bearer token (unchanged) |

**Change `JWT_SECRET` and `JWT_REFRESH_SECRET` in production.**

---

## API Endpoints

All auth endpoints live under `/api/auth`.

### Register

```
POST /api/auth/register
Content-Type: application/json

{ "email": "you@example.com", "password": "Test1234!", "name": "Alice" }
```

Password requirements: 8+ chars, uppercase, lowercase, number, special character.

Response `201`:
```json
{ "user": { "id": "...", "email": "you@example.com", "name": "Alice", "role": "user", ... } }
```

### Login

```
POST /api/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "Test1234!" }
```

Response `200`:
```json
{
  "user": { ... },
  "accessToken": "<JWT, 15m>",
  "refreshToken": "<JWT, 7d>"
}
```

### Refresh Access Token

```
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refresh token>" }
```

Response `200`:
```json
{ "accessToken": "<new JWT>" }
```

### Logout

```
POST /api/auth/logout
Content-Type: application/json

{ "refreshToken": "<refresh token>" }
```

Revokes all refresh tokens for the user. Response `200`: `{ "ok": true }`

### Get Profile

```
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Response `200`:
```json
{ "user": { "id": "...", "email": "...", "name": "...", "role": "user", ... } }
```

### Update Profile

```
PUT /api/auth/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "name": "New Name", "email": "new@example.com" }
```

### Change Password

```
PUT /api/auth/me/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "currentPassword": "Old1234!", "newPassword": "New1234!@" }
```

Changing password revokes all existing refresh tokens, forcing re-login on other devices.

---

## Frontend Flow

1. User visits any route → `AuthGuard` in `_app.js` checks localStorage for `accessToken`
2. If found, `GET /api/auth/me` validates the token and loads the user
3. If `accessToken` is expired, a silent refresh is attempted using `refreshToken`
4. If refresh fails, tokens are cleared and user is redirected to `/login`
5. Public routes: `/login`, `/register` — redirect to `/` if already authenticated

Tokens are stored in `localStorage`:
- `accessToken` — short-lived JWT (15m)
- `refreshToken` — long-lived JWT (7d)

---

## Database

Auth data is stored in `backend/storage/data/auth.db` (SQLite, WAL mode).

**Tables:**
- `users` — email, password hash (bcrypt), role, active status
- `refresh_tokens` — SHA-256 hash of the JWT (raw token never stored), expiry, revoked flag

Expired and revoked tokens are cleaned up hourly via `authDB.cleanupExpiredTokens()`.

---

## Agent Auth (Unchanged)

OpenClaw agents continue to use the static Bearer token:

```bash
curl -H "Authorization: Bearer changeme" \
  -X POST http://localhost:3001/api/agents/tasks \
  -H 'Content-Type: application/json' \
  -d '{"agentId": "my-agent", "task": {...}}'
```

The `anyAuth` middleware on agent-writable endpoints accepts both user JWTs and the static token.

---

## Testing

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test1234!","name":"Test"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test1234!"}'

# Use access token
curl -H "Authorization: Bearer <accessToken>" \
  http://localhost:3001/api/auth/me
```

Run unit tests:

```bash
cd backend
npx jest --testPathPatterns="crypto|authRoutes|authMiddleware|AuthDB"
```

---

## Rate Limiting

Auth endpoints (`/register`, `/login`, `/refresh`) are rate-limited to **10 requests per minute per IP**. Exceeding this returns `429 Too Many Requests` with a `Retry-After` header.
