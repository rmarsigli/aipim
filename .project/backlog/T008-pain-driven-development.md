---
title: "Implement Pain-Driven Development Protocol"
created: 2026-01-18T19:10:00-03:00
last_updated: 2026-01-18T19:10:00-03:00
priority: P3
estimated_hours: 4
actual_hours: 0
status: backlog
blockers: []
tags: [workflow, testing, automation]
related_files: [src/templates/base/.project/_templates/task-template.md]
---

# Task: Implement Pain-Driven Development Protocol

## Objective

Formalize the workflow of capturing developer pain points during testing and automatically converting them into backlog tasks. This creates a feedback loop from real usage to improvements.

**Success:**
- [ ] Pain Points section added to task template
- [ ] Script to convert pain points to tasks
- [ ] Integration with testing phase
- [ ] Documentation of pain-to-task workflow

## Context

**Why:** Users discover issues during testing ("Oracle too slow", "Apollo repetitive suggestions") but lose these insights if not immediately documented. Pain-driven development captures real problems as they happen.

**User Workflow:**
```
Develop → Test → Feel Pain → Document Pain → Analyze → Task → Repeat
```

**Dependencies:**
- [ ] Task template update
- [ ] Testing phase protocol

**Related:** Complements code quality analyzer (automated) with human feedback (manual)

## Implementation

### Phase 1: Update Task Template (1h)
- [ ] Add "Pain Points" section to task-template.md
- [ ] Include during testing phase
- [ ] Format:
  ```markdown
  ## Pain Points (During Testing)

  ### Performance
  - [ ] Feature X too slow (>5s response time)
    **Impact:** High - blocks user workflow
    **Frequency:** Every request
    **Action:** → Create task for optimization

  ### UX Issues
  - [ ] Error messages unclear
    **Impact:** Medium - confuses users
    **Frequency:** Occasional
    **Action:** → Create task for better error handling

  ### Technical Debt
  - [ ] Code duplication in Y and Z modules
    **Impact:** Low - maintenance burden
    **Frequency:** N/A
    **Action:** → Create refactoring task
  ```

### Phase 2: Create Pain-to-Task Script (2h)
- [ ] Create `.project/scripts/pain-to-tasks.sh`
- [ ] Parse "Pain Points" from current-task.md
- [ ] Generate task files for each pain point
- [ ] Include:
  - Original pain description
  - Impact/frequency from pain point
  - Link back to task that revealed it
- [ ] Auto-prioritize based on impact:
  - High impact → P1-S
  - Medium impact → P2-M
  - Low impact → P3

### Phase 3: Testing Protocol Integration (0.5h)
- [ ] Add to session protocol: "Document pains during testing"
- [ ] Update basic-usage.md with pain-driven workflow
- [ ] Add to Definition of Done: "Pain points documented"

### Phase 4: Examples & Documentation (0.5h)
- [ ] Create example pain points from DelphiChess
- [ ] Show conversion to tasks
- [ ] Document when to create pain points vs bugs

## Definition of Done

### Functionality
- [ ] Pain Points section in task template
- [ ] Script converts pains to tasks
- [ ] Auto-prioritization works
- [ ] Integration with workflow clear

### Testing
- [ ] Add pain points to sample task
- [ ] Run pain-to-tasks.sh
- [ ] Verify generated tasks are correct
- [ ] Test with various impact levels

### Code Quality
- [ ] Script handles edge cases
- [ ] Clear error messages
- [ ] Documented workflow

### Documentation
- [ ] Time logged
- [ ] Examples included
- [ ] Updated basic-usage.md

### Git
- [ ] Atomic commits
- [ ] Convention: feat(templates): add pain-driven development protocol
- [ ] No conflicts

## Testing

### Manual
- [ ] Create task with 5 pain points
- [ ] Run pain-to-tasks.sh
- [ ] Verify 5 tasks created in backlog/
- [ ] Check prioritization matches impact
- [ ] Validate task format

## Technical Notes

**Pain Point Format:**

```markdown
## Pain Points (During Testing)

### Category: Performance
- [ ] Oracle Elo calculation too slow (>5s per game)
  **Impact:** High - blocks batch analysis
  **Frequency:** Every game analyzed
  **Root cause:** No caching, recalculates from scratch
  **Action:** → TASK-023-cache-elo-calculations
```

**Generated Task:**

```yaml
---
title: "Fix: Oracle Elo calculation performance"
created: 2026-01-18T19:00:00-03:00
priority: P1-M  # High impact = P1
estimated_hours: 3
tags: [performance, oracle, pain-point]
discovered_in: TASK-015-oracle-profiling
---

# Pain Point

**Original task:** TASK-015 Oracle Profiling (2026-01-18)
**Category:** Performance
**Impact:** High - blocks batch analysis workflow
**Frequency:** Every game analyzed

## Problem

Oracle Elo calculation takes >5s per game, making batch analysis
of 100+ games impractical (8+ minutes).

**Root cause:** No caching, recalculates from scratch each time.

## Suggested Fix

1. Implement Redis cache for Elo calculations
2. Cache key: game_id + position_hash
3. TTL: 24 hours (Elo rarely changes)
4. Fallback to calculation if cache miss

## Expected Improvement

- Target: <500ms per game
- Batch 100 games: 8min → 50s (90% faster)
```

**Pain vs Bug Distinction:**

| Pain Point | Bug |
|-----------|-----|
| Subjective ("feels slow") | Objective ("crashes") |
| Enhancement | Fix |
| Discovered during normal use | Discovered during testing |
| Priority based on impact | Priority based on severity |
| Goes to backlog/ | Goes to current sprint |

**Script Logic:**

```bash
#!/bin/bash
# pain-to-tasks.sh

TASK_FILE=".project/current-task.md"
COUNTER=1

# Extract pain points
grep -A 10 "^- \[ \].*Pain" "$TASK_FILE" | while read -r line; do
  # Parse: description, impact, frequency
  DESCRIPTION=$(echo "$line" | sed 's/- \[ \] //')
  IMPACT=$(grep -A 1 "$line" | grep "Impact:" | cut -d: -f2)

  # Auto-prioritize
  if [[ "$IMPACT" == *"High"* ]]; then
    PRIORITY="P1-M"
  elif [[ "$IMPACT" == *"Medium"* ]]; then
    PRIORITY="P2-M"
  else
    PRIORITY="P3"
  fi

  # Generate task
  TASK_ID=$(printf "PAIN-%03d" $COUNTER)
  cat > ".project/backlog/${TASK_ID}-${SLUG}.md" <<EOF
---
title: "Fix: ${DESCRIPTION}"
priority: ${PRIORITY}
tags: [pain-point]
---
# Pain Point
${FULL_CONTEXT}
EOF

  COUNTER=$((COUNTER + 1))
done
```

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Too many pain points → backlog bloat
   - Mitigation: Only convert High/Medium impact
2. Risk: Vague pain descriptions
   - Mitigation: Template requires root cause + action

## References

- User feedback: Testing → Pain → Task workflow
- Agile: Retrospective practices
- Continuous improvement methodologies

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
