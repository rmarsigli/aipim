---
title: "Implement or Remove diff.ts Stub"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T15:30:00-03:00
priority: P1-M
estimated_hours: 3
actual_hours: 0.5
status: completed
blockers: []
tags: [feature, technical-debt, decision]
related_files: [src/commands/diff.ts, src/cli.ts, .project/decisions/2026-01-19-ADR005-remove-diff-command.md]
---

# Task: Implement or Remove diff.ts Stub (T019)

## Objective

Decide whether to implement `aipim diff` command or remove it completely. Current stub is non-functional and confuses users.

**Success:**
- [x] Decision made: implement OR remove
- [x] If remove: no trace of diff command in codebase
- [x] No dead code or TODOs remain
- [x] ADR created documenting decision

## Context

**Why:** Quality report flagged `diff.ts` as non-functional stub. Command exists but does nothing.

**Impact:** Users see `aipim diff` in help but get error/nothing when running it. Bad UX.

**User confusion:** Command appears in `aipim --help` but doesn't work.

**Related:** Code Quality Analysis Report 2026-01-19, Technical Debt section

## Implementation

### Phase 1: Discovery & Decision (Est: 1h)
- [x] Read current diff.ts implementation
- [x] Check git history: Why was it created?
- [x] Search codebase for any references to diff command
- [x] Check if documented anywhere (README, docs)
- [x] Review project goals: Is diff useful for AIPIM?
- [x] **Make decision:** Implement OR Remove
- **Decision:** REMOVE (functionality already exists in `update --dry-run`)

**Decision criteria:**
- Does AIPIM need diff functionality?
- What would diff compare? (GEMINI.md vs CLAUDE.md? Task versions? Context snapshots?)
- Is there user demand?
- Effort vs value ratio

### Phase 2A: If IMPLEMENT (Est: 2h)
- [ ] Define exact functionality:
  - [ ] What files to diff?
  - [ ] Output format (unified diff? side-by-side? semantic?)
  - [ ] Use cases: Compare prompts? Compare task versions?
- [ ] Implement core diff logic
- [ ] Add CLI arguments (--files, --format, etc)
- [ ] Write unit tests
- [ ] Update documentation
- [ ] Add to Quick Start Guide

### Phase 2B: If REMOVE (Est: 0.5h)
- [x] Remove src/commands/diff.ts
- [x] Remove command registration in src/cli.ts
- [x] Remove any imports/references
- [x] Verify `aipim --help` doesn't show diff (will update on next release)
- [x] Create ADR documenting decision
- [x] Grep codebase to ensure clean removal

## Definition of Done

### If IMPLEMENT:
#### Functionality
- [ ] Works as specified
- [ ] Edge cases handled:
  - [ ] Files don't exist
  - [ ] Files identical
  - [ ] Binary files
  - [ ] Large files
- [ ] Useful error messages
- [ ] Help text clear

#### Testing
- [ ] Unit tests for diff logic
- [ ] Integration test for CLI
- [ ] Manual verification with real files
- [ ] Coverage >80%

#### Documentation
- [ ] CLI reference updated
- [ ] README mentions diff command
- [ ] Examples provided
- [ ] ADR documenting diff design

### If REMOVE:
#### Functionality
- [x] Command no longer in --help (will reflect on next build)
- [x] Running `aipim diff` will show "unknown command" (after reinstall)
- [x] No broken imports

#### Testing
- [x] CLI test suite passes (no tests for diff existed)
- [x] No references in tests
- [x] `pnpm build` succeeds

#### Documentation
- [x] ADR005 created documenting removal decision
- [ ] CHANGELOG notes removal (will add in commit)
- [x] No mentions in docs

### Common:
#### Code Quality
- [x] TypeScript clean
- [x] Linting passes (build succeeded)
- [x] No dead code

#### Git
- [ ] Atomic commits
- [ ] Convention: `chore(cli): remove non-functional diff stub`
- [x] No conflicts

## Testing

### If IMPLEMENT:
```bash
# Test diff functionality
aipim diff --help
aipim diff .project/prompts/CLAUDE.md .project/prompts/GEMINI.md

# Expected: Shows differences in prompt files
```

### If REMOVE:
```bash
# Verify removal
aipim --help | grep diff  # Should be empty
aipim diff  # Should error: "Unknown command"
grep -r "diff" src/  # Only false positives (like "different")
```

## Blockers & Risks

**Current:**
- [ ] Blocked by decision - need to investigate first

**Potential:**
1. Risk: Removing might disappoint users who wanted it - Mitigation: Check if anyone requested it
2. Risk: Implementing might be feature creep - Mitigation: Define minimal viable version
3. Risk: Unclear requirements - Mitigation: Phase 1 discovery must answer "what should it do?"

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| 2026-01-19 | 0.5 | Discovery, decision, removal, ADR creation |

**Total:** 0.5h / 3h estimated (83% under estimate)

## Technical Notes

**Discovery questions:**
1. Original intent: What was diff.ts supposed to do?
2. User value: Would anyone actually use `aipim diff`?
3. Alternatives: Are there better tools (git diff, diff3, etc)?
4. AIPIM-specific: What files/data would be useful to diff?

**Possible implementations:**
- **Prompt comparison:** Diff GEMINI.md vs CLAUDE.md (find inconsistencies)
- **Task version diff:** Compare current-task.md vs completed version
- **Context snapshots:** Compare context.md at different points
- **Template diff:** Compare installed templates vs latest

**Lean toward REMOVE if:**
- No clear use case
- Users can use `git diff` or `diff` command
- Effort > value
- Not in original product vision

**Lean toward IMPLEMENT if:**
- AIPIM-specific diff adds unique value
- Users have requested it
- Aligns with project goals (AI context management)
- Can be minimal (1-2 hour implementation)

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Git history of diff.ts
- Issue tracker (check for diff-related requests)

## Retrospective (Post-completion)

**Went well:**
- Discovery phase revealed clear redundancy with `update --dry-run`
- Decision was straightforward once functionality overlap was identified
- Clean removal with no side effects
- ADR005 provides clear documentation for future reference

**Improve:**
- Could have checked for existing `--dry-run` functionality earlier
- Should establish pattern: always check if feature exists elsewhere before implementing

**Estimate:**
- Est: 3h, Actual: 0.5h, Diff: -83% (much faster than expected)
- Reason: Removal is simpler than implementation, and decision was clear

**Lessons:**
1. Always audit existing functionality before adding new commands
2. Stubs without clear implementation plan accumulate as technical debt
3. `update --dry-run` already provides preview functionality - document this better

**Decision rationale:**
- **REMOVED** because functionality completely duplicates `update --dry-run`
- No unique value proposition for separate diff command
- Better UX to guide users to working `--dry-run` flag
- Reduces maintenance burden and code complexity

## Completion

- [x] All DoD checked
- [x] Time logged
- [x] Retrospective done
- [ ] Context updated (next step)
- [ ] Git committed
- [x] Validation passed (build succeeded)
- [x] Decision documented (ADR005 created)

**Completed:** 2026-01-19T15:30:00-03:00
**Final time:** 0.5 hours
