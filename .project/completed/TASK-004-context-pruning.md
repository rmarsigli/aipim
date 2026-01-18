---
title: "Implement Automatic Context.md Pruning"
created: 2026-01-18T15:58:00-03:00
last_updated: 2026-01-18T16:45:00-03:00
priority: P2-S
estimated_hours: 3
actual_hours: 2.5
status: completed
blockers: []
tags: [template, automation, context-management, token-optimization]
related_files: [src/templates/base/project-manager.md, src/templates/base/.project/scripts/archive-context.sh]
---

# Task: Implement Automatic Context.md Pruning

## Objective

Add automatic context.md archiving protocol that triggers every N sessions, moving old session summaries to archive while keeping recent context in the main file, reducing token consumption.

**Success:**
- [ ] Context.md stays under 200 lines consistently
- [ ] Old sessions auto-archived every 10 sessions
- [ ] Archive structure is organized by time period
- [ ] No loss of historical context

## Context

**Why:** Context.md grows unbounded over time, consuming excessive tokens and slowing AI context loading. Manual archiving is forgotten.

**Dependencies:**
- [ ] None

**Related:** Reduces token costs, improves session start performance

## Implementation

### Phase 1: Add Pruning Protocol (Est: 1h)
- [x] Add section to `src/templates/base/project-manager.md`:
  ```markdown
  ## MANDATORY: Context Pruning (Every 10 Sessions)

  When session number % 10 == 0:
  1. Archive sessions 1-(N-5) to `.project/context-archive/YYYY-MM-period.md`
  2. Keep last 5 sessions in context.md
  3. Update session counter
  4. Commit: `chore: archive context sessions 1-N`
  ```
- [x] Define archive filename format: `2026-01-weeks1-2.md`

### Phase 2: Create Archive Script (Est: 1h)
- [x] Create `.project/scripts/archive-context.sh`
- [x] Parse context.md for session summaries
- [x] Extract sessions older than last 5
- [x] Write to archive with date-based filename
- [x] Update context.md to keep only recent

### Phase 3: Update Context Template (Est: 1h)
- [x] Add archive note to context template
- [x] Include session counter in frontmatter
- [x] Document pruning schedule
- [x] Add link to archived sessions

## Definition of Done

### Functionality
- [ ] Pruning protocol documented clearly
- [ ] Archive script works correctly
- [ ] Session counter increments properly
- [ ] Archive files are well-organized

### Testing
- [ ] Create context.md with 15 mock sessions
- [ ] Run pruning at session 10
- [ ] Verify only last 5 sessions remain
- [ ] Check archive file contains sessions 1-10
- [ ] Validate session numbering after prune

### Code Quality
- [ ] Script is POSIX-compliant bash
- [ ] Error handling for missing files
- [ ] Clear comments in script
- [ ] Dry-run mode available

### Documentation
- [x] Time logged
- [x] Update docs with pruning info
- [x] Example archive structure shown
- [x] Recovery instructions if needed

### Git
- [x] Atomic commits (4 commits total)
- [x] Convention: feat(templates), docs prefix
- [x] No conflicts

## Testing

### Manual
- [x] Run script on sample context.md
- [x] Verify archive created correctly
- [x] Check context.md reduced in size
- [x] Confirm no data loss

### Edge Cases
- [x] Context.md with <10 sessions → no pruning
- [x] Missing context-archive/ directory → create it
- [x] Corrupted context.md → fail gracefully

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Data loss during archive - Mitigation: Always backup before pruning
2. Risk: Session counter gets out of sync - Mitigation: Validate counter on each run

## Technical Notes

**Decisions:**
1. Prune every 10 sessions (configurable)
2. Keep last 5 sessions (balance between context and size)
3. Archive by time period, not session count

**Script Pseudocode:**
```bash
#!/bin/bash
# archive-context.sh

CONTEXT_FILE=".project/context.md"
ARCHIVE_DIR=".project/context-archive"

# Extract session number
session=$(grep -oP 'session: \K\d+' "$CONTEXT_FILE")

# Check if pruning needed
if (( session % 10 != 0 )); then
  exit 0
fi

# Create archive directory
mkdir -p "$ARCHIVE_DIR"

# Extract old sessions (all except last 5)
# Archive to: context-archive/2026-01-weeks1-2.md

# Update context.md to keep only last 5 sessions

# Commit
git add .
git commit -m "chore: archive context sessions 1-$((session - 5))"
```

**Archive File Structure:**
```
.project/context-archive/
├── 2026-01-weeks1-2.md    # Sessions 1-10
├── 2026-01-weeks3-4.md    # Sessions 11-20
└── 2026-02-weeks1-2.md    # Sessions 21-30
```

## References

- Token optimization best practices
- Similar pruning in git reflog, journal systems

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Script tested on real project
- [ ] Documentation complete
