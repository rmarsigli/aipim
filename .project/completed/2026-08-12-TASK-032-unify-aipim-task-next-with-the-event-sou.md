---
title: "Unify aipim task next with the event-sourced ready frontier"
created: 2026-08-12T00:00:00-03:00
last_updated: 2026-08-12T00:00:00-03:00
priority: P1-S
estimated_hours: 2
actual_hours: 0
status: backlog
blockers: []
depends_on: []
tags: [refactor]
---

# Unify aipim task next with the event-sourced ready frontier

The CLI `aipim task next` still parses `.project/backlog/*.md` frontmatter directly
(`src/commands/task.ts`), while the MCP `get_next_task` now resolves the ready frontier from
the event log via `getNextReadyTask`. The two disagree: the CLI happily returns a task that is
blocked by an unfinished dependency.

**Success:**
- [ ] `aipim task next` derives from events + SQLite, not from markdown
- [ ] A task blocked by a dependency is never returned
- [ ] `resolveNextTask` file parsing is deleted along with its tests
- [ ] CLI and MCP return the same task for the same project state
