---
title: "Implement Interruption Recovery Protocol"
created: 2026-01-18T20:10:00-03:00
last_updated: 2026-01-18T20:10:00-03:00
priority: P3
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [cli, context-preservation, interruptions]
related_files: [src/commands/, .project/context.md]
---

# Task: Implement Interruption Recovery Protocol

## Objective

Create `aipim pause` and enhanced `aipim resume` to handle emergency interruptions without losing context. Solves "production fire broke my flow" problem.

**Success:**
- [ ] `aipim pause --reason="description"` saves current state
- [ ] Creates snapshot of work-in-progress
- [ ] `aipim resume` detects paused state
- [ ] Restores exact context after interruption
- [ ] Tracks interruption frequency/impact

## Context

**Why:** Developers get interrupted constantly (production bugs, meetings, urgent requests). Each interruption loses 10-15min of context restoration.

**Scenario:**
```
10:00 - Working on TASK-015 Phase 2, skewer pattern
10:30 - Client: "PRODUCTION DOWN! Payments failing!"
10:31 - *Drops everything, switches context*
13:00 - Bug fixed, deployedbr/>13:01 - *Returns to dev*
13:02 - "...WTF was I doing? What file? What line? What approach?"
13:15 - Finally back in flow (14min lost)
```

**With Interruption Recovery:**
```
10:30 - $ aipim pause --reason="Production payment bug"
        [Snapshot saved: current file, line, checkboxes, approach]
13:01 - $ aipim resume
        📎 Interrupted 2.5h ago: Production payment bug
        🎯 You were: Implementing skewer pattern in src/oracle/patterns/skewer.py:45
        🔄 Approach: Using graph traversal to detect pins
        💡 Next: Complete skew_detector() function
        Ready to continue? [Y]
13:02 - Back in flow immediately (13min saved!)
```

**Dependencies:**
- [ ] TASK-010 (Session Resume) - uses similar restoration logic
- [ ] context.md structure

**Related:** TASK-010 (resume), TASK-009 (start)

## Implementation

### Phase 1: Pause Command (1h)
- [ ] Create `aipim pause [--reason]`
- [ ] Capture current state:
  - Current file (from git status)
  - Last line edited (git diff)
  - Current phase/checkbox
  - Time of interruption
  - Reason for pause
  - Unsaved changes? (git status)
- [ ] Save to `.project/.interruption-snapshot.json`:
  ```json
  {
    "timestamp": "2026-01-18T10:30:00",
    "reason": "Production payment bug",
    "task": "TASK-015-oracle-profiling.md",
    "phase": "Phase 2: Tactical Pattern Detection",
    "current_checkbox": "Implement skewer pattern",
    "current_file": "src/oracle/patterns/skewer.py",
    "last_line": 45,
    "approach_notes": "Using graph traversal for pin detection",
    "uncommitted_changes": true
  }
  ```
- [ ] Offer to stash changes: "Stash uncommitted work? [Y/n]"

### Phase 2: Enhanced Resume (1.5h)
- [ ] Detect interruption snapshot on `aipim resume`
- [ ] Show interruption banner:
  ```
  📎 Interrupted Session Detected

  ⏸️  Paused: 2.5 hours ago (Production payment bug)

  🎯 You were working on:
     TASK-015: Oracle Profiling
     Phase 2: Tactical Pattern Detection
     Current: Implement skewer pattern

  📁 Last file: src/oracle/patterns/skewer.py:45

  💡 Your approach:
     Using graph traversal for pin detection

  ⚠️  You have uncommitted changes (stashed)
     Run: git stash pop

  Ready to restore context? [Y/n]
  ```
- [ ] Option to restore:
  - Checkout correct file
  - Show last edited lines
  - Pop stash if exists
  - Run `aipim start` for full context

### Phase 3: Interruption Tracking (0.5h)
- [ ] Log interruptions in context.md:
  ```markdown
  ## Interruptions

  - 2026-01-18 10:30 (2.5h): Production payment bug
  - 2026-01-17 14:00 (1h): Urgent client meeting
  - 2026-01-16 11:00 (3h): Database migration issue
  ```
- [ ] Calculate interruption metrics:
  - Frequency (interruptions/day)
  - Average duration
  - Most common reasons
  - Impact on velocity

## Definition of Done

### Functionality
- [ ] `aipim pause` captures full state
- [ ] `aipim resume` detects and restores
- [ ] Git stash integration works
- [ ] Interruption tracking accurate
- [ ] Works with uncommitted changes

### Testing
- [ ] Pause mid-work, make uncommitted changes
- [ ] Resume after several hours
- [ ] Verify file restoration
- [ ] Test stash pop
- [ ] Test without uncommitted changes

### Code Quality
- [ ] Snapshot format documented
- [ ] Error handling for corrupted snapshot
- [ ] Clear user messages

### Documentation
- [ ] Time logged
- [ ] Workflow examples
- [ ] Integration guide

### Git
- [ ] Atomic commits
- [ ] Convention: feat(cli): add interruption recovery
- [ ] No conflicts

## Testing

### Manual
- [ ] Start working on task
- [ ] Make changes (don't commit)
- [ ] Run `aipim pause --reason="Test"`
- [ ] Wait 1 hour
- [ ] Run `aipim resume`
- [ ] Verify restoration accuracy

## Technical Notes

**Snapshot Schema:**

```typescript
interface InterruptionSnapshot {
    timestamp: string
    reason: string
    task: {
        file: string
        title: string
        phase: string
        current_checkbox: string
    }
    editor_state: {
        current_file: string
        last_line: number
        unsaved_changes: boolean
        stash_ref?: string
    }
    approach_notes?: string
}
```

**Pause Command:**

```bash
aipim pause --reason="Production bug"

# Captures:
# 1. Current task from current-task.md
# 2. Git status (modified files)
# 3. Last edited line (git diff)
# 4. Current phase (parse task file)
# 5. Offer to stash

Output:
📎 Session paused: Production bug
🔄 Stashing uncommitted changes...
✅ Snapshot saved

When ready to resume: aipim resume
```

**Resume Detection:**

```typescript
async function resume(): Promise<void> {
    const snapshot = loadInterruptionSnapshot()

    if (snapshot) {
        // Interrupted session
        showInterruptionBanner(snapshot)

        const answer = await confirm({
            message: 'Restore interrupted session?',
            default: true
        })

        if (answer) {
            await restoreSnapshot(snapshot)
            // Then run normal resume
        }
    } else {
        // Normal resume (from TASK-010)
        await showLastSessionSummary()
    }
}
```

**Interruption Metrics:**

```bash
$ aipim metrics --interruptions

📊 Interruption Analysis (Last 30 Days)

Frequency: 12 interruptions (0.6/day)
Total time lost: 18 hours
Average duration: 1.5 hours

Most common reasons:
1. Production bugs (5x, 8h total)
2. Urgent meetings (4x, 6h total)
3. Client requests (3x, 4h total)

💡 Recommendation:
   Consider "focus blocks" (2-4h uninterrupted)
   Most productive: mornings (2 interruptions vs 10 afternoons)
```

**Benefits:**

1. **Zero Context Loss:**
   - Return exactly where you left off
   - No "what was I doing?" delay

2. **Interruption Awareness:**
   - Metrics show real cost of interruptions
   - Data for negotiating focus time

3. **Better Planning:**
   - If interruption-heavy day, plan smaller tasks
   - Schedule deep work during low-interruption times

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Git stash might conflict
   - Mitigation: Check for conflicts, warn user
2. Risk: Snapshot might be stale (>1 week old)
   - Mitigation: Warn if snapshot >24h, ask to discard

## References

- Flow state research: 10-15min to restore after interruption
- GTD: Context switching costs
- Related: TASK-010 (resume), TASK-011 (progress)

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
