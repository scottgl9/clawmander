# Clawmander Dashboard Refactor Plan

## Context

The dashboard currently shows basic task/action-item lists and connects to OpenClaw via WebSocket for agent lifecycle events. Meanwhile, rich agent reports (budget summaries, job listings, PR reviews, Jira analysis, morning briefs, weekly summaries) are posted to Discord channels and not visible on the dashboard. The weekly page shows a simple task list instead of the detailed WEEK.md summaries agents generate. The monthly page serves no purpose. Cron job health is invisible.

**Goal**: Make the dashboard the central hub for all agent output, replacing Discord as the primary reporting destination. Surface WEEK.md content, cron job status, and all agent reports directly in the dashboard.

## Key Insight

OpenClaw already captures all cron job output in JSONL files at `~/.openclaw/cron/runs/<jobId>.jsonl`. Each line contains a `summary` field with the full markdown report — the exact same rich content posted to Discord. The dashboard just needs to **read these files directly** rather than requiring agents to POST data.

## Changes Implemented

### Backend: New Services
- **CronService.js** — Reads OpenClaw cron data from disk (jobs.json + JSONL run logs), polls for changes every 60s
- **MemoryService.js** — Reads WEEK.md files across all agent memory directories

### Backend: New Routes
- `GET /api/cron/jobs` — All cron jobs with state
- `GET /api/cron/jobs/:jobId/runs?limit=` — Run history for specific job
- `GET /api/cron/system` — System cron status
- `GET /api/feeds?limit=&offset=&agent=` — All runs across jobs (replaces Discord)
- `GET /api/memory/weeks?limit=` — Available weeks across agents
- `GET /api/memory/weeks/:weekId` — All WEEK.md summaries for a week
- `GET /api/memory/weeks/:weekId/:agent` — Specific agent's WEEK.md

### Frontend: New Pages & Components
- **feeds.js** — Filterable timeline of agent reports (replaces Discord channels)
- **FeedCard.js** — Reusable feed item card with markdown rendering
- **RecentFeeds.js** — Latest 5 feed items widget for dashboard
- **CronMonitor.js** — Cron job health widget with expandable run history

### Frontend: Modified Pages
- **weekly.js** — Complete rewrite: WEEK.md viewer with week selector + agent tabs
- **index.js** — Added RecentFeeds + CronMonitor widgets to dashboard
- **Sidebar.js** — Replaced Monthly nav item with Feeds
- **api.js** — Added cron/feeds/memory API methods, removed getMonthly
- **useSSE.js** — Added feed.new and cron.status event types

### Deleted
- **monthly.js** — Removed (not serving a purpose)
- **Monthly view route** — Removed from backend views.js

### External Changes
- **jobs.json** — Removed Discord posting from Budget, Job Search, Weekly Work Memory, Weekly Personal Memory payloads
- **Scripts** — Added status JSON line to check-and-run-prs.sh, check-and-run-jira.sh, check-and-run-email.sh, check-and-run-personal.sh, pull-transactions.sh

---

## OpenClaw ↔ Clawmander Integration

### Overview

Clawmander is the **read-only dashboard** for the OpenClaw multi-agent system. OpenClaw agents write data to disk; Clawmander reads it. There is no direct API between agents and the dashboard — all integration happens through shared filesystem paths on the same machine (`homelab`).

```
┌─────────────────────────────────────────────────────────────┐
│                        OpenClaw                             │
│  Agents run cron jobs → write JSONL run logs + WEEK.md      │
│  ~/.openclaw/cron/runs/<jobId>.jsonl                        │
│  ~/.openclaw/workspace*/memory/weeks/<YYYY-WXX>/WEEK.md     │
└────────────────────┬────────────────────────────────────────┘
                     │ filesystem (read-only)
┌────────────────────▼────────────────────────────────────────┐
│                     Clawmander (Node.js)                    │
│  CronService.js  → polls jobs.json + JSONL every 60s        │
│  MemoryService.js → scans WEEK.md files on demand           │
│  SSE endpoint    → pushes feed.new + cron.status events     │
└─────────────────────────────────────────────────────────────┘
```

---

### Data Flow

#### Agent Cron Runs → Feeds Page

1. OpenClaw CronService executes a job at its scheduled time
2. Agent runs, produces output; OpenClaw appends a JSONL line to `~/.openclaw/cron/runs/<jobId>.jsonl`
3. Each JSONL line contains: `{ runId, startedAt, completedAt, status, summary, durationMs }`
4. The `summary` field is a full markdown report (same content previously posted to Discord)
5. Clawmander's `CronService.js` polls `runs/*.jsonl` every 60s, detects new lines via file size/mtime
6. New runs are surfaced via SSE `feed.new` events to connected dashboard clients
7. `feeds.js` page renders the markdown `summary` field using `react-markdown` + `remark-gfm`

#### Agent Memory → Weekly Page

1. OpenClaw's weekly archival cron (Saturday 8am for work, Sunday 8am for personal) runs
2. Agent reads archived daily notes from `memory/weeks/YYYY-WXX/` and writes `WEEK.md`
3. Clawmander's `MemoryService.js` scans all known agent paths for `memory/weeks/*/WEEK.md` files
4. `GET /api/memory/weeks` returns available week IDs sorted by recency
5. `GET /api/memory/weeks/:weekId/:agent` returns the raw markdown of a specific agent's WEEK.md
6. `weekly.js` renders it with `react-markdown` + `remark-gfm` in an agent-tabbed view

---

### Cron System

#### jobs.json Structure

OpenClaw cron configuration lives at `~/.openclaw/cron/jobs.json`:

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "uuid",
      "agentId": "work-agent",
      "name": "Human-readable job name",
      "enabled": true,
      "schedule": {
        "kind": "cron",
        "expr": "0 8 * * 6",
        "tz": "America/Chicago"
      },
      "sessionTarget": "isolated",
      "wakeMode": "next-heartbeat",
      "payload": {
        "kind": "agentTurn",
        "message": "...",
        "model": "sonnet",
        "timeoutSeconds": 600
      },
      "delivery": { "mode": "none" },
      "state": {
        "nextRunAtMs": 1773493200000,
        "lastRunAtMs": 1772892000006,
        "lastStatus": "ok",
        "lastDurationMs": 328730,
        "consecutiveErrors": 0
      }
    }
  ]
}
```

**Key fields:**
- `agentId` — maps to an agent workspace; used by Clawmander to group jobs by agent
- `sessionTarget: "isolated"` — each run gets a fresh session context
- `wakeMode: "next-heartbeat"` — job waits until the next OpenClaw heartbeat cycle to execute
- `wakeMode: "now"` — job executes immediately at the scheduled time
- `delivery.mode: "none"` — output is not posted externally; dashboard reads from JSONL directly

#### JSONL Run Logs

Each job writes to `~/.openclaw/cron/runs/<jobId>.jsonl`. One JSON object per line:

```json
{"runId":"abc123","jobId":"72264b60-...","startedAt":1772892000006,"completedAt":1772892328736,"status":"ok","durationMs":328730,"summary":"## Weekly Summary\n...markdown..."}
```

Clawmander's `CronService.js` reads these files by:
1. Listing all `*.jsonl` files in the runs directory
2. Tracking last-seen file size per job; re-reading when size increases
3. Parsing each new line as JSON; emitting `feed.new` SSE events for connected clients

---

### Memory System

#### Agent Paths

Clawmander's `MemoryService.js` scans these paths for `WEEK.md` files:

| Agent | Path |
|-------|------|
| work-agent | `~/.openclaw/workspace/memory/weeks/<YYYY-WXX>/WEEK.md` |
| personal-agent | `~/.openclaw/workspace-personal/memory/weeks/<YYYY-WXX>/WEEK.md` |
| budget | `~/.openclaw/workspace-personal/agents/budget/memory/weeks/<YYYY-WXX>/WEEK.md` |
| sentinel-work | `~/.openclaw/workspace/agents/sentinel-work/memory/weeks/<YYYY-WXX>/WEEK.md` |
| sentinel-personal | `~/.openclaw/workspace-personal/agents/sentinel-personal/memory/weeks/<YYYY-WXX>/WEEK.md` |
| work-code-reviewer | `~/.openclaw/workspace/agents/work-code-reviewer/memory/weeks/<YYYY-WXX>/WEEK.md` |
| jira-agent | `~/.openclaw/workspace/agents/jira-agent/memory/weeks/<YYYY-WXX>/WEEK.md` |

#### WEEK.md Standard

All agents use the universal WEEK.md template defined in `~/.openclaw/workspace/scripts/WEEK-TEMPLATE.md`.

**Document structure:**

```markdown
# Week Summary — YYYY-WXX (Mon DD – Sun DD, YYYY)

> **Agent:** <name> | **Generated:** YYYY-MM-DD | **Covered:** Mon DD – Sun DD, YYYY

---

## Projects          ← h2; all activity content at this level
### Project Name     ← h3 for individual items

## Team & Process    ← h2 (work agents)
## Family & Personal ← h2 (personal agents)
## Health            ← h2 (personal agents)
## Financial Summary ← h2 (personal/budget agents)
## Heartbeat Runs    ← h2 (sentinel agents); table: Date | Runs | Emails | Escalations | Notes
## Reviews Completed ← h2 (code-reviewer); table: PR | Author | Verdict | Notes
## Reports Generated ← h2 (budget); table: Date | Report | Discord | Email

## Decisions         ← h2; table: Decision | Rationale
## Metrics           ← h2; table: Metric | Value | Notes
## Issues            ← h2; table: Severity | Issue | Detail
## Action Items      ← h2; checkboxes with blank lines between
## Next Week         ← h2; bullet list
```

**Rendering compatibility:** `weekly.js` renders with `react-markdown` + `remark-gfm`. All elements in the template (blockquotes, tables, h1–h3, checkboxes, horizontal rules) render correctly without any dashboard code changes.

**Design rules:**
- h1 = title only. h2 = main sections (Projects, Decisions, etc.). h3 = individual items within sections.
- No emoji in headings. Emoji allowed inline only (e.g., table status cells: ✅ ⚠️ 🚨).
- Omit sections entirely if empty — never write "None" or "N/A".
- Organize content by topic, never by day.
- Use tables for structured/numeric data; bullet lists for narrative.

---

### SSE Real-Time Events

Clawmander's `/api/sse` endpoint pushes events to connected dashboard clients:

| Event | Payload | Trigger |
|-------|---------|---------|
| `feed.new` | `{ jobId, agentId, runId, startedAt, status, summary }` | New JSONL line detected in a run log |
| `cron.status` | `{ jobId, agentId, name, lastStatus, nextRunAtMs, consecutiveErrors }` | jobs.json poll cycle finds state change |
| `connected` | `{ timestamp }` | Client connects to SSE stream |

Dashboard components using SSE:
- `useSSE.js` hook — subscribes and dispatches events to React state
- `RecentFeeds.js` — live-updates on `feed.new`
- `CronMonitor.js` — live-updates on `cron.status`

---

### Agent Architecture

#### Workspace Split

OpenClaw uses two primary workspaces on `homelab`:

| Workspace | Path | Agents |
|-----------|------|--------|
| Work | `~/.openclaw/workspace/` | work-agent, sentinel-work, jira-agent, work-code-reviewer |
| Personal | `~/.openclaw/workspace-personal/` | personal-agent, budget, sentinel-personal |

**Routing rule (permanent):** `workspace/` = HP work content only; `workspace-personal/` = all personal, project, and financial content.

#### Subagent Model

Main agents (work-agent, personal-agent) can invoke subagents for specialized tasks. Subagents have their own:
- `agentDir` — identity, credentials, allowed tools
- `workspace/memory/` — separate daily notes and week archives
- Cron jobs bound to their agentId

The weekly archival cron (work-agent on Saturday; personal-agent on Sunday) is responsible for generating WEEK.md files for ALL agents in its workspace group, not just itself.

#### Agent-to-Path Mapping

```
work-agent                →  ~/.openclaw/workspace/
  ├── memory/daily/       →  daily notes (auto-archived to weeks/ by system cron)
  ├── memory/weeks/       →  weekly archives + WEEK.md
  ├── memory/domain/      →  WORK_PROJECTS.md, TEAM.md, RELATIONSHIPS.md, GOALS_FY26.md, CORE.md
  └── agents/
      ├── sentinel-work/memory/weeks/
      ├── jira-agent/memory/weeks/
      └── work-code-reviewer/memory/weeks/

personal-agent            →  ~/.openclaw/workspace-personal/
  ├── memory/daily/
  ├── memory/weeks/
  ├── memory/domain/      →  PERSONAL.md
  └── agents/
      ├── budget/memory/weeks/
      └── sentinel-personal/memory/weeks/
```

---

### Weekly Archival Schedule

| Day | Time | Job | Covers |
|-----|------|-----|--------|
| Saturday | 8:00 AM CT | Work Weekly (`72264b60`) | work-agent, sentinel-work, jira-agent, work-code-reviewer |
| Sunday | 8:00 AM CT | Personal Weekly (`57a69d78`) | personal-agent, budget, sentinel-personal |

**Pre-archival:** System cron at 7:30 AM moves daily notes from `memory/daily/` to `memory/weeks/YYYY-WXX/` before the agent's summary job runs.

**Prompt design:** Both weekly jobs embed the full WEEK.md template inline in the prompt (no external file references) for compatibility with local LLMs (Qwen3.5 122B). Explicit `IMPORTANT RULES` section prevents common formatting errors.
