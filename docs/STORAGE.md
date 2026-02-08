# Storage Layer

Clawmander uses file-based JSON storage with an in-memory cache. There is no database — all persistence is handled by `FileStore` in `backend/storage/FileStore.js`.

## FileStore

Each service gets its own `FileStore` instance backed by a JSON file in `backend/storage/data/`:

| Service | File | Description |
|---------|------|-------------|
| TaskService | `tasks.json` | Agent tasks (Kanban board) |
| AgentService | `agents.json` | Agent status records |
| HeartbeatService | `heartbeats.json` | Heartbeat history |
| ActionItemService | `action-items.json` | Personal/work action items |
| BudgetService | `budget-categories.json` | Budget categories |
| BudgetService | `budget-transactions.json` | Budget transactions |
| ActivityLogService | `activity-log.json` | API activity log |

The `data/` directory is gitignored. On first run, files are created on demand.

## How It Works

```
          ┌──────────────┐
          │  Service      │
          │  (business    │
          │   logic)      │
          └──────┬────────┘
                 │
          ┌──────▼────────┐
          │  FileStore     │
          │                │
          │  ┌───────────┐ │
          │  │ In-memory │ │  ← All reads served from here
          │  │   cache   │ │
          │  └─────┬─────┘ │
          │        │       │
          │  ┌─────▼─────┐ │
          │  │ JSON file  │ │  ← Writes go to disk + cache
          │  │ (fs.sync)  │ │
          │  └───────────┘ │
          └────────────────┘
```

### Read path
1. If `this.cache` is populated, return it immediately (no I/O)
2. Otherwise, read from disk, parse JSON, cache the result

### Write path
1. Update in-memory cache
2. `fs.writeFileSync()` to disk (synchronous, atomic-ish)

This means reads are always fast (in-memory), and writes are durable but blocking. For a single-user personal dashboard, this is a good trade-off.

## API

| Method | Description |
|--------|-------------|
| `read()` | Returns the full array (from cache or disk) |
| `findById(id)` | Find item by `id` field |
| `findBy(predicate)` | Find first item matching a predicate function |
| `findAll(filterFn?)` | Filter items (or return all if no filter) |
| `insert(item)` | Append item, write to disk |
| `update(id, updates)` | Merge updates into item by id, sets `updatedAt` |
| `remove(id)` | Remove item by id |
| `write(data)` | Replace entire dataset |

## Deduplication (Upsert Pattern)

Since there are no database-level unique constraints, deduplication is enforced in application code at the service layer using upsert methods.

### TaskService.upsert()
- **Dedup key**: `agentId` + `sessionKey` + `runId`
- If all three fields are present and match an existing task → update in place
- If any field is missing or no match → create new task
- Used by `POST /api/agents/tasks` (OpenClaw route)

### ActionItemService.upsert()
- **Dedup key**: `title` + `category`
- Same title in same category = same item → update in place
- Used by `POST /api/work/action-items`

### AgentService.upsert()
- **Dedup key**: `id`
- Pre-existing pattern, used by heartbeat/status flows

### Not deduplicated
- **Budget transactions** — duplicate amounts are legitimate
- **Activity log entries** — append-only by design

## Limitations

- **Not suitable for high write volume** — synchronous file I/O blocks the event loop
- **No concurrent process safety** — a single Node.js process owns each file
- **~1000 items per file** is a practical ceiling before JSON parse time becomes noticeable
- **No indexing** — `findBy` does a linear scan

## Future Migration Path

FileStore can be swapped for SQLite or PostgreSQL without changing the service layer API. The service methods (`create`, `update`, `delete`, `upsert`) would stay the same — only the storage implementation changes.
