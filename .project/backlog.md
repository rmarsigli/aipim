# Backlog

> AIPIM 2.0 — Refatoração completa: JSONL + SQLite + MCP + Svelte UI

## Roadmap

**MVP (2.0)** — Tasks 001–007: core da nova arquitetura
**Fase 2** — Tasks 008–009: suporte a times
**Fase 3** — Tasks 010–015: UI e infraestrutura final

---

## Tasks

| ID | Type | Task | Status | Priority |
|---|---|---|---|---|
| TASK-001 | feat | Implement JSONL event system | backlog | P1-M |
| TASK-002 | feat | Implement SQLite derived state layer | backlog | P1-L |
| TASK-003 | feat | Migration script: existing .md files → events.jsonl | backlog | P1-M |
| TASK-004 | feat | MCP server — Hono + aipim mcp start | backlog | P1-M |
| TASK-005 | feat | MCP read tools (get_project_context, get_next_task, list_tasks, get_task, get_blockers) | backlog | P1-M |
| TASK-006 | feat | MCP write tools (complete_task, update_status, add_comment, log_decision, create_task) | backlog | P1-M |
| TASK-007 | fix  | Fix task next — priority ordering instead of alphabetical | backlog | P1-S |
| TASK-008 | feat | Team configuration — config.toml + identity resolution | backlog | P2-M |
| TASK-009 | feat | Git union merge driver for events.jsonl | backlog | P2-S |
| TASK-010 | feat | REST API — /api/* endpoints on Hono for Svelte UI | backlog | P2-M |
| TASK-011 | feat | Svelte UI — project setup, Vite build, static serving | backlog | P2-M |
| TASK-012 | feat | Svelte UI — Kanban board with drag-and-drop | backlog | P2-L |
| TASK-013 | feat | Svelte UI — Task detail panel with inline markdown editing | backlog | P2-L |
| TASK-014 | feat | Svelte UI — Event timeline view | backlog | P2-M |
| TASK-015 | refactor | Monorepo split — pnpm workspaces (@aipim/core, @aipim/mcp, @aipim/ui) | backlog | P3 |

---

## Dependências

```
TASK-001 (events)
  └── TASK-002 (SQLite)
        └── TASK-003 (migration)
              └── TASK-004 (MCP server)
                    ├── TASK-005 (MCP read tools)
                    │     └── TASK-006 (MCP write tools)
                    └── TASK-008 (team config)
                          └── TASK-009 (union merge)

TASK-002 ──── TASK-007 (fix priority ordering)

TASK-004 + TASK-005 + TASK-006
  └── TASK-010 (REST API)
        └── TASK-011 (Svelte setup)
              ├── TASK-012 (Kanban)
              ├── TASK-013 (Task detail)
              └── TASK-014 (Timeline)
                    └── TASK-015 (Monorepo — só quando necessário)
```
