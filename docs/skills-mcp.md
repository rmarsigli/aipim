# Skills: Dynamic MCP Tools

AIPIM 2.0 features **Zero-Downtime Hot Reloading** for Model Context Protocol (MCP) interactions. This allows you to toggle aggressive, dynamic capabilities specific to your project without modifying the actual agent configuration or restarting the background API wrapper.

## How it works
The `src/mcp/server.ts` routes load the `CORE_TOOLS` (the essential event-sourced logic that records operations like `update_task_status`).

However, right before the server broadcasts its capabilities back to Claude Code (`tools/list`), it intercepts the `projectRoot` and evaluates `.project/config.toml`. 

It looks up the array `active_skills`:
```toml
[project]
name = "My Application"
active_skills = ["database"]
```

## The "Database" Reference Skill
As a proof of concept of contextual tooling, AIPIM features a robust Local Database Module (`src/mcp/skills/database/index.ts`).

If `"database"` is added to the active configuration list, Claude Code immediately gains two extra weapons:

1. `aipim_db_schema`: Extracts SQLite configurations, pulling all relational columns and types from `.project/data.db` via dynamic PRAGMAs.
2. `aipim_db_query`: Can safely execute `SELECT` and `EXPLAIN` statements on the derived read-model, providing direct data context for bug hunting.

### Strict Safety
Because these dynamic tools provide raw database access to LLMs, AIPIM enforces rigorous validations. The `database` skill utilizes a Hard Regex pattern that automatically severs the execute chain if hazardous statements (`INSERT`, `UPDATE`, `DROP`, `ALTER`, `TRUNCATE`, `DELETE`) are attempted, keeping the Event-Sourced integrity flawless and preventing the AI from mangling your data context.
