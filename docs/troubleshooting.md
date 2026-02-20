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
