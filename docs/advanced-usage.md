# Advanced Usage

## Running the MCP server as a service

Use your preferred process manager to keep the server running:

```bash
# pm2
pm2 start "aipim mcp start --port 3141 --project /path/to/project" --name aipim

# systemd (see your distro docs for unit file placement)
# or simply run in a tmux/screen session during development
```

## Multiple projects

Each project gets its own server instance on a different port:

```bash
aipim mcp start --port 3141 --project ~/projects/api
aipim mcp start --port 3142 --project ~/projects/frontend

claude mcp add api    http://localhost:3141/mcp
claude mcp add frontend http://localhost:3142/mcp
```

## Custom event actors

Set `AIPIM_USER` to override git email resolution. Useful in CI or scripts:

```bash
AIPIM_USER=ci-bot aipim migrate --project .
```

## Rebuilding the database

The SQLite database is fully derived from `events.jsonl`. If it gets corrupted or you want a clean state:

```bash
rm .project/data.db
aipim mcp start  # rebuilds automatically on startup
```

## Querying the REST API

```bash
# All in-progress tasks
curl "http://localhost:3141/api/tasks?status=in-progress"

# Task detail with comments
curl "http://localhost:3141/api/tasks/TASK-007"

# Live event feed (SSE)
curl -N "http://localhost:3141/api/events/stream"

# Post an event directly
curl -X POST http://localhost:3141/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"task.comment_added","taskId":"TASK-001","text":"Found root cause."}'
```

## Helper scripts

```bash
.project/scripts/pre-session.sh      # token estimate before a long session
.project/scripts/validate-dod.sh     # checks tests, lint, no debug code
.project/scripts/task-velocity.sh    # velocity and completion estimates
.project/scripts/backlog-health.sh   # flags stale or misconfigured tasks
.project/scripts/analyze-quality.sh  # code quality report
```

## Restoring from events.jsonl

Because the database is rebuilt from events, `events.jsonl` is the only file that matters for backup. Commit it, back it up, treat it as the source of truth.

If you lose `data.db` and have `events.jsonl`, nothing is lost.

## Team collaboration

When two developers push events simultaneously, git's `merge=union` driver keeps all lines from both sides. `events.jsonl` will never have a merge conflict. Run `aipim team setup-git` once per repository to configure this.

The order of events in the merged file may differ from insertion order across machines, but this is harmless — all queries use `ORDER BY timestamp ASC`.
