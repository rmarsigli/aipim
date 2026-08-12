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

## Task dependencies and the ready frontier

Dependencies are events, not frontmatter. Declare one and the dependent task drops out of
the ready frontier until its blocker is done:

```
add_dependency(taskId: "TASK-036", dependsOn: "TASK-035")
```

From then on `get_next_task` and `aipim task next` skip TASK-036 until TASK-035 completes.
`get_task_graph` (or `GET /api/graph`) returns the whole picture: every node with both edge
directions, which dependencies are blocking it, the ready set, the blocked set and any
cycles.

An edge that would close a loop is rejected when you create it, not discovered later:

```
Cannot add TASK-035 → TASK-036: it would create a dependency cycle.
Call get_task_graph to inspect the current edges.
```

A dependency pointing at a task that does not exist counts as blocking. An unknown
prerequisite is not a satisfied one.

Coming from 1.x, `depends_on:` frontmatter is converted into dependency events by
`aipim migrate`, including the short `T001` form. Edges pointing at tasks that were never
migrated are dropped rather than left as permanent blockers.

## Verification evidence

Every `verify_task` run appends one `check.run` event per command, carrying the command,
exit code, pass/fail, duration and a truncated tail of the output. Nothing else in the log
is overwritten, so the history of what passed and when is complete.

Because evidence is timestamped against the task's own history, a check that ran before the
last change is reported as stale rather than accepted:

```
Cannot complete TASK-042 — verification gate not satisfied
(never run: pnpm lint; stale (ran before the last change): pnpm test).
```

Recording evidence does not itself count as a change, so a check never invalidates itself.

Query the evidence directly if you want it outside the agent loop:

```bash
sqlite3 .project/data.db \
  "SELECT task_id, command, passed, created_at FROM checks ORDER BY created_at DESC LIMIT 10"
```

Remember that `data.db` is derived — it is rebuilt from `events.jsonl` on every server start.

> Check commands run with the same trust level as your `package.json` scripts. They come
> from your own `config.toml`. This is not a sandbox boundary.

## Claude Code hooks

`aipim hook install` registers two hooks in `.claude/settings.json`:

| Hook | Effect |
|------|--------|
| `SessionStart` | Injects current project state before your first message |
| `Stop` | Checks that in-progress work has been verified before the agent finishes |

The `Stop` hook only observes by default. To make it hold the line:

```toml
[hooks]
block_on_unverified = true
```

The agent is then prevented from ending its turn while an in-progress task still has failing
or missing checks, and told which task and why. It is opt-in because a hook that fights you
is worse than one that does nothing.

Hooks apply to Claude Code only. Gemini and Cursor still rely on the guidelines in their
prompt files.

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
