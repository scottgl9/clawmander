# Clawmander Dashboard

**Your personal command center for life, work, and AI agents.**

## Overview

Clawmander is a comprehensive dashboard that aggregates data from OpenClaw, your workspace, financial APIs, and job search systems into a unified view.

## Features

### 🤖 Agent Status (Kanban)
- Real-time view of what agents are working on
- Next heartbeat countdown timer
- Agent idle/active status
- Current tasks and progress

### 💼 Work View
- Action items from MEMORY.md and daily notes
- Current work brief (meetings, priorities, blockers)
- ThinPro status, Jira tickets, team updates

### 💰 Budget & Finance
- Category breakdown (via Lunchflow API)
- 6-month spending trends with charts
- Bill reminders and due dates

### 📅 Upcoming Events
- Bills due (with 7-day warning threshold)
- Calendar events (next 48 hours)
- Important deadlines

### 💼 Job Postings
- Recent matches (last 3 days)
- Houston → Austin → Remote prioritization
- Direct application links
- Match score and reasoning

### 📊 Time Views
- **Daily**: Today's priorities, meetings, action items
- **Weekly**: Week overview, progress tracking
- **Monthly**: Month-at-a-glance, milestone tracking

### 🔒 Activity Log
- Security audit trail
- Agent actions and API calls
- Timestamped event log

## Architecture

```
clawmander/
├── backend/           # Node.js/Express REST API
│   ├── server.js      # Main server
│   ├── routes/        # API endpoints
│   ├── collectors/    # Data collection modules
│   └── models/        # Data models
├── frontend/          # React/Next.js dashboard
│   ├── components/    # UI components
│   ├── pages/         # Views (daily, weekly, monthly)
│   └── api/           # API client
└── docs/              # Documentation
```

## Data Sources

1. **OpenClaw Sessions API** - Agent status, active sessions
2. **Memory Files** - Action items, priorities, notes
3. **Lunchflow API** - Budget data, transactions
4. **Job Search Results** - Recent matches from job-auto-apply
5. **Heartbeat State** - Last check times, next heartbeat
6. **Activity Logs** - Security audit trail

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + Next.js
- **Charts**: Chart.js or Recharts
- **Styling**: Tailwind CSS
- **Updates**: Server-Sent Events (SSE) for real-time updates

## Installation

```bash
cd ~/sandbox/personal/clawmander

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Start backend
cd ../backend && npm start

# Start frontend (in another terminal)
cd ../frontend && npm run dev
```

## API Endpoints

### Agent Status
- `GET /api/agents/status` - Current agent status
- `GET /api/agents/heartbeat` - Next heartbeat info

### Work
- `GET /api/work/action-items` - Current action items
- `GET /api/work/brief` - Current work brief
- `GET /api/work/jira` - Jira ticket status

### Budget
- `GET /api/budget/summary` - Current month summary
- `GET /api/budget/trends?months=6` - 6-month trends
- `GET /api/budget/upcoming-bills` - Bills due soon

### Jobs
- `GET /api/jobs/recent` - Recent job matches
- `GET /api/jobs/applied` - Application tracking

### Views
- `GET /api/views/daily` - Daily view data
- `GET /api/views/weekly` - Weekly view data
- `GET /api/views/monthly` - Monthly view data

### Activity
- `GET /api/activity/log?limit=100` - Recent activity
- `POST /api/activity/log` - Log new activity

## Configuration

Create `.env` files:

**backend/.env**:
```
PORT=3001
LUNCHFLOW_API_KEY=your_key_here
OPENCLAW_WORKSPACE=/home/scottgl/.openclaw/workspace
NODE_ENV=development
```

**frontend/.env**:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Auto-Update Mechanism

Dashboard updates automatically on each heartbeat via:
1. Backend polls OpenClaw data sources every 30 seconds
2. Frontend subscribes to SSE stream for real-time updates
3. No AI required - pure data aggregation

## Security

- Activity log tracks all API calls
- CORS restricted to localhost
- API key validation for sensitive endpoints
- Read-only access to OpenClaw data

## Development

```bash
# Run backend in watch mode
cd backend && npm run dev

# Run frontend in dev mode
cd frontend && npm run dev
```

Dashboard will be available at `http://localhost:3000`

## Future Enhancements

- Mobile responsive design
- Dark/light theme toggle
- Customizable widgets
- Export reports (PDF/CSV)
- Alert notifications
- Multi-user support (for Vanessa)
