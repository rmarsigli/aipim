---
title: "Slim CLAUDE.md down to what the harness cannot enforce"
created: 2026-08-12T00:00:00-03:00
last_updated: 2026-08-12T00:00:00-03:00
priority: P2-S
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
depends_on: [TASK-035]
tags: [docs]
---

# Slim CLAUDE.md down to what the harness cannot enforce

CLAUDE.md is ~21KB of MANDATORY prose. The verification gate, the ready frontier and
the session hooks now enforce a real part of it in code. Prose that duplicates an enforced rule
costs context on every single session and buys nothing.

**Success:**
- [ ] Session Protocol section replaced by a note that the SessionStart hook handles it
- [ ] Quality Gates section points at `[checks]` + `verify_task` instead of restating the checklist
- [ ] Metrics Protocol replaced by `get_metrics` (depends on TASK-035)
- [ ] Measured before/after byte count recorded in the task
