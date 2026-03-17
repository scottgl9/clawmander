# Clawmander Skills

How OpenClaw agents interact with the Clawmander dashboard API.

**Base URL**: `http://localhost:3001`

## Authentication

Write operations (`POST`, `PATCH`, `DELETE`) require a Bearer token:

```
Authorization: Bearer <AUTH_TOKEN>
```

Read operations (`GET`) are open. The token is set via `AUTH_TOKEN` in `backend/.env` (default: `changeme`).

---

## Skills Index

| Skill | File | Description |
|-------|------|-------------|
| Agent Lifecycle | [skills/skill-agent.md](skills/skill-agent.md) | Report status, send heartbeats |
| Task Management | [skills/skill-tasks.md](skills/skill-tasks.md) | Create and track Kanban tasks |
| Work Management | [skills/skill-work.md](skills/skill-work.md) | Action items and daily brief |
| Budget | [skills/skill-budget.md](skills/skill-budget.md) | Budget categories and transactions |
| Drawings | [skills/skill-drawings.md](skills/skill-drawings.md) | Create/edit Excalidraw diagrams |
| Chat Gateway | [skills/skill-chat.md](skills/skill-chat.md) | Send messages to agents via gateway |
| Dashboard Views | [skills/skill-views.md](skills/skill-views.md) | Aggregated daily/weekly/monthly views, activity log |
| System & Events | [skills/skill-system.md](skills/skill-system.md) | Health checks, SSE real-time events, commands |
| Virtual Browser | [skills/skill-browser.md](skills/skill-browser.md) | Control persistent Chrome instances for web automation and research |

---

## Quick Reference

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Set agent status | POST | `/api/agents/status` | Yes |
| Send heartbeat | POST | `/api/agents/heartbeat` | Yes |
| Get heartbeat timings | GET | `/api/agents/heartbeat` | No |
| Create task | POST | `/api/agents/tasks` | Yes |
| Update task | PATCH | `/api/tasks/:id` | Yes |
| Delete task | DELETE | `/api/tasks/:id` | Yes |
| List tasks | GET | `/api/tasks` | No |
| Task stats | GET | `/api/tasks/stats` | No |
| Create action item | POST | `/api/work/action-items` | Yes |
| Update action item | PATCH | `/api/work/action-items/:id` | Yes |
| Delete action item | DELETE | `/api/work/action-items/:id` | Yes |
| List action items | GET | `/api/work/action-items` | No |
| Daily brief | GET | `/api/work/brief` | No |
| Create budget category | POST | `/api/budget/categories` | Yes |
| Create transaction | POST | `/api/budget/transactions` | Yes |
| Budget summary | GET | `/api/budget/summary` | No |
| Spending trends | GET | `/api/budget/trends` | No |
| List drawings | GET | `/api/drawings` | No |
| Get drawing | GET | `/api/drawings/:id` | No |
| Create drawing | POST | `/api/drawings` | Yes |
| Update drawing | PATCH | `/api/drawings/:id` | Yes |
| Delete drawing | DELETE | `/api/drawings/:id` | Yes |
| Send chat message | POST | `/api/chat/send` | No |
| List chat sessions | GET | `/api/chat/sessions` | No |
| Get chat history | GET | `/api/chat/history/:sessionKey` | No |
| Abort chat run | POST | `/api/chat/abort` | No |
| Reset chat session | POST | `/api/chat/sessions/:key/reset` | No |
| Log activity | POST | `/api/activity/log` | No |
| Get activity log | GET | `/api/activity/log` | No |
| SSE subscribe | GET | `/api/sse/subscribe` | No |
| Health check | GET | `/api/health` | No |
| Server status | GET | `/api/server/status` | No |
| Daily view | GET | `/api/views/daily` | No |
| Weekly view | GET | `/api/views/weekly` | No |
| Monthly view | GET | `/api/views/monthly` | No |
| Browser instances | GET | `/api/browser` | Yes |
| Create browser instance | POST | `/api/browser` | Yes |
| Browser navigate | POST | `/api/browser/:id/navigate` | Yes |
| Browser click/type/key/scroll | POST | `/api/browser/:id/{click|type|key|scroll}` | Yes |
| Browser content/screenshot | POST | `/api/browser/:id/{content|screenshot}` | Yes |
| Browser user handoff | POST | `/api/browser/:id/request-user-control` | Yes |
