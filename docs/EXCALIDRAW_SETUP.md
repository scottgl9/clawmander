# Excalidraw Integration

Integration design for embedding Excalidraw into Clawmander's dashboard and exposing it to agents.

## Overview & Goals

- Embed an excalidraw canvas as a new dashboard page (`/draw`)
- Allow agents to create/update/read diagrams via REST API (extending the `clawmander` skill)
- The existing "Excalidraw Flowchart" skill in `~/.openclaw/skills/` already lets agents generate excalidraw JSON — this integration gives those diagrams a home in the dashboard

## Frontend Integration

### Setup

Install the excalidraw React component:

```bash
cd frontend && npm install @excalidraw/excalidraw
```

### New Page: `frontend/src/pages/draw.js`

Hosts the `<Excalidraw />` React component with:

- **Drawing list sidebar** — similar to the chat session sidebar, lists all saved drawings with title and last-modified timestamp
- **Auto-save** — debounced save to backend on every change (~1s debounce)
- **Load/save** — drawings stored as native excalidraw JSON format
- **Create/delete** — toolbar buttons for new drawings and deleting existing ones

```jsx
import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import Layout from '../components/layout/Layout';

// Excalidraw must be loaded client-side only (uses window/document)
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

export default function DrawPage() {
  const [drawings, setDrawings] = useState([]);
  const [activeDrawing, setActiveDrawing] = useState(null);
  const saveTimerRef = useRef(null);

  const handleChange = useCallback((elements, appState, files) => {
    // Debounced auto-save
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (activeDrawing) {
        // PATCH /api/drawings/:id with { elements, appState, files }
      }
    }, 1000);
  }, [activeDrawing]);

  return (
    <Layout>
      {/* Sidebar: drawing list */}
      {/* Main: <Excalidraw onChange={handleChange} /> */}
    </Layout>
  );
}
```

## Backend API Routes

New file: `backend/routes/drawings.js`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/drawings` | List all drawings (`id`, `title`, `updatedAt`) |
| `GET` | `/api/drawings/:id` | Get full drawing JSON |
| `POST` | `/api/drawings` | Create new drawing (`title`, optional initial `elements`) |
| `PATCH` | `/api/drawings/:id` | Update drawing content |
| `DELETE` | `/api/drawings/:id` | Delete drawing |

### Auth

Same Bearer token pattern as other write endpoints (`Authorization: Bearer <token>`).

### Storage

`drawings/` directory using `FileStore` (consistent with existing patterns like action items, budgets). Each drawing is a JSON file.

### SSE Events

Broadcast on changes so other connected clients update:
- `drawing.created`
- `drawing.updated`
- `drawing.deleted`

Add these event types to `frontend/src/hooks/useSSE.js` event listener array.

## Agent Integration

Agents interact with drawings through the same REST API pattern used for action items:

### Workflow

1. Agent generates excalidraw JSON using the existing "Excalidraw Flowchart" skill
2. Agent POSTs to `/api/drawings` via the `clawmander` skill's `exec` capability
3. Drawing appears on the dashboard `/draw` page in real-time (via SSE)

### Example Agent Usage

```bash
# Create a new drawing
curl -X POST http://localhost:3456/api/drawings \
  -H "Authorization: Bearer $CLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Architecture Diagram",
    "data": {
      "elements": [...],
      "appState": { "viewBackgroundColor": "#ffffff" },
      "files": {}
    }
  }'

# Update an existing drawing
curl -X PATCH http://localhost:3456/api/drawings/<id> \
  -H "Authorization: Bearer $CLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "elements": [...], "appState": {...}, "files": {} }
  }'
```

### Skill Documentation

Update `~/MY_OPENCLAW_ARCHITECTURE/CLAWMANDER_API.md` to document the drawing endpoints. Update the `clawmander` skill's `SKILL.md` so agents know how to use them.

## Dashboard Widget

Optional "Recent Drawings" widget on the main dashboard (like `RecentFeeds`):

- Shows last 3-5 drawings with title and thumbnail preview
- Uses the `refreshKey` SSE pattern (same as Bug 3 fix for action items)
- Clicking a drawing navigates to `/draw?id=<drawingId>`

## Data Format

Excalidraw native JSON format — stored as-is with a metadata wrapper:

```json
{
  "id": "draw_abc123",
  "title": "Architecture Diagram",
  "createdAt": "2026-03-11T10:00:00Z",
  "updatedAt": "2026-03-11T10:05:00Z",
  "data": {
    "elements": [],
    "appState": {
      "viewBackgroundColor": "#ffffff"
    },
    "files": {}
  }
}
```

No transformation needed — `FileStore` saves/loads the full JSON.

## Implementation Checklist

- [x] Install `@excalidraw/excalidraw` in frontend
- [x] Create `frontend/src/pages/draw.js` with Excalidraw component
- [x] Create `backend/routes/drawings.js` with CRUD endpoints
- [x] Add `drawings/` FileStore in backend storage
- [x] Wire SSE events (`drawing.*`) in backend and frontend
- [ ] Update `clawmander` skill docs with drawing endpoints
- [ ] Optional: add "Recent Drawings" dashboard widget

## Implementation Notes

- `@excalidraw/excalidraw` v0.18+ is pure ESM — requires `transpilePackages: ['@excalidraw/excalidraw']` in `frontend/next.config.js` for Next.js/webpack bundling
- Excalidraw CSS (`index.css`) must be imported inside `ExcalidrawWrapper.js` (not in `_app.js`) to avoid stylesheet bleeding into other pages
- Wrap the canvas in `React.memo` to prevent parent re-renders (sidebar list refreshes, saving-state toggles) from causing Excalidraw layout recalculation/twitching
- Use a `savingRef` gate in the SSE handler to suppress re-fetches triggered by the page's own auto-saves
- `EXCALIDRAW_ASSET_PATH` can be configured via **Server Settings** page — stored in localStorage key `clawmander-service-settings`
