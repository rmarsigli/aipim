---
title: "Derive productivity metrics from the event log"
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

# Derive productivity metrics from the event log

CLAUDE.md asks a human to hand-calculate estimate accuracy while every input already
lives in `events.jsonl`. Today `estimated_hours` never reaches the log (markdown frontmatter only)
and `actualHours` reaches the event but is dropped by `db.ts`.

**Success:**
- [ ] `estimatedHours` carried on `task.created`, `actualHours` persisted on completion
- [ ] `get_metrics` MCP tool: cycle time, estimate accuracy, time spent blocked, check pass rate
- [ ] Accuracy broken down by priority band so estimates can self-calibrate
- [ ] Metrics Protocol section of CLAUDE.md replaced by a pointer to the tool
