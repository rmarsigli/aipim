# AIPIM

```text
    ▄▄█▄▄      █████╗ ██╗██████╗ ██╗███╗   ███╗
  ▀▀▀███▀▀▀   ██╔══██╗██║██╔══██╗██║████╗ ████║
     ███      ███████║██║██████╔╝██║██╔████╔██║
   ▄█████▄    ██╔══██║██║██╔═══╝ ██║██║╚██╔╝██║
  ▐███████▌   ██║  ██║██║██║     ██║██║ ╚═╝ ██║
   ▀█████▀    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝     ╚═╝
     ▀█▀      ═════════════════════════════════
```

> **Artificial Intelligence Project Instruction Manager** — event-sourced project management with MCP server.

## What it is

AIPIM 2.x is a project manager built around an **append-only event log**. All state (tasks, comments, decisions, assignments) derives from `events.jsonl`. A SQLite database is rebuilt from those events at startup and used as a fast read model.

An **MCP server** (Model Context Protocol) exposes tools that Claude Code calls directly — no copy-paste, no clipboard workflow. A **REST API** serves the same data for the Svelte UI.

## Architecture

```
events.jsonl  ──rebuild──▶  SQLite (read model)
                                  │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
              MCP server                    REST API
           (Claude Code)          (/api/* + /ui/* + SSE)
                                            │
                                       Svelte UI
                                  (Kanban · Timeline
                                   Task detail · Stats)
```

All writes go through `appendEvent() → applyEvent()`. The database is never written to directly.

## Quick Start

```bash
# Install globally
npm install -g aipim

# Initialize in your project
cd my-project
aipim install

# Start the MCP server (default port 3141)
aipim mcp start

# Register with Claude Code
claude mcp add --transport http aipim http://localhost:3141/mcp

# Open the visual UI
aipim ui
# Note: aipim ui already runs aipim mcp start, you don't need to use both
```

Claude Code will now call AIPIM tools directly. No session prompts, no file pasting. Open the UI at `http://localhost:3141/ui/` for a visual Kanban board, event timeline, and task detail panel.

If you are migrating from AIPIM 1.x:

```bash
aipim migrate   # reads backlog/*.md and completed/*.md → events.jsonl + SQLite
```

## Commands

### `aipim install`

Scaffolds `.project/` in the current directory. Generates `CLAUDE.md` (or `GEMINI.md`, `CURSOR.md`) from templates. Configures `.gitattributes` for union merge on `events.jsonl`.

```bash
aipim install [--ai claude-code|gemini|cursor] [--guidelines react|astro|...] [--dry-run]
```

### `aipim mcp start`

Runs migrate → rebuild → starts Hono server.

```bash
aipim mcp start [--port 3141] [--project /path/to/project]
```

Endpoints:
- `POST /mcp` — JSON-RPC 2.0 for Claude Code
- `GET /api/tasks` — task list with optional filters (`status`, `assignee`, `priority`)
- `GET /api/tasks/:id` — task + markdown content + comments
- `GET /api/tasks/:id/events` — events related to a specific task
- `PUT /api/tasks/:id/content` — overwrite the task's `.md` file
- `POST /api/events` — write an event
- `GET /api/events` — paginated history (`limit` max 500, `offset`)
- `GET /api/events/stream` — SSE real-time feed
- `GET /api/stats` — task counts by status
- `GET /api/team` — team members from `config.toml`
- `GET /api/decisions` — ADRs
- `GET /ui/*` — Svelte UI (served from `ui/dist/` when built)

### `aipim ui`

Starts the server and opens the Svelte UI in the browser.

```bash
aipim ui [--port 3141] [--project /path] [--open] [--dev]
```

| View | URL | Description |
|------|-----|-------------|
| Dashboard | `/ui/` | Stats overview + in-progress tasks |
| Kanban | `/ui/kanban` | Columns by status, HTML5 drag-and-drop |
| Timeline | `/ui/timeline` | Chronological event log with filters |
| Task detail | `/ui/task/:id` | Markdown content, editor, comments, history |

In production (`aipim ui`), static files from `ui/dist/` are served by Hono at `/ui/*`. In development (`aipim ui --dev`), Vite runs on port 5173 and proxies `/api` to Hono.

### `aipim task`

```bash
aipim task next              # show highest-priority backlog task
aipim task init <type> <name>  # create a new task file
```

Priority order: `P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3`, oldest first on tie.

### `aipim team`

```bash
aipim team list        # list members from .project/config.toml
aipim team whoami      # resolve current actor (AIPIM_USER → git email → member id)
aipim team add         # interactive wizard to add a member
aipim team setup-git   # configure .gitattributes with union merge for events.jsonl
```

### `aipim migrate`

One-time migration from AIPIM 1.x. Reads `.project/backlog/*.md` and `.project/completed/*.md`, generates synthetic events, rebuilds SQLite.

### `aipim update`

Updates scaffolded files (templates, scripts) without overwriting customizations.

### `aipim validate`

Checks directory structure, script permissions, and file signatures.

## MCP Tools

Claude Code has access to these tools via the MCP server:

| Tool | Description |
|------|-------------|
| `get_project_context` | Project name, stats, active blockers, recent decisions |
| `get_next_task` | Highest-priority backlog task |
| `list_tasks` | All tasks with optional status/assignee/priority filter |
| `get_task` | Single task with comments and full detail |
| `get_blockers` | All blocked tasks |
| `create_task` | Add a task to the backlog |
| `complete_task` | Mark done, move `.md` to `completed/` |
| `update_task_status` | Change status (backlog → in-progress → review → blocked) |
| `assign_task` | Assign to a team member from `config.toml` |
| `add_comment` | Append a comment (immutable) |
| `log_decision` | Write an ADR to `decisions/` |

## Team Configuration

`.project/config.toml` is optional. Without it, AIPIM works as a solo-dev setup (actor = git email).

```toml
[project]
name = "MyApp"
description = "..."
active_skills = ["database"] # Dynamically enables local MCP tools per project

[[team]]
id = "alice"
name = "Alice Smith"
email = "alice@example.com"
role = "tech-lead"
areas = ["backend", "architecture"]
```

Actor resolution order: `AIPIM_USER` env → git `user.email` matched to a team member id → raw email → `"unknown"`.

## .project/ Structure

```
.project/
├── events.jsonl     # append-only event log (source of truth)
├── data.db          # SQLite (derived, gitignored)
├── config.toml      # project + team configuration
├── context.md       # session state for the AI
├── current-task.md  # active task checklist
├── backlog/         # YYYY-MM-DD-TASK-NNN-name.md
├── completed/       # archived tasks
├── decisions/       # ADRs
├── _templates/      # task, context, adr templates
└── scripts/         # validate-dod.sh, pre-session.sh, ...
```

`events.jsonl` uses `merge=union` git driver so concurrent team pushes never conflict.

## Development

```bash
npm test           # 214 tests
npm run lint       # eslint + prettier
npm run build      # tsup → dist/
npm run type-check

# UI (Svelte 5 + Vite + Tailwind v4)
cd ui && npm install
npm run build      # → ui/dist/
npm run dev        # Vite dev server on :5173 (proxies /api to :3141)
```

## Monorepo — why we didn't split

A monorepo split into `@aipim/core`, `@aipim/mcp`, and `@aipim/ui` was evaluated at the end of the 2.0 release. The conclusion was **not now**.

The full npm tarball is **107 KB** (328 KB unpacked), well under any practical size concern. There is no external demand for `@aipim/core` or `@aipim/ui` as standalone packages, and no separate contributor teams working on isolated areas. The complexity of pnpm workspaces, cross-package build ordering, and workspace-linked imports would add real maintenance cost for zero user benefit at this scale.

Revisit if any of these conditions become true:

- The tarball grows beyond 10 MB (e.g. from bundled assets).
- External projects want to import `@aipim/core` without the CLI.
- `@aipim/ui` needs to run against a non-Hono server.
- Separate contributor teams form around distinct packages.

Until then, a single package is the right call.

## License

[MIT](LICENSE)
