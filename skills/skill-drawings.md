# Skill: Drawings (Excalidraw)

Create and manage collaborative drawings on the Clawmander draw canvas. Drawings use the Excalidraw format — elements are vector shapes, text, arrows, etc.

**Base URL**: `http://localhost:3001`
**Auth**: Write endpoints require `Authorization: Bearer <AUTH_TOKEN>`

---

## Drawing Data Format

Drawings store Excalidraw's native format:

```json
{
  "elements": [...],    // array of shape/text/arrow objects
  "appState": {},       // viewport and tool state
  "files": {}           // embedded images (base64)
}
```

For agent-created drawings, `elements` is the key field. An empty drawing uses `{ "elements": [], "appState": {}, "files": {} }`.

---

## List Drawings

```
GET /api/drawings
```

Response:
```json
[
  { "id": "uuid", "title": "Architecture Diagram", "updatedAt": "2026-03-11T12:00:00Z" }
]
```

---

## Get Drawing

```
GET /api/drawings/:id
```

Returns the full drawing object including `data` (elements, appState, files).

---

## Create Drawing

```
POST /api/drawings
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "System Architecture",
  "data": {
    "elements": [],
    "appState": {},
    "files": {}
  }
}
```

Response `201`: full drawing object with `id`.

---

## Update Drawing

```
PATCH /api/drawings/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "data": {
    "elements": [...],
    "appState": {},
    "files": {}
  }
}
```

---

## Delete Drawing

```
DELETE /api/drawings/:id
Authorization: Bearer <token>
```

Response: `{ "success": true }`

---

## SSE Events

Changes broadcast to all connected dashboard clients via `GET /api/sse/subscribe`:

| Event | Payload |
|-------|---------|
| `drawing.created` | Full drawing object |
| `drawing.updated` | Full drawing object |
| `drawing.deleted` | `{ "id": "uuid" }` |

---

## Excalidraw Element Reference

Common element types and their key fields:

### Rectangle / Ellipse / Diamond

```json
{
  "type": "rectangle",
  "id": "unique-id",
  "x": 100, "y": 100,
  "width": 200, "height": 100,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100,
  "text": ""
}
```

### Text

```json
{
  "type": "text",
  "id": "unique-id",
  "x": 150, "y": 130,
  "width": 100, "height": 25,
  "text": "My Label",
  "fontSize": 16,
  "fontFamily": 1,
  "textAlign": "center",
  "strokeColor": "#1e1e1e"
}
```

### Arrow / Line

```json
{
  "type": "arrow",
  "id": "unique-id",
  "x": 300, "y": 150,
  "width": 150, "height": 0,
  "points": [[0, 0], [150, 0]],
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "startBinding": { "elementId": "box-id", "focus": 0, "gap": 8 },
  "endBinding": { "elementId": "other-box-id", "focus": 0, "gap": 8 }
}
```

**`fontFamily`**: `1` = Virgil (handwritten), `2` = Helvetica, `3` = Cascadia (monospace)
**`fillStyle`**: `"solid"`, `"hachure"`, `"cross-hatch"`, `"dots"`

---

## Example: Create a Simple Architecture Diagram

```bash
BASE=http://localhost:3001
TOKEN=changeme

curl -X POST $BASE/api/drawings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agent Architecture",
    "data": {
      "elements": [
        {
          "type": "rectangle",
          "id": "box-agent",
          "x": 50, "y": 100,
          "width": 180, "height": 80,
          "strokeColor": "#1e1e1e",
          "backgroundColor": "#a5d8ff",
          "fillStyle": "solid",
          "strokeWidth": 2,
          "roughness": 1,
          "opacity": 100
        },
        {
          "type": "text",
          "id": "label-agent",
          "x": 90, "y": 128,
          "width": 100, "height": 25,
          "text": "My Agent",
          "fontSize": 16,
          "fontFamily": 1,
          "textAlign": "center",
          "strokeColor": "#1e1e1e"
        },
        {
          "type": "rectangle",
          "id": "box-dashboard",
          "x": 350, "y": 100,
          "width": 180, "height": 80,
          "strokeColor": "#1e1e1e",
          "backgroundColor": "#b2f2bb",
          "fillStyle": "solid",
          "strokeWidth": 2,
          "roughness": 1,
          "opacity": 100
        },
        {
          "type": "text",
          "id": "label-dashboard",
          "x": 380, "y": 128,
          "width": 120, "height": 25,
          "text": "Clawmander",
          "fontSize": 16,
          "fontFamily": 1,
          "textAlign": "center",
          "strokeColor": "#1e1e1e"
        },
        {
          "type": "arrow",
          "id": "arrow-1",
          "x": 230, "y": 140,
          "width": 120, "height": 0,
          "points": [[0, 0], [120, 0]],
          "strokeColor": "#1e1e1e",
          "strokeWidth": 2,
          "startArrowhead": null,
          "endArrowhead": "arrow",
          "startBinding": { "elementId": "box-agent", "focus": 0, "gap": 8 },
          "endBinding": { "elementId": "box-dashboard", "focus": 0, "gap": 8 }
        }
      ],
      "appState": {},
      "files": {}
    }
  }'
```

---

## Tips for Agents

- Use unique string IDs for each element (e.g. `"box-agent"`, `"arrow-1"`) — no UUID library needed
- Layout: leave at least 50px padding between elements; arrows need ~50px horizontal gap to clear box edges
- When updating a drawing, send the **full** `elements` array (not a patch) — the server replaces all elements
- Fetch the current drawing first with `GET /api/drawings/:id` before modifying it
- The dashboard reflects changes in real time via SSE — users see your drawing appear immediately
