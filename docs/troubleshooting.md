# Troubleshooting

## MCP server won't start

**Port in use:**
```bash
aipim mcp start --port 3142
claude mcp add aipim http://localhost:3142/mcp
```

**Project root not found:**
```bash
aipim mcp start --project /absolute/path/to/project
```

---

## Claude Code doesn't see AIPIM tools

Check the server is running:
```bash
curl http://localhost:3141/api/stats
```

Re-register if needed:
```bash
claude mcp remove aipim
claude mcp add aipim http://localhost:3141/mcp
```

---

## events.jsonl merge conflict

Should not happen if `.gitattributes` is configured correctly. Fix:

```bash
aipim team setup-git
```

If a conflict already exists, keep both sides manually (delete the conflict markers, preserve all JSON lines), then rebuild:

```bash
rm .project/data.db
aipim mcp start  # rebuilds from events.jsonl
```

---

## SQLite database is stale or corrupt

The database is fully derived from `events.jsonl`. Rebuild it:

```bash
rm .project/data.db
aipim mcp start
```

---

## Actor shows as email instead of member id

`config.toml` is missing or the email doesn't match any team member. Check:

```bash
aipim team whoami
aipim team list
```

The email shown by `whoami` must match the `email` field of a team member in `config.toml` exactly.

---

## Migration from 1.x: tasks not appearing

Run with `--project` pointing to the exact directory containing `.project/`:

```bash
aipim migrate --project /path/to/your/project
```

Check `events.jsonl` was created:
```bash
cat .project/events.jsonl | wc -l
```

---

## complete_task is refused

```
Cannot complete TASK-042 — verification gate not satisfied
(never run: pnpm lint; stale (ran before the last change): pnpm test).
```

Working as designed: `[checks] commands` is set in `.project/config.toml` and the evidence is
missing or out of date. Call `verify_task` for that task, then complete it.

- **never run** — the command has no recorded result for this task
- **stale** — it passed, but before the task last changed, so it did not see the current work
- **failing** — the most recent run did not pass. Fix the work, not the gate

If the checks genuinely do not apply, pass `force: true`. The task completes and the event
records `checksBypassed: true`. If you want the gate gone entirely, remove the `[checks]`
section — with nothing declared it is a no-op.

## verify_task times out

Tool handlers get 30s by default; `verify_task` gets 300s because check commands are often
whole test suites. A suite slower than that needs to be split, or narrowed in `[checks]` to a
faster subset (a smoke suite in the gate, the full run in CI).

## Hooks are not firing

Check that they are registered:

```bash
cat .claude/settings.json
```

You should see `aipim hook session-start` and `aipim hook stop`. If not, run
`aipim hook install`.

If they are registered and still nothing happens, the likely cause is `aipim` not being on
`PATH` for the shell Claude Code spawns — the hook commands are invoked by name. Verify with
`which aipim`.

The hooks fail silently by design: a broken hook must never break the session it is attached
to. Run `aipim hook session-start` by hand to see the real error.

## The Stop hook never blocks anything

Blocking is opt-in. Add to `.project/config.toml`:

```toml
[hooks]
block_on_unverified = true
```

It also stays silent when the project has no `[checks]` configured — there is nothing to
verify against.

## aipim ui shows 404

The server only mounts `/ui/*` when `ui/dist/` exists. Versions 2.1.0 through 2.3.0 published
without it: `files` declared the directory but the release build never produced it. Upgrade
to 2.3.1 or later.

Building from source, run `pnpm run build:release` rather than `pnpm run build` — the latter
builds only the CLI.

## validate reports missing scripts

Scripts must be executable:

```bash
chmod 755 .project/scripts/*.sh
```

Or re-run install (won't overwrite customized files):

```bash
aipim install --dry-run  # preview
aipim install
```
