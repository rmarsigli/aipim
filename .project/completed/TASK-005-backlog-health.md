---
title: "Add Weekly Backlog Health Check Protocol"
created: 2026-01-18T16:00:00-03:00
last_updated: 2026-01-18T16:00:00-03:00
priority: P3
estimated_hours: 4
actual_hours: 4
status: done
blockers: []
tags: [template, automation, backlog-management]
related_files: [src/templates/base/project-manager.md]
---

# Task: Add Weekly Backlog Health Check Protocol

## Objective

Implement automatic weekly backlog health check that identifies stale tasks, long-term blockers, and suggests cleanup actions to keep backlog manageable and relevant.

**Success:**
- [ ] AI runs health check every Friday automatically
- [ ] Identifies stale tasks (>4 weeks old)
- [ ] Detects long-term blockers (>2 weeks)
- [ ] Suggests archive/re-evaluate actions
- [ ] Backlog stays focused and current

## Context

**Why:** Backlogs grow stale over time with tasks that are no longer relevant, perpetually blocked, or forgotten. Manual cleanup is rare.

**Dependencies:**
- [ ] None

**Related:** Improves backlog quality and focus

## Implementation

### Phase 1: Add Health Check Protocol (Est: 2h)
- [ ] Add section to `src/templates/base/project-manager.md`:
  ```markdown
  ## MANDATORY: Weekly Backlog Health Check (Fridays)

  On Fridays, analyze backlog:
  1. Check for stale tasks (>4 weeks without update)
  2. Check for long-term blocked (>2 weeks)
  3. Generate health report
  4. Suggest cleanup actions
  5. Ask user for archive approval
  ```
- [ ] Define health metrics:
  - Total tasks in backlog
  - Stale task count
  - Blocked task count
  - Average age of tasks
  - Priority distribution

### Phase 2: Create Health Check Script (Est: 1.5h)
- [ ] Create `.project/scripts/backlog-health.sh`
- [ ] Parse all backlog/*.md files
- [ ] Extract frontmatter: created, last_updated, status, blockers
- [ ] Calculate metrics
- [ ] Generate health report markdown

### Phase 3: Add Archive Workflow (Est: 0.5h)
- [ ] Create `.project/backlog/archived/` directory
- [ ] Define archive criteria
- [ ] Update guidelines for archival process
- [ ] Add restore instructions

## Definition of Done

### Functionality
- [ ] Health check protocol documented
- [ ] Script calculates metrics correctly
- [ ] Report format is clear and actionable
- [ ] Archive workflow defined

### Testing
- [ ] Create backlog with mix of old/new tasks
- [ ] Run health check script
- [ ] Verify stale tasks detected
- [ ] Check blocked tasks identified
- [ ] Validate report accuracy

### Code Quality
- [ ] POSIX-compliant bash
- [ ] Error handling for malformed tasks
- [ ] Clear output formatting
- [ ] Comments explain logic

### Documentation
- [ ] Time logged
- [ ] Update docs with health check info
- [ ] Example reports shown
- [ ] Archive/restore instructions

### Git
- [ ] Atomic commits
- [ ] Convention: feat(templates): add backlog health check
- [ ] No conflicts

## Testing

### Manual
- [ ] Create 10 backlog tasks (varying ages)
- [ ] Mark 2 as blocked for >2 weeks
- [ ] Run health check
- [ ] Verify stale/blocked detection
- [ ] Test archive workflow

### Edge Cases
- [ ] Empty backlog → healthy report
- [ ] All tasks fresh → no cleanup needed
- [ ] Missing created/last_updated → handle gracefully

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: False positives on stale tasks - Mitigation: Allow manual override/exclusion
2. Risk: Accidental archive of active tasks - Mitigation: Require user confirmation

## Technical Notes

**Decisions:**
1. Run on Fridays (configurable day of week)
2. Stale threshold: 4 weeks (configurable)
3. Blocker threshold: 2 weeks (configurable)

**Health Report Format:**
```markdown
# Backlog Health Report (2026-01-18)

## Summary
- Total tasks: 15
- Healthy: 10
- Stale (>4 weeks): 3
- Long-term blocked (>2 weeks): 2

## Stale Tasks (No update in 4+ weeks)
1. TASK-012: Feature X (created 2025-12-15, last updated 2025-12-20)
   - Recommendation: Archive (no longer needed) or Re-prioritize

2. TASK-018: Enhancement Y (created 2025-11-30, last updated 2025-12-05)
   - Recommendation: Archive (outdated)

## Long-term Blocked
1. TASK-025: Integration Z (blocked for 3 weeks)
   - Blocker: Waiting for third-party API
   - Recommendation: Follow up or move to icebox

## Actions
- Archive 2 stale tasks? [yes/no]
- Re-evaluate 1 blocked task? [yes/no]
```

**Script Pseudocode:**
```bash
#!/bin/bash
# backlog-health.sh

BACKLOG_DIR=".project/backlog"
NOW=$(date +%s)

for task in "$BACKLOG_DIR"/*.md; do
  created=$(grep -oP 'created: \K.+' "$task")
  updated=$(grep -oP 'last_updated: \K.+' "$task")

  # Calculate age in days
  created_ts=$(date -d "$created" +%s)
  age_days=$(( (NOW - created_ts) / 86400 ))

  # Check if stale (>28 days)
  if (( age_days > 28 )); then
    echo "Stale: $(basename "$task")"
  fi
done
```

## References

- Backlog grooming practices (Scrum)
- Issue triage automation (GitHub, Linear)

## Completion

- [x] All DoD checked
- [x] Time logged
- [x] Context updated
- [x] Script tested
- [x] Documentation complete
