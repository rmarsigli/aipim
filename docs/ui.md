# AIPIM UI

A Svelte 5 web interface for AIPIM 2.0. Provides a visual Kanban board, event timeline, and task detail panel on top of the REST API.

## Starting the UI

```bash
# Production — serves ui/dist/ via Hono
aipim ui

# Custom port
aipim ui --port 3141

# Without opening the browser
aipim ui --no-open

# Development — Vite dev server with hot reload
aipim ui --dev
```

In production mode, the UI is served by the same Hono process as the MCP server and REST API. Open `http://localhost:3141/ui/`.

In dev mode, Vite runs on `:5173` and proxies `/api/*` to the Hono server on `:3141`. Open `http://localhost:5173/ui/`.

## Views

### Dashboard `/ui/`

- Stats cards: total tasks, in-progress, backlog, blocked, done.
- Grid of currently in-progress tasks.
- Quick links to Kanban, Timeline, and the raw REST API.

### Kanban Board `/ui/kanban`

Five columns: **Backlog · In Progress · Review · Done · Blocked**.

- Drag a card from one column to another to change its status.
- Drop emits `POST /api/events { type: "task.status_changed", taskId, from, to }`.
- The UI applies an optimistic update immediately and reverts if the request fails.
- The Blocked column shows the number of days each task has been blocked (derived from `updated_at`).
- Cards display: task ID, title, priority (colored left border), task type, assignee.
- Live updates: SSE stream (`GET /api/events/stream`) patches the task list in real time — moving a card in another browser tab updates all open boards automatically.

### Event Timeline `/ui/timeline`

A chronological log of all project events, grouped by day.

**Filters (applied client-side):**

| Filter | Options |
|--------|---------|
| Type | All + each of the 12 event types |
| Member | All + unique actors from loaded events |
| Period | Last 7 days · 30 days · 90 days · All time |

Events load up to 500 entries from `GET /api/events?limit=500`. Newer events appear at the top via SSE without page reload. Clicking an event that has a `taskId` navigates to that task's detail view.

### Task Detail `/ui/task/:id`

Full view of a single task.

**Header:** task ID, status badge, priority badge, task type, assignee, created/updated dates.

**Content panel:**

- Renders the task's `.md` file as HTML using `marked`.
- Click **Edit** to open an inline `<textarea>` with the raw markdown.
- Click **Save** to write the file (`PUT /api/tasks/:id/content`) and emit a `task.content_updated` event.
- Click **Cancel** to discard changes.

**Comment thread:**

- Lists all comments with actor and timestamp.
- Textarea at the bottom — submit with the **Send** button or **Ctrl+Enter**.
- Submitting posts a `task.comment_added` event, then reloads the task to show the server-assigned comment.

**Event history:**

- Chronological list of all events related to this task (`GET /api/tasks/:id/events`).
- Shows: timestamp, event summary, actor.

## Building the UI

The UI lives in `ui/` and is built separately from the CLI.

```bash
cd ui
npm install
npm run build   # → ui/dist/
```

The compiled output in `ui/dist/` is included in the npm package (`files` field in `package.json`) so `aipim ui` works out of the box after a global install.

## Stack

| Package | Version | Role |
|---------|---------|------|
| Svelte | 5 | Framework (runes API) |
| Vite | 6 | Build tool and dev server |
| Tailwind CSS | 4 | Styling (`@import "tailwindcss"`, no config file) |
| marked | latest | Markdown → HTML rendering |

No drag-and-drop library — HTML5 native DnD (`draggable`, `ondragstart`, `ondrop`).
No SSE library — browser-native `EventSource` with a thin wrapper in `ui/src/lib/sse.ts`.

## File Structure

```
ui/
├── index.html
├── vite.config.ts          # base: '/ui/', proxy /api → :3141
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts             # mount(App, ...)
    ├── app.css             # @import "tailwindcss"
    ├── App.svelte          # root: nav + routing via $state/$effect
    ├── lib/
    │   ├── router.ts       # navigate(), getPath()
    │   ├── api.ts          # typed fetch wrappers for all REST endpoints
    │   └── sse.ts          # EventSource wrapper with 3s auto-reconnect
    ├── routes/
    │   ├── Dashboard.svelte
    │   ├── Kanban.svelte
    │   ├── Timeline.svelte
    │   └── Task.svelte
    └── components/
        ├── TaskCard.svelte     # draggable, priority border, isBlocked
        ├── Column.svelte       # drop zone with drag counter
        ├── StatusBadge.svelte
        └── PriorityBadge.svelte
```

## Routing

Client-side routing is implemented without a library. `App.svelte` holds a `$state` variable for the current route and updates it via a `popstate` listener. `navigate(path)` in `lib/router.ts` calls `history.pushState` and dispatches a synthetic `popstate` event.

The Hono server serves `ui/dist/index.html` for any `/ui/*` path that doesn't match a static file (SPA fallback), so deep links and browser refresh work correctly.
