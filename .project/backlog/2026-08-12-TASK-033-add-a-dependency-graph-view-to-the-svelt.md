---
title: "Add a dependency graph view to the Svelte UI"
created: 2026-08-12T00:00:00-03:00
last_updated: 2026-08-12T00:00:00-03:00
priority: P2-M
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: []
depends_on: []
tags: [feat]
---

# Add a dependency graph view to the Svelte UI

`GET /api/graph` already serves nodes, edges, the ready frontier, the blocked set and
any cycles. Nothing in the UI consumes it yet.

**Success:**
- [ ] New `/ui/graph` route rendering nodes and edges
- [ ] Ready / blocked / done visually distinct
- [ ] Cycles highlighted as errors
- [ ] Live updates over the existing SSE feed
