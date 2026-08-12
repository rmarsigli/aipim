# Quick Start

## New project

```bash
npm install -g aipim
cd my-project
aipim install --ai claude-code
aipim mcp start &
claude mcp add aipim http://localhost:3141/mcp
```

Tell Claude Code: _"Follow the session start protocol."_ It will read `context.md`, find the next task, and start working.

## Migrating from AIPIM 1.x

```bash
aipim migrate         # backlog/*.md + completed/*.md → events.jsonl + SQLite
aipim mcp start &
claude mcp add aipim http://localhost:3141/mcp
```

## Minimum viable config.toml (team setup)

```toml
[project]
name = "MyApp"

[[team]]
id = "alice"
name = "Alice Smith"
email = "alice@company.com"
role = "tech-lead"
```

Place in `.project/config.toml`. Run `aipim team setup-git` if you skipped `aipim install`.

## Make "done" mean something

Optional, but it is the point of the whole thing. Declare what a finished task requires:

```toml
# .project/config.toml
[checks]
commands = ["npm test", "npm run lint"]
```

`complete_task` is now refused unless those passed against the current state of the work.
See [basic-usage.md](basic-usage.md#making-done-mean-something).

## Verify everything works

```bash
aipim validate           # check installation
aipim task next          # show the next startable task
aipim deps               # dependency graph and what is blocked
curl http://localhost:3141/api/stats  # check MCP server
```
