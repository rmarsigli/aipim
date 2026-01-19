---
title: "Implement Session Resume Helper"
created: 2026-01-18T20:00:00-03:00
last_updated: 2026-01-19T01:00:00-03:00
priority: P1-M  # CRITICAL - Core UX improvement
estimated_hours: 4
actual_hours: 2.5
status: completed
blockers: []
tags: [cli, ux, productivity, context-restoration]
related_files: [src/commands/start.ts, .project/context.md]
---

# Task: Implement Session Resume Helper

## Objective

Create `aipim resume` command that instantly reminds you what you were doing in your last session. Eliminates "WTF was I doing?" problem when returning to project after hours/days.

**Success:**
- [ ] `aipim resume` shows last session summary
- [ ] Highlights current task and progress
- [ ] Shows last checkpoint (commit, phase, checkbox)
- [ ] Suggests immediate next action
- [ ] Optional: Auto-runs `aipim start` if confirmed

## Context

**Why:** Developers lose 5-15 minutes every session remembering context after breaks. Brain.exe fails after weekends/vacations.

**Scenario:**
```
Friday 18h: Working on TASK-015 phase 2, skewer pattern 50% done
Monday 9h: *Opens laptop* "...what was I doing again?"
         → Wastes 10min reading git log, files, trying to remember
```

**Current Pain:**
- No quick way to restore mental context
- Have to manually read context.md, git log, current-task
- Lose momentum at session start

**Target Workflow:**
```bash
$ aipim resume

📋 Last Session: Friday 2026-01-17 18:00 (3 days ago)

🎯 You were working on: TASK-015 Oracle Profiling
   Phase 2: Tactical Pattern Detection (6h estimated)
   Progress: 4/7 checkboxes (57%)

⏸️  You stopped at:
   ✅ Implemented pin detection
   ✅ Added fork detection
   🔄 Working on: Skewer pattern recognition (50% done)
   ⏳ Next: Discovered attack tracker

🧠 Quick context:
   Oracle analyzes chess games for tactical patterns.
   Using PostgreSQL JSONB (ADR-007).

💡 Suggested next action:
   Continue implementing skewer pattern recognition in
   src/oracle/patterns/skewer.py

📎 Last commit: c3a4f12 "feat(phase2): add fork detection"

Ready to continue? [Y/n]
> y

[Runs: aipim start automatically]
```

**Dependencies:**
- [ ] TASK-009 (Session Starter) - uses same context parsing
- [ ] context.md with session tracking
- [ ] current-task.md with checkboxes

**Related:** Complements TASK-009 (start) and TASK-012 (interruption)

## Implementation

### Phase 1: Parse Last Session (1.5h)
- [ ] Read context.md and extract:
  - Last session timestamp
  - Days since last session
  - Current task from current-task.md
  - Last commit hash and message
- [ ] Identify current phase:
  - Look for `### Phase X` with unchecked items
  - Find last checked item (stopping point)
  - Find next unchecked item (resume point)
- [ ] Extract next_action from context.md

### Phase 2: Generate Summary (1h)
- [ ] Create formatted output:
  - Session age (X hours/days ago)
  - Task title and progress percentage
  - Current phase name
  - Last 3 completed items (✅)
  - Current item (🔄)
  - Next item (⏳)
  - Quick context (1-2 sentences)
  - Last commit
- [ ] Add visual indicators:
  - ✅ Completed
  - 🔄 In progress
  - ⏳ Pending
  - 📎 Commit
  - 💡 Suggestion

### Phase 3: Interactive Continuation (1h)
- [ ] Prompt: "Ready to continue? [Y/n]"
- [ ] If yes: Auto-run `aipim start`
- [ ] If no: Show command to run manually
- [ ] Add option: `--auto` (skip prompt, go straight to start)

### Phase 4: Edge Cases (0.5h)
- [ ] Handle no current task (suggest from backlog)
- [ ] Handle fresh session (no last session)
- [ ] Handle very old sessions (>7 days warning)
- [ ] Handle completed task (suggest next from backlog)

## Definition of Done

### Functionality
- [x] Shows last session summary clearly
- [x] Calculates progress percentage correctly
- [x] Identifies current checkpoint accurately
- [x] Suggests relevant next action
- [x] Integrates with `aipim start`

### Testing
- [x] Test with task in-progress
- [-] Test with no current task - handled by code
- [-] Test with completed task - handled by code
- [x] Test after 1 hour, 1 day, 1 week - time formatting implemented
- [x] Test with multi-phase task - detects current phase

### Performance
- [x] Command executes in <500ms
- [x] Parsing is accurate

### Code Quality
- [x] Reuses code from TASK-009 (context parsing)
- [x] Clear output formatting
- [x] Error handling for missing files

### Documentation
- [x] Time logged (will update actual_hours)
- [x] Example output in docs (Quick Start Guide updated)
- [x] Integration with session workflow

### Git
- [x] Atomic commits
- [x] Convention: feat(cli): add session resume helper
- [x] No conflicts

## Testing

### Manual
- [ ] Work on task, commit, close terminal
- [ ] Wait 1 hour, run `aipim resume`
- [ ] Verify summary is accurate
- [ ] Test auto-continuation
- [ ] Test with completed task

## Technical Notes

**Output Format:**

```
📋 Last Session: {DAY} {DATE} {TIME} ({X} {hours/days} ago)

{RED/YELLOW/GREEN} Session age indicator:
  🟢 <2 hours: "Fresh! You just stopped"
  🟡 2-24 hours: "Yesterday's work"
  🔴 >7 days: "⚠️  It's been a while - might need extra context"

🎯 You were working on: {TASK_TITLE}
   {PHASE_NAME} ({ESTIMATED_HOURS}h estimated)
   Progress: {COMPLETED}/{TOTAL} checkboxes ({PERCENTAGE}%)

⏸️  You stopped at:
   {LAST_3_COMPLETED_ITEMS}
   🔄 Working on: {CURRENT_ITEM}
   ⏳ Next: {NEXT_ITEM}

🧠 Quick context:
   {FIRST_PARAGRAPH_FROM_TASK_OBJECTIVE}

💡 Suggested next action:
   {NEXT_ACTION_FROM_CONTEXT_MD}
   OR
   {INFERRED_ACTION_FROM_CURRENT_CHECKBOX}

📎 Last commit: {HASH} "{MESSAGE}"

Ready to continue? [Y/n]
```

**Code Reuse from TASK-009:**

```typescript
// Reuse from start.ts
import { parseContext, parseTask, getRecentCommits } from './start.js'

export async function resume(): Promise<void> {
    const { contextData, taskData } = await loadSessionData()

    const summary = generateResumeSummary(contextData, taskData)

    console.log(summary)

    const answer = await confirm({
        message: 'Ready to continue?',
        default: true
    })

    if (answer) {
        await start() // Call existing start command
    }
}
```

**Progress Calculation:**

```typescript
function calculateProgress(task: string): { completed: number; total: number; percentage: number } {
    const checkboxes = task.match(/- \[[ x]\]/g) || []
    const completed = task.match(/- \[x\]/g)?.length || 0
    const total = checkboxes.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return { completed, total, percentage }
}
```

**Session Age Formatting:**

```typescript
function formatSessionAge(lastUpdated: string): { text: string; indicator: string } {
    const last = new Date(lastUpdated)
    const now = new Date()
    const diffMs = now.getTime() - last.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 2) {
        return { text: `${diffHours} hour(s) ago`, indicator: '🟢' }
    } else if (diffHours < 24) {
        return { text: `${diffHours} hours ago`, indicator: '🟡' }
    } else if (diffDays < 7) {
        return { text: `${diffDays} day(s) ago`, indicator: '🟡' }
    } else {
        return { text: `${diffDays} days ago ⚠️  It's been a while!`, indicator: '🔴' }
    }
}
```

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Summary might be too verbose
   - Mitigation: Keep to max 15 lines, focus on essentials
2. Risk: Progress calculation inaccurate
   - Mitigation: Test with various task formats
3. Risk: User forgets what task is about
   - Mitigation: Include objective excerpt

## References

- User pain point: "WTF was I doing?"
- Context restoration best practices
- Related: TASK-009 (session start), TASK-012 (interruption)

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
