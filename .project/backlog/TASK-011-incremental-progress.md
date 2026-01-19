---
title: "Implement Incremental Progress Tracking"
created: 2026-01-18T20:05:00-03:00
last_updated: 2026-01-18T20:05:00-03:00
priority: P3
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [task-management, metrics, multi-day-tasks]
related_files: [src/templates/base/.project/_templates/task-template.md]
---

# Task: Implement Incremental Progress Tracking

## Objective

Add daily progress logging to task template so multi-day tasks can track incremental progress and identify velocity changes. Answers: "Am I getting faster or slower?"

**Success:**
- [ ] Task template has Progress Log section
- [ ] Log entries track date, hours, accomplishments
- [ ] Script calculates daily velocity
- [ ] Identifies acceleration/deceleration patterns
- [ ] Helps predict completion date

## Context

**Why:** Large tasks (12h+) span multiple days. Without daily tracking, you can't tell if you're speeding up, slowing down, or hitting blockers until it's too late.

**Scenario:**
```
TASK-015: Oracle Profiling (12h estimated)

Day 1: 2h (Phase 1 complete)
Day 2: 2h (Phase 2 at 50%)
Day 3: 2h (Phase 2 complete)
Day 4: 4h (Phase 3 at 75% - SLOWER!)  ← Blocker detected
Day 5: 1h (Phase 3 complete)
Day 6: 1h (Phase 4 complete)

Total: 12h (matches estimate!)
But: Noticed Phase 3 slowdown early → addressed blocker
```

**Current Pain:**
- Multi-day tasks are black boxes
- Can't see velocity changes
- Discover you're behind schedule too late
- No data for improving future estimates

**Dependencies:**
- [ ] Task template
- [ ] Optional: metrics calculation script

**Related:** Complements TASK-001 (metrics), TASK-002 (breakdown)

## Implementation

### Phase 1: Update Task Template (1h)
- [ ] Add Progress Log section to task-template.md:
  ```markdown
  ## Progress Log

  ### YYYY-MM-DD (Xh)
  **Accomplished:**
  - Item 1
  - Item 2

  **Blockers:**
  - Issue encountered (if any)

  **Notes:**
  - Quick observations

  **Velocity:** X checkboxes/hour
  ```
- [ ] Add to both single-file and directory formats
- [ ] Include example entries

### Phase 2: Velocity Calculation Script (1.5h)
- [ ] Create `.project/scripts/task-velocity.sh`
- [ ] Parse progress log entries
- [ ] Calculate:
  - Daily hours worked
  - Checkboxes completed per day
  - Velocity (checkboxes/hour) per day
  - Trend: ↗️ ↘️ → (speeding up/slowing down/stable)
  - Projected completion date
- [ ] Output:
  ```
  📊 Task Velocity Analysis

  TASK-015: Oracle Profiling
  Estimated: 12h | Actual so far: 11h | Remaining: ~1h

  Daily Progress:
  2026-01-15: 2h, 4 checkboxes (2.0/h) →
  2026-01-16: 2h, 3 checkboxes (1.5/h) ↘️ Slowing
  2026-01-17: 4h, 5 checkboxes (1.25/h) ↘️ Blocker?
  2026-01-18: 1h, 3 checkboxes (3.0/h) ↗️ Recovered!

  Trend: Recovered after Phase 3 blocker
  Projected: Will complete today (on schedule)
  ```

### Phase 3: Integration & Documentation (0.5h)
- [ ] Update basic-usage.md with progress logging workflow
- [ ] Add to session end protocol
- [ ] Create examples

## Definition of Done

### Functionality
- [ ] Progress log section in template
- [ ] Script calculates velocity accurately
- [ ] Identifies trends correctly
- [ ] Projects completion realistically

### Testing
- [ ] Create multi-day task with log entries
- [ ] Run velocity script
- [ ] Verify trend detection
- [ ] Test with various patterns (accelerating, decelerating, blocked)

### Code Quality
- [ ] Clear template format
- [ ] Script handles edge cases
- [ ] Documented workflow

### Documentation
- [ ] Time logged
- [ ] Examples included
- [ ] Updated basic-usage.md

### Git
- [ ] Atomic commits
- [ ] Convention: feat(templates): add incremental progress tracking
- [ ] No conflicts

## Testing

### Manual
- [ ] Log progress over 5 days
- [ ] Include blocker on day 3
- [ ] Run velocity script
- [ ] Verify blocker detection
- [ ] Check projection accuracy

## Technical Notes

**Progress Log Format:**

```markdown
## Progress Log

### 2026-01-15 (2h)
**Accomplished:**
- ✅ Completed Phase 1: Setup & Schema
- ✅ Created PostgreSQL tables
- ✅ Wrote migrations

**Blockers:** None

**Velocity:** 4 checkboxes / 2h = 2.0 items/h

---

### 2026-01-16 (2h)
**Accomplished:**
- ✅ Implemented pin detection
- ✅ Added fork detection
- 🔄 Started skewer pattern (50%)

**Blockers:** None

**Velocity:** 3 checkboxes / 2h = 1.5 items/h (↘️ slowing, normal for complex items)

---

### 2026-01-17 (4h)
**Accomplished:**
- ✅ Completed skewer pattern
- 🔄 Started discovered attack tracker (25%)

**Blockers:**
- ⚠️  Algorithm complexity higher than expected
- Need to research graph traversal patterns

**Velocity:** 1.25 items/h (↘️ blocker impacting speed)

---

### 2026-01-18 (1h)
**Accomplished:**
- ✅ Implemented optimized algorithm
- ✅ Completed discovered attack tracker
- ✅ All Phase 2 checkboxes done

**Blockers:** Resolved (found better algorithm)

**Velocity:** 3.0 items/h (↗️ recovered!)
```

**Velocity Script:**

```bash
#!/bin/bash
# task-velocity.sh

TASK_FILE=".project/current-task.md"

# Extract all progress log entries
ENTRIES=$(grep -A 20 "^### [0-9]" "$TASK_FILE")

# For each entry:
# 1. Parse date and hours
# 2. Count checkboxes completed that day
# 3. Calculate velocity (checkboxes/hour)
# 4. Compare to previous day (trend)

# Output formatted report
echo "📊 Task Velocity Analysis"
echo ""
echo "Daily Progress:"

# Calculate trend
# If velocity increasing: ↗️ Speeding up
# If velocity decreasing: ↘️ Slowing down
# If stable (±15%): → Stable

# Project completion
TOTAL_BOXES=$(grep -c "- \[ \]" "$TASK_FILE")
COMPLETED_BOXES=$(grep -c "- \[x\]" "$TASK_FILE")
AVG_VELOCITY=$(calculate_average_velocity)
REMAINING=$(( (TOTAL_BOXES - COMPLETED_BOXES) / AVG_VELOCITY ))

echo "Projected: $REMAINING hours remaining"
```

**Benefits:**

1. **Early Warning System:**
   - Detect slowdowns immediately
   - Identify blockers before they derail schedule

2. **Better Estimates:**
   - Real velocity data improves future estimates
   - Learn your actual pace for different task types

3. **Motivation:**
   - See daily progress visually
   - Celebrate velocity improvements

4. **Retrospective Data:**
   - Understand what slowed you down
   - Replicate what sped you up

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Daily logging becomes tedious
   - Mitigation: Keep entries minimal (2-3 lines)
2. Risk: Velocity varies too much to be useful
   - Mitigation: Use 3-day rolling average

## References

- Agile: Burndown charts, velocity tracking
- Personal productivity: Daily logs
- Related: TASK-001 (metrics), TASK-002 (breakdown)

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
