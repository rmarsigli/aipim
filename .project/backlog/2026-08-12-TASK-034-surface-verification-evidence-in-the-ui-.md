---
title: "Surface verification evidence in the UI timeline and task detail"
created: 2026-08-12T00:00:00-03:00
last_updated: 2026-08-12T00:00:00-03:00
priority: P2-M
estimated_hours: 4
actual_hours: 0
status: backlog
blockers: []
depends_on: []
tags: [feat]
---

# Surface verification evidence in the UI timeline and task detail

`check.run` events are recorded and stored but invisible in the UI. The evidence
behind a completed task should be one click away.

**Success:**
- [ ] Timeline renders `check.run` with pass/fail styling
- [ ] Task detail shows the latest check per command with duration
- [ ] Tasks completed with `force` are visibly flagged as bypassed
