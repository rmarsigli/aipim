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

Prints the highest-priority task from `backlog/`.

Priority order: `P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3`, oldest first on tie.

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

Visualizes the task dependency graph. Shows which tasks are blocked and by what.

```bash
aipim deps
```

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
| `GET` | `/api/team` | Team members from `config.toml` |
| `GET` | `/api/decisions` | All ADRs |
