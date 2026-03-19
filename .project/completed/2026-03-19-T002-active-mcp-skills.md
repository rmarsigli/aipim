---
title: "Implement Active Skills (MCP Tools)"
created: 2026-03-19T15:55:00-03:00
last_updated: 2026-03-19T15:55:00-03:00
priority: P1-L
estimated_hours: 12
actual_hours: 0
status: backlog
blockers: []
tags: [backend, mcp, skills, architecture]
related_files: ["src/mcp/server.ts", "src/mcp/tools/index.ts"]
---

# Task: Implement Active Skills (MCP Tools)

## Objective

Evolve AIPIM's MCP server into a fully dynamic orchestrator that loads active "Skills" (Specialized MCP Tools) on demand. Instead of a hardcoded `ALL_TOOLS` array, the server reads the project's context and dynamically exposes powerful, active tools (like database querying or GitHub integration) only when the relevant skill is activated by the user.

**Success:**
- [ ] Users can define `active_skills: ["database", "github"]` in their AIPIM config.
- [ ] AIPIM dynamically mounts MCP tools like `aipim_db_query` only if the `database` skill is active.
- [ ] Implementation of a reference "Database Skill" showcasing how agents can query local schemas actively without switching contexts.

## Context

**Why:** Currently, the MCP server hosts static project management tools (`create_task`, `get_project_context`). Extending this to support "Active Skills" transforms AIPIM from a passive note-taker into an active orchestrator. If an agent needs to fix a bug in a SQL query, having the `database` skill active allows it to call `aipim_db_schema` and `aipim_db_query` automatically without the developer moving a finger.

## Implementation

### Phase 1: Skill Configuration & Registry (3h)
- [ ] Define where active skills are stored (recommendation: `.project/skills.json` or `.project/config.toml`).
- [ ] Refactor `src/mcp/tools/index.ts` to separate `CORE_TOOLS` (always loaded) from a new `SkillRegistry`.
- [ ] Create `src/mcp/skills/index.ts` to manage the discovery and schema validation of custom skills.

### Phase 2: Dynamic Tool Mounting (3h)
- [ ] Refactor `src/mcp/server.ts` `tools/list` logic to dynamically merge `CORE_TOOLS` with the tools from any activated skill.
- [ ] Refactor `tools/call` to route execution properly to the corresponding skill handler.
- [ ] Add caching or live-reloading mechanisms so picking up a new skill doesn't require restarting the MCP server (watching `.project/config`).

### Phase 3: Reference "Database" Skill (4h)
- [ ] Create directory `src/mcp/skills/database/`.
- [ ] Implement MCP Tool `aipim_db_schema`: Accepts table names and returns exact schema (columns, types, indexes).
- [ ] Implement MCP Tool `aipim_db_query`: Safely executes `SELECT` (read-only) queries against a local DB (defined via `.env` or config).
- [ ] Register this default skill in the newly created `SkillRegistry`.

### Phase 4: Testing & Documentation (2h)
- [ ] Write integration tests simulating `tools/list` with different active skills configurations in `tests/mcp/server.test.ts`.
- [ ] Validate edge cases (e.g., calling a tool from a deactivated skill returns a clear RPC error `-32601`).
- [ ] Document in `README.md` and `docs/skills.md` how developers can author their own custom MCP active skills for AIPIM.

## Definition of Done

### Functionality
- [ ] Works as specified
- [ ] Edge cases: Missing config files gracefully fallback to core tools only. Invalid database credentials return clean MCP errors, not server crashes.
- [ ] Loading states: Tools are loaded eagerly without blocking startup.

### Testing
- [ ] Unit tests: `src/mcp/skills/*` logic completely covered.
- [ ] Coverage >80%
- [ ] Integration tests verify that MCP protocol respects JSON-RPC 2.0 perfectly regardless of dynamic tools.

### Code Quality
- [ ] PSR-12 / ESLint compliant
- [ ] Complex dynamic routing logic properly commented
- [ ] No debug statements or stray `console.log` in JSON-RPC paths.

### Documentation
- [ ] Time logged
- [ ] ADR if architectural routing decisions are made (ex: Hot-reloading vs Restarting).
- [ ] README updated with Active Skills architecture map.

### Git
- [ ] Atomic commits mapping directly to the phases (Ex: `feat(mcp): implement dynamic skill router`)
- [ ] Convention: type(scope): msg
- [ ] No conflicts

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Security. If `aipim_db_query` is exposed, an agent could run destructive queries.
   - Mitigation: Ensure the query runner strictly filters for `SELECT`/`EXPLAIN` or wraps connections in a read-only user mode. Document the risk strictly.
