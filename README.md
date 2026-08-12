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

AIPIM is a project manager built around an **append-only event log**. All state (tasks, comments, decisions, dependencies, verification evidence) derives from `events.jsonl`. A SQLite database is rebuilt from those events at startup and used as a fast read model.

An **MCP server** (Model Context Protocol) exposes tools that Claude Code calls directly — no copy-paste, no clipboard workflow. A **REST API** serves the same data for the Svelte UI.

Since 2.2 the log is not only a record of what happened — it is what enforces the process:

- A **verification gate** refuses to mark a task done until the project's checks have actually passed against the current state of the work.
- A **task graph** decides what can start now, so an agent is never handed work that is still blocked.
- **Claude Code hooks** run the session protocol instead of asking the model to remember it.

## Architecture

```
events.jsonl  ──rebuild──▶  SQLite (read model)
                                  │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
              MCP server                    REST API
           (Claude Code)          (/api/* + /ui/* + SSE)
                │                           │
                │                      Svelte UI
        ┌───────┴────────┐          (Kanban · Timeline
        ▼                ▼           Task detail · Stats)
  verification       task graph
      gate        (ready frontier,
  (check.run)      cycles, blockers)
```

All writes go through `appendEvent() → applyEvent()`. The database is never written to directly.

## Quick Start

```bash
# Install globally
pnpm install -g aipim

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

Scaffolds `.project/` in the current directory. Generates `CLAUDE.md` (or `GEMINI.md`, `CURSOR.md`) from templates. Configures `.gitattributes` for union merge on `events.jsonl`. When `claude-code` is among the selected AIs, registers AIPIM's hooks in `.claude/settings.json`.

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
- `GET /api/graph` — dependency graph: nodes, edges, ready frontier, blocked set, cycles
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

### `aipim deps`

Prints the task dependency graph, derived from the event log: what is in progress, what is ready to start, what is blocked and by what, and any dependency cycles.

```bash
aipim deps
```

```
Task Dependency Graph

Ready to start:
  TASK-032: Unify aipim task next with the event-sourced ready frontier
  TASK-033: Add a dependency graph view to the Svelte UI

Blocked:
  TASK-036: Slim CLAUDE.md down to what the harness cannot enforce
     └─> waiting on TASK-035 [backlog]
```

### `aipim hook`

Entry points invoked by Claude Code, plus the installer for them.

```bash
aipim hook install         # register hooks in .claude/settings.json
aipim hook session-start   # emit current project state as session context
aipim hook stop            # check that in-progress work has been verified
```

`session-start` and `stop` are meant to be run by the harness, not by hand. See [Hooks](#hooks).

### `aipim team`

```bash
aipim team list        # list members from .project/config.toml
aipim team whoami      # resolve current actor (AIPIM_USER → git email → member id)
aipim team add         # interactive wizard to add a member
aipim team setup-git   # configure .gitattributes with union merge for events.jsonl
```

### `aipim list skills`

Lists all built-in context skills available to inject.

```bash
aipim list skills
```

```
Available Skills:

  pest            Pest PHP
                  Best practices for the Pest PHP testing framework

  tailwind        TailwindCSS v4
                  Maintainable utility-first class management guidelines

  typescript      Strict TypeScript
                  Strict TypeScript rules banning any and enforcing explicit returns

  laravel         Laravel
  react           React
  vue             Vue 3
  rest-api        REST API Design
  php             Modern PHP
  security        Secure Coding
  vitest          Vitest / Jest
  svelte          Svelte 5
  python          Python
  rust            Rust
  langchain       LangChain / LangGraph
  django          Django
  fastapi         FastAPI
  docker          Docker
  prisma          Prisma ORM
  nextjs          Next.js App Router
```

### `aipim add skill <name>`

Injects a skill's guidelines into `CLAUDE.md` or `GEMINI.md` (standard mode), or into `.ai/guidelines/skill-<name>.blade.php` (Laravel Boost mode). The operation is idempotent — running it twice does not duplicate the content.

```bash
aipim add skill typescript
aipim add skill react
aipim add skill security
```

The skill block is inserted inside the `{{SLOT:guidelines}} … {{/SLOT:guidelines}}` marker in your AI instruction file and the file signature is recalculated automatically.

### `aipim migrate`

One-time migration from AIPIM 1.x. Reads `.project/backlog/*.md` and `.project/completed/*.md`, generates synthetic events, rebuilds SQLite.

### `aipim update`

Updates scaffolded files (templates, scripts) without overwriting customizations.

### `aipim validate`

Checks directory structure, script permissions, and file signatures.

## Verification Gate

Declare what "done" requires, and AIPIM enforces it:

```toml
# .project/config.toml
[checks]
commands = ["pnpm test", "pnpm lint", "pnpm type-check"]
```

With this set, `complete_task` is **rejected** unless every command has a passing run recorded *after the task last changed*:

```
Cannot complete TASK-042 — verification gate not satisfied
(never run: pnpm lint; stale (ran before the last change): pnpm test).
Run verify_task first, or pass force: true to complete anyway
(the bypass is recorded in the event log).
```

`verify_task` runs the commands and records one `check.run` event each — command, exit code, pass/fail, duration and an output tail. That evidence lives in `events.jsonl` alongside everything else, so "this task was verified" is a fact you can audit, not a claim.

Freshness is measured against the work, not the clock: a check that ran before the task's last change is stale. Recording evidence does not itself count as a change, so a check never invalidates itself.

**Escape hatch:** `complete_task` accepts `force: true`, which completes the task and writes `checksBypassed: true` into the event. The bypass is allowed but never invisible.

**No `[checks]` configured?** The gate is a no-op and nothing changes.

> Check commands run with the same trust level as your `package.json` scripts. This is not a sandbox boundary.

## Task Graph

Dependencies are real state, derived from `task.dependency_added` / `task.dependency_removed` events:

```
add_dependency(taskId: "TASK-036", dependsOn: "TASK-035")
```

What this buys you:

- **`get_next_task` returns only startable work.** A task whose dependencies are unfinished is never handed to an agent, no matter how high its priority. When nothing is ready, the tool says so and names what is blocking.
- **The ready frontier is explicit.** `get_task_graph` returns every node with both edge directions, which dependencies are blocking it, the ready set, the blocked set, and any cycles — the basis for deciding what can run in parallel.
- **Cycles are rejected at write time.** `add_dependency` refuses an edge that would close a loop, and reports the existing edges so you can see why.
- **An unknown dependency blocks.** A dependency on a task that does not exist counts as unsatisfied rather than being silently ignored.

Migrating from 1.x, `depends_on:` frontmatter is converted into dependency events automatically, including the short `T001` form.

## Hooks

AIPIM registers two Claude Code hooks so the session protocol is executed by the harness instead of living as prose the model has to remember:

| Hook | Command | What it does |
|------|---------|--------------|
| `SessionStart` | `aipim hook session-start` | Injects current state: task in progress, next ready task, blocked set, cycles, required checks |
| `Stop` | `aipim hook stop` | Checks that in-progress work has been verified before the agent finishes |

`aipim install` writes these when `claude-code` is selected. For an existing project:

```bash
aipim hook install
```

Merging preserves hooks you wrote yourself and replaces only AIPIM's own entries (tagged `aipim-managed`), so re-running is idempotent. A `settings.json` that cannot be parsed is left untouched rather than overwritten.

By default the `Stop` hook only observes. To make it actually hold the line:

```toml
[hooks]
block_on_unverified = true
```

The agent is then stopped from ending its turn while an in-progress task still has failing or missing checks. It is opt-in on purpose — a hook that fights you is worse than one that does nothing.

## Skills

AIPIM has two complementary skill systems:

### Context Modules (`aipim add skill`)

Inject focused coding guidelines directly into your AI instruction file (`CLAUDE.md`, `GEMINI.md`, or `.ai/guidelines/` for Laravel Boost projects). These become part of the model's context on every session — no need to re-explain conventions.

19 built-in skills cover: `pest`, `tailwind`, `typescript`, `laravel`, `react`, `vue`, `rest-api`, `php`, `security`, `vitest`, `svelte`, `python`, `rust`, `langchain`, `django`, `fastapi`, `docker`, `prisma`, `nextjs`.

See [docs/skills-context.md](docs/skills-context.md) for details.

### Active Skills (MCP Tools)

Dynamic MCP tools that are enabled per-project via `active_skills` in `.project/config.toml`. They are merged with the core tools at runtime — no server restart needed.

```toml
[project]
name = "MyApp"
active_skills = ["database"]
```

Currently available:

| Skill | Tools enabled | Description |
|-------|--------------|-------------|
| `database` | `aipim_db_schema`, `aipim_db_query` | Read-only access to any local SQLite database |

`aipim_db_schema` returns the full table/column structure of a `.db` file. `aipim_db_query` executes `SELECT`/`EXPLAIN`/`PRAGMA` statements — write operations are blocked at the driver level.

See [docs/skills-mcp.md](docs/skills-mcp.md) for details.

## MCP Tools

Claude Code has access to these tools via the MCP server:

| Tool | Description |
|------|-------------|
| `get_project_context` | Stats, current task, ready frontier, blockers, cycles, required checks |
| `get_next_task` | Highest-priority task that is actually startable — never a blocked one |
| `get_task_graph` | Full dependency graph: nodes, edges, ready frontier, blocked set, cycles |
| `list_tasks` | All tasks with optional status/assignee/priority filter |
| `get_task` | Single task with comments and full detail |
| `get_blockers` | All blocked tasks |
| `create_task` | Add a task to the backlog |
| `verify_task` | Run the configured checks and record the result as evidence |
| `complete_task` | Mark done, move `.md` to `completed/` — gated on verification |
| `update_task_status` | Change status (backlog → in-progress → review → blocked) |
| `add_dependency` | Declare that a task waits on another. Cycles rejected |
| `remove_dependency` | Remove a dependency edge |
| `assign_task` | Assign to a team member from `config.toml` |
| `add_comment` | Append a comment (immutable) |
| `log_decision` | Write an ADR to `decisions/` |

Additional tools are injected dynamically based on `active_skills` — see [Skills](#skills) above.

## Team Configuration

`.project/config.toml` is optional. Without it, AIPIM works as a solo-dev setup (actor = git email).

```toml
[project]
name = "MyApp"
description = "..."
active_skills = ["database"]  # optional — see Skills section

[checks]                       # optional — see Verification Gate
commands = ["pnpm test", "pnpm lint"]

[hooks]                        # optional — see Hooks
block_on_unverified = true

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
├── config.toml      # project, team, checks and hooks configuration
├── context.md       # session state for the AI
├── current-task.md  # active task checklist
├── backlog/         # YYYY-MM-DD-TASK-NNN-name.md
├── completed/       # archived tasks
├── decisions/       # ADRs
├── _templates/      # task, context, adr templates
└── scripts/         # validate-dod.sh, pre-session.sh, ...
```

`events.jsonl` uses `merge=union` git driver so concurrent team pushes never conflict.

AIPIM also writes `.claude/settings.json` at the project root when Claude Code hooks are installed.

## Development

```bash
pnpm test           # 353 tests
pnpm lint           # eslint + prettier
pnpm build          # tsup → dist/
pnpm type-check

# UI (Svelte 5 + Vite + Tailwind v4)
cd ui && pnpm install
pnpm build          # → ui/dist/
pnpm dev            # Vite dev server on :5173 (proxies /api to :3141)
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
