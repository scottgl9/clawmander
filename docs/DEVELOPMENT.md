# Development Guide

Guide for developers contributing to or extending Clawmander.

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git
- Code editor (VS Code recommended)

### Initial Setup

```bash
# Clone repo
git clone git@github.com:scottgl9/clawmander.git
cd clawmander

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install

# Copy env files
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.example .env.local

# Start development servers
cd ../backend && npm run dev    # Terminal 1
cd ../frontend && npm run dev   # Terminal 2
```

### Development URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/health

## Project Structure

```
clawmander/
├── backend/                    # Express API
│   ├── collectors/            # External data collectors
│   ├── config/                # Configuration
│   ├── middleware/            # Express middleware
│   ├── models/                # Data models
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   ├── storage/               # Persistence layer
│   └── server.js              # Entry point
├── frontend/                   # Next.js app
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities
│   │   ├── pages/             # Next.js pages
│   │   └── styles/            # CSS
│   ├── next.config.js         # Next.js config
│   └── tailwind.config.js     # Tailwind config
├── docs/                       # Documentation
├── service.sh                  # Service management
└── README.md                   # Main docs
```

## Backend Development

### Adding a New API Endpoint

**1. Create route handler** (`backend/routes/example.js`):
```javascript
const express = require('express');
const router = express.Router();

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

module.exports = router;
```

**2. Mount in route index** (`backend/routes/index.js`):
```javascript
const exampleRoutes = require('./example');
// ...
app.use('/api/example', exampleRoutes);
```

**3. Test endpoint**:
```bash
curl http://localhost:3001/api/example/hello
```

### Adding a Service

**1. Create service** (`backend/services/ExampleService.js`):
```javascript
const FileStore = require('../storage/FileStore');

class ExampleService {
  constructor(sseManager) {
    this.store = new FileStore('examples.json');
    this.sse = sseManager;
  }

  getAll() {
    return this.store.read();
  }

  create(data) {
    const item = { id: uuid(), ...data, createdAt: new Date().toISOString() };
    this.store.insert(item);
    this.sse.broadcast('example.created', item);
    return item;
  }
}

module.exports = ExampleService;
```

**2. Initialize in server** (`backend/server.js`):
```javascript
const ExampleService = require('./services/ExampleService');
// ...
const exampleService = new ExampleService(sseManager);
```

### Adding SSE Events

**In service**:
```javascript
this.sse.broadcast('event.name', { data: 'value' });
```

**Frontend listener**:
```javascript
useSSE((event) => {
  if (event.type === 'event.name') {
    console.log(event.data);
  }
});
```

When adding frontend-consumed SSE events, also add the event name to the listener array in `frontend/src/hooks/useSSE.js`. Chat exec approvals use `chat.approval` and `chat.approval.resolved`; approval UI actions must send OpenClaw decisions (`allow-once` or `deny`), not display labels like `approve`.

### Working with FileStore

**Read**:
```javascript
const items = this.store.read();  // Returns array from cache
```

**Find by ID**:
```javascript
const item = this.store.findById('some-id');
```

**Insert**:
```javascript
this.store.insert({ id: 'new-id', name: 'Example' });
```

**Update**:
```javascript
this.store.update('some-id', { name: 'Updated' });
```

**Delete**:
```javascript
this.store.remove('some-id');
```

**Filter**:
```javascript
const filtered = this.store.findAll((item) => item.status === 'active');
```

## Frontend Development

### Adding a Component

**1. Create component** (`frontend/src/components/example/Example.js`):
```javascript
export default function Example({ data }) {
  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-2">Example</h3>
      <p className="text-xs text-gray-400">{data.message}</p>
    </div>
  );
}
```

**2. Use in page** (`frontend/src/pages/index.js`):
```javascript
import Example from '../components/example/Example';

export default function Dashboard() {
  return (
    <Layout>
      <Example data={{ message: 'Hello!' }} />
    </Layout>
  );
}
```

### Adding a Page

**Create page** (`frontend/src/pages/newpage.js`):
```javascript
import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { useSSE } from '../hooks/useSSE';

export default function NewPage() {
  // Use refreshKey pattern for live-updating widgets
  const [refreshKey, setRefreshKey] = useState(0);

  const connected = useSSE(useCallback((event) => {
    if (event.type.startsWith('myfeature.')) {
      setRefreshKey((k) => k + 1);
    }
  }, []));

  return (
    <Layout connected={connected}>
      <h1 className="text-2xl font-bold">New Page</h1>
      {/* Pass refreshKey to widgets that should live-update */}
      <MyWidget refreshKey={refreshKey} />
    </Layout>
  );
}
```

**Add to sidebar** (`frontend/src/components/layout/Sidebar.js`):
```javascript
const NAV_ITEMS = [
  // ...
  { href: '/newpage', label: 'New Page', icon: 'N' },
];
```

### Using Hooks

**useAPI - Fetch data**:
```javascript
import { useAPI } from '../hooks/useAPI';
import { api } from '../lib/api';

export default function MyComponent() {
  const { data, loading, error, reload } = useAPI(() => api.tasks.getAll());

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{data.map(/* ... */)}</div>;
}
```

**useSSE - Real-time updates**:
```javascript
import { useSSE } from '../hooks/useSSE';

export default function MyComponent() {
  const [items, setItems] = useState([]);

  const connected = useSSE((event) => {
    switch (event.type) {
      case 'item.created':
        setItems((prev) => [...prev, event.data]);
        break;
      case 'item.updated':
        setItems((prev) => prev.map((i) => i.id === event.data.id ? event.data : i));
        break;
    }
  });

  return <div>Connected: {connected ? 'Yes' : 'No'}</div>;
}
```

### Styling Guidelines

**Use Tailwind classes**:
```javascript
<div className="bg-surface rounded-lg p-4 border border-gray-800">
  <h3 className="text-sm font-semibold text-white mb-2">Title</h3>
  <p className="text-xs text-gray-400">Description</p>
</div>
```

**Color scheme (dark theme)**:
- Background: `bg-surface`, `bg-surface-light`, `bg-surface-lighter`
- Text: `text-white`, `text-gray-300`, `text-gray-400`, `text-gray-600`
- Accent: `text-accent`, `bg-accent`
- Status: `text-green-400`, `text-yellow-400`, `text-red-400`

**Spacing**:
- Small: `gap-2`, `p-2`, `mb-2`
- Medium: `gap-4`, `p-4`, `mb-4`
- Large: `gap-6`, `p-6`, `mb-6`

### Recent UI Improvements

**Dashboard Optimization** (2026-02-08):
- **Work/Personal Items**:
  - Filters out completed items (shown on `/completed/mine` instead)
  - Shows top 5 items by default
  - "Show N more..." button expands to display up to 15 items
  - Cleaner, less cluttered main view

- **Budget Widget**:
  - Collapsed by default to save space
  - Cash flow summary always visible
  - "Show categories" / "Hide categories" toggle
  - Detailed breakdown on demand

These patterns can be reused for other expandable widgets:
```javascript
const [expanded, setExpanded] = useState(false);
const displayItems = expanded ? items.slice(0, 15) : items.slice(0, 5);

// Toggle button
<button onClick={() => setExpanded(!expanded)}>
  {expanded ? 'Show less' : `Show ${hiddenCount} more...`}
</button>
```

## API Development

### Adding API Method

**In `frontend/src/lib/api.js`**:
```javascript
export const api = {
  // ...
  example: {
    getAll: () => fetchJSON('/api/example'),
    getById: (id) => fetchJSON(`/api/example/${id}`),
    create: (data) => fetchJSON('/api/example', { method: 'POST', body: JSON.stringify(data) }),
  },
};
```

### Testing API Locally

```bash
# GET request
curl http://localhost:3001/api/tasks

# POST request (with auth)
curl -X POST http://localhost:3001/api/agents/tasks \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","task":{"title":"Test Task"}}'

# SSE stream
curl -N http://localhost:3001/api/sse/subscribe
```

## Testing

### Manual Testing Checklist

**Backend:**
- [ ] All endpoints return 200
- [ ] Auth middleware blocks unauthenticated writes
- [ ] SSE stream connects and emits events
- [ ] FileStore persists data to JSON
- [ ] OpenClaw collector reconnects on disconnect

**Frontend:**
- [ ] Dashboard loads without errors
- [ ] Kanban board displays tasks
- [ ] SSE updates move cards in real-time
- [ ] Heartbeat timers count down
- [ ] Navigation works (Daily/Weekly/Monthly/Activity)
- [ ] Widgets load data

### Automated Testing

```bash
# Backend unit tests
cd backend && npm test

# Frontend component tests (future)
cd frontend && npm test

# E2E tests (future)
npm run test:e2e
```

## Debugging

### Backend Debugging

**Enable verbose logging**:
```javascript
// In server.js
app.use(morgan('combined'));  // Detailed request logs
```

**Inspect JSON files**:
```bash
cat backend/storage/data/tasks.json | jq .
cat backend/storage/data/agents.json | jq .
```

**View SSE stream**:
```bash
curl -N http://localhost:3001/api/sse/subscribe
```

### Frontend Debugging

**React DevTools**: Install browser extension

**Console logs**:
```javascript
console.log('[DEBUG]', { data, loading, error });
```

**Network tab**: Monitor API calls and SSE events

**Hot reload**: Changes auto-reload in dev mode

## Common Development Tasks

### Reset Database
```bash
cd backend/storage/data
rm -f *.json
# Restart backend to reseed
```

### Change Port
```bash
# backend/.env
PORT=3002

# Restart backend
```

### Add Dependencies

**Backend**:
```bash
cd backend
npm install <package>
```

**Frontend**:
```bash
cd frontend
npm install <package>
```

### Format Code
```bash
# Install prettier (optional)
npm install -g prettier

# Format all files
prettier --write "**/*.{js,jsx,json,md}"
```

## Git Workflow

### Branching
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature

# Create PR on GitHub
```

### Commit Messages
```
# Format: <type>: <subject>

feat: Add budget trend chart
fix: Resolve SSE reconnection issue
docs: Update API documentation
refactor: Simplify TaskService logic
test: Add unit tests for FileStore
```

## Performance Optimization

### Backend
- Use in-memory cache (already implemented)
- Batch SSE broadcasts
- Compress responses
- Add Redis for caching (future)

### Frontend
- Lazy load components: `const Component = dynamic(() => import('./Component'))`
- Memoize expensive calculations: `useMemo`
- Debounce SSE handlers
- Virtualize long lists

## Security Best Practices

- Never commit `.env` files
- Use environment variables for secrets
- Validate all user input
- Use parameterized queries (when DB added)
- Keep dependencies updated: `npm audit fix`

## Deployment

### Production Build

**Frontend**:
```bash
cd frontend
npm run build
npm start  # Production server
```

**Backend**:
```bash
cd backend
NODE_ENV=production npm start
```

### Restarting Services (Systemd)

After making code changes in production:

**Quick restart** (both services):
```bash
# Rebuild frontend if needed
cd frontend && npm run build

# Restart both services
systemctl --user restart clawmander-frontend.service clawmander-backend.service

# Verify they're running
systemctl --user status clawmander-frontend.service clawmander-backend.service
```

**Individual service restart**:
```bash
# Just frontend
systemctl --user restart clawmander-frontend.service

# Just backend
systemctl --user restart clawmander-backend.service
```

**View logs after restart**:
```bash
# Follow logs in real-time
journalctl --user -u clawmander-frontend.service -f
journalctl --user -u clawmander-backend.service -f

# View last 50 lines
journalctl --user -u clawmander-backend.service -n 50
```

**Troubleshooting restart issues**:
```bash
# If backend fails with "address in use"
lsof -ti:3001 | xargs kill -9  # Kill process on port 3001
systemctl --user restart clawmander-backend.service

# If frontend fails with "address in use"
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
systemctl --user restart clawmander-frontend.service
```

### Environment Variables

Production `backend/.env`:
```env
NODE_ENV=production
PORT=3001
AUTH_TOKEN=<strong-random-token>
OPENCLAW_WS_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=<openclaw-token>
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express Documentation](https://expressjs.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org/)
- [MDN Web Docs](https://developer.mozilla.org/)

## Getting Help

- GitHub Issues: Report bugs or request features
- Discussions: Ask questions
- Code Review: Submit PR for feedback
