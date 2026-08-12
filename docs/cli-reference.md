# CLI Reference

## `aipim install`

Scaffolds `.project/` in the current directory. Generates AI prompt files from templates. Configures `.gitattributes`.

```bash
aipim install [options]
```

| Option | Description |
|--------|-------------|
| `--ai <ais...>` | Prompt files to generate: `claude-code`, `gemini`, `cursor` |
| `--guidelines <frameworks...>` | Inject framework guidelines: `react`, `astro`, `vue`, `node`, `rust`, ... |
| `--compact` | Use compact CLAUDE.md (default) |
| `--full` | Use full CLAUDE.md |
| `-y, --yes` | Skip confirmation prompts |
| `--dry-run` | Simulate without writing files |

---

## `aipim mcp start`

Runs migrate → rebuild SQLite → starts Hono HTTP server.

```bash
aipim mcp start [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3141` | Port to listen on |
| `--project <path>` | `process.cwd()` | Project root directory |

After starting, register with Claude Code:

```bash
claude mcp add aipim http://localhost:3141/mcp
```

---

## `aipim migrate`

One-time migration from AIPIM 1.x. Reads `backlog/*.md` and `completed/*.md`, synthesizes events into `events.jsonl`, rebuilds SQLite.

```bash
aipim migrate [--project <path>]
```

Safe to run multiple times — already-migrated tasks are skipped.

---

## `aipim task`

### `aipim task next`

Prints the highest-priority task that is actually startable — a task whose dependencies are
not yet done is skipped, however high its priority. Resolves from `events.jsonl` using the
same code path as the MCP `get_next_task` tool, so the CLI and an agent always agree.

Priority order: `P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3`, oldest first on tie.

Also reports how many other tasks are ready, how many are blocked, and warns about
dependency cycles. When nothing is ready it names what is blocking instead of claiming the
backlog is empty.

### `aipim task init <type> <name>`

Creates a new task file from the template and adds it to `backlog/`.

```bash
aipim task init feat "user authentication"
aipim task init fix "login redirect loop"
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

---

## `aipim team`

### `aipim team list`

Lists all members from `.project/config.toml`.

### `aipim team whoami`

Resolves the current machine's actor identity.

Resolution order: `AIPIM_USER` env → git `user.email` matched to a member id → raw email → `"unknown"`.

### `aipim team add`

Interactive wizard to add a team member to `config.toml`.

### `aipim team setup-git`

Appends the union merge entry to `.gitattributes` (idempotent). Ensures `events.jsonl` never has merge conflicts in team setups.

---

## `aipim update`

Updates scaffolded files (templates, scripts, prompt files) to the latest version. Skips files you have customized (checks signatures). Creates a backup before modifying.

```bash
aipim update [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite customizations |
| `--ai <ais...>` | Regenerate specific AI prompt files |
| `--dry-run` | Simulate without writing |

---

## `aipim validate`

Checks installation health: directory structure, script permissions, file signatures.

```bash
aipim validate
```

---

## `aipim deps`

Prints the task dependency graph, derived from the event log: work in progress, the ready
frontier, what is blocked and by what, and any dependency cycles.

```bash
aipim deps
```

```
Task Dependency Graph

Ready to start:
  TASK-033: Add a dependency graph view to the Svelte UI

Blocked:
  TASK-036: Slim CLAUDE.md down to what the harness cannot enforce
     └─> waiting on TASK-035 [backlog]
```

Dependencies are created with the `add_dependency` MCP tool, or migrated from `depends_on:`
frontmatter when coming from 1.x.

---

## `aipim hook`

Entry points invoked by Claude Code, plus the installer for them.

### `aipim hook install`

Registers AIPIM's hooks in `.claude/settings.json`. `aipim install` already does this when
`claude-code` is among the selected AIs; use this for a project that predates the hooks.

```bash
aipim hook install
```

Hooks you wrote yourself are preserved — only AIPIM's own entries, tagged `aipim-managed`,
are replaced. Running it twice changes nothing. A `settings.json` that cannot be parsed is
left untouched rather than overwritten.

### `aipim hook session-start`

Prints the current project state as session context: task in progress, next ready task,
blocked set, cycles, required checks. Meant to be run by the harness, not by hand.

### `aipim hook stop`

Checks that in-progress work has been verified before the agent finishes. Silent unless the
project opted in with `[hooks] block_on_unverified = true` in `config.toml`.

---

## REST API

Available while `aipim mcp start` is running. CORS is restricted to `localhost`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List tasks. Query: `status`, `assignee`, `priority` |
| `GET` | `/api/tasks/:id` | Task + markdown content + comments |
| `POST` | `/api/events` | Append an event. Body: partial event with `type` field |
| `GET` | `/api/events` | Paginated history. Query: `limit` (max 500), `offset` |
| `GET` | `/api/events/stream` | SSE stream of new events (keep-alive ping every 30s) |
| `GET` | `/api/stats` | Task counts by status |
| `GET` | `/api/graph` | Dependency graph: nodes, edges, ready frontier, blocked set, cycles |
| `GET` | `/api/team` | Team members from `config.toml` |
| `GET` | `/api/decisions` | All ADRs |
