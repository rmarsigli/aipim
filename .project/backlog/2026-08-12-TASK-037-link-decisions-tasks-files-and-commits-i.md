---
title: "Link decisions, tasks, files and commits into a provenance graph"
created: 2026-08-12T00:00:00-03:00
last_updated: 2026-08-12T18:00:00-03:00
priority: P3
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: []
depends_on: []
tags: [feat]
---

# Link decisions, tasks, files and commits into a provenance graph

`decision.logged` carries an optional `taskId` and `task.content_updated` carries an
optional `commit` that nothing ever populates. Wiring these gives AIPIM something the
code-indexing knowledge graphs cannot derive: why a file looks the way it does.

**Rescoped 2026-08-12 (10h → 6h).** Discovery (2.4) delivered the conversation end of this
graph as a side effect: `sessionId` on `BaseEvent`, plus `session_id` on `tasks` and
`decisions`, means every task and ADR a changeset created already points back at the session
that produced it. What remains is the code end — commits and files.

**Success:**
- [x] ~~ADR ↔ task provenance~~ — done via `session_id` in 2.4
- [ ] `task.content_updated` records the current commit hash
- [ ] Files touched per task recorded (from git, not guessed)
- [ ] `get_related_context(file)` returns the tasks, ADRs and decisions behind a path
- [ ] ADR ↔ task links navigable in the UI
