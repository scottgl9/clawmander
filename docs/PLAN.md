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
