---
title: "Extract Parsing Utilities to Dedicated Module"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T16:30:00-03:00
priority: P2-M
estimated_hours: 3
actual_hours: 1.5
status: completed
blockers: []
tags: [refactor, architecture, code-quality]
related_files: [src/commands/resume.ts, src/utils/context.ts, tests/utils/context.test.ts]
---

# Task: Extract Parsing Utilities to Dedicated Module (T020)

## Objective

Extract parsing logic (`parseContext()`, `parseTask()`, `extractCheckpoints()`) from command files into a dedicated `src/utils/parser.ts` module.

**Success:**
- [ ] New `src/utils/parser.ts` module created
- [ ] All parsing functions centralized in one place
- [ ] Commands import from parser module (DRY principle)
- [ ] All existing tests pass
- [ ] Improved testability and maintainability

## Context

**Why:** Quality report identified duplicate parsing logic in `resume.ts` and `start.ts`. Violates DRY principle.

**Current problem:**
- Parsing logic scattered across command files
- Hard to test parsing independently
- Changes require updating multiple files
- Code duplication

**Impact:** Improved maintainability, easier testing, cleaner architecture

**Related:** Code Quality Analysis Report 2026-01-19, Architecture & Design section (Score: 82/100)

## Implementation

### Phase 1: Create Parser Module (Est: 1h)
- [ ] Create `src/utils/parser.ts`
- [ ] Define TypeScript interfaces for parsed data:
  ```typescript
  interface ParsedContext {
    session: number;
    last_updated: string;
    active_branches: string[];
    blockers: string[];
    next_action: string;
    // ... other fields
  }

  interface ParsedTask {
    title: string;
    priority: string;
    estimated_hours: number;
    actual_hours: number;
    status: string;
    checkboxes: Checkpoint[];
    // ... other fields
  }

  interface Checkpoint {
    checked: boolean;
    text: string;
    line: number;
  }
  ```
- [ ] Implement `parseContext(content: string): ParsedContext`
- [ ] Implement `parseTask(content: string): ParsedTask`
- [ ] Implement `extractCheckpoints(content: string): Checkpoint[]`
- [ ] Add proper error handling (invalid YAML, missing fields)
- [ ] Export all parsing functions

### Phase 2: Refactor Commands (Est: 1.5h)
- [ ] Update `src/commands/start.ts`:
  - [ ] Import parsing functions from `parser.ts`
  - [ ] Remove duplicate parsing logic
  - [ ] Use imported functions
- [ ] Update `src/commands/resume.ts`:
  - [ ] Import parsing functions from `parser.ts`
  - [ ] Remove duplicate parsing logic
  - [ ] Use imported functions
- [ ] Check other commands for parsing logic (template, task, etc)
- [ ] Ensure all commands work correctly

### Phase 3: Testing (Est: 0.5h)
- [ ] Create `tests/utils/parser.test.ts`
- [ ] Unit tests for `parseContext()`:
  - [ ] Valid context.md
  - [ ] Missing fields
  - [ ] Invalid YAML
  - [ ] Empty file
- [ ] Unit tests for `parseTask()`:
  - [ ] Valid task
  - [ ] Missing frontmatter
  - [ ] Invalid priority
- [ ] Unit tests for `extractCheckpoints()`:
  - [ ] Mixed checked/unchecked
  - [ ] Nested checkboxes
  - [ ] No checkboxes
- [ ] Run all existing tests (should still pass)

## Definition of Done

### Functionality
- [ ] All parsing functions work correctly
- [ ] Edge cases handled:
  - [ ] Invalid YAML frontmatter
  - [ ] Missing required fields
  - [ ] Malformed markdown
  - [ ] Empty files
- [ ] Error messages user-friendly
- [ ] Type-safe (no `any` types)

### Testing
- [ ] Unit tests for all parser functions
- [ ] Integration tests for commands still pass
- [ ] Coverage >80% for parser.ts
- [ ] Manual test: `aipim start` and `aipim resume` work

### Performance
- [ ] No performance regression (<500ms for parsing)
- [ ] Efficient regex/parsing (no excessive backtracking)

### Security
- [ ] Safe YAML parsing (no code execution)
- [ ] Input sanitization for file content
- [ ] No path traversal in file reads

### Code Quality
- [ ] TypeScript strict mode compliant
- [ ] JSDoc comments on public functions
- [ ] Proper error types (not generic Error)
- [ ] Clean, descriptive variable names
- [ ] Linting passes

### Documentation
- [ ] Time logged
- [ ] JSDoc on all exported functions
- [ ] ADR if architectural decision made
- [ ] README unchanged (internal refactor)

### Git
- [ ] Atomic commits:
  1. Create parser.ts with functions
  2. Refactor start.ts to use parser
  3. Refactor resume.ts to use parser
  4. Add parser tests
- [ ] Convention: `refactor(utils): extract parsing logic to dedicated module`
- [ ] No conflicts

## Testing

### Unit Tests
```typescript
// tests/utils/parser.test.ts
import { parseContext, parseTask, extractCheckpoints } from '@/utils/parser';

describe('parseContext', () => {
  test('parses valid context.md', () => {
    const content = `---
session: 5
last_updated: 2026-01-19T00:00:00-03:00
active_branches: [main]
blockers: []
next_action: "Continue work"
---
# Current State
...`;
    const result = parseContext(content);
    expect(result.session).toBe(5);
    expect(result.next_action).toBe('Continue work');
  });

  test('handles invalid YAML', () => {
    const content = '--- invalid yaml ---';
    expect(() => parseContext(content)).toThrow();
  });
});

describe('extractCheckpoints', () => {
  test('finds all checkboxes', () => {
    const content = `
- [x] Done
- [ ] Not done
  - [x] Nested done
`;
    const checkpoints = extractCheckpoints(content);
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[0].checked).toBe(true);
    expect(checkpoints[1].checked).toBe(false);
  });
});
```

### Manual
```bash
# Build and test commands
pnpm build

# Test start command
aipim start
# Should work exactly as before

# Test resume command
aipim resume
# Should work exactly as before

# Verify parsing is consistent
# Check that output matches previous behavior
```

## Blockers & Risks

**Current:**
- [ ] None (can start immediately)

**Potential:**
1. Risk: Breaking changes to command behavior - Mitigation: Comprehensive tests before refactor
2. Risk: Parsing logic might differ slightly - Mitigation: Unit tests to verify consistency
3. Risk: Performance regression - Mitigation: Benchmark before/after

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| | 0 | Not started |

**Total:** 0h / 3h

## Technical Notes

**Current parsing locations:**
```bash
# Find all parsing logic
grep -n "parseContext\|parseTask\|extractCheckpoints" src/commands/*.ts
```

**Expected changes:**
```typescript
// Before (in resume.ts)
function parseContext(content: string) {
  // parsing logic...
}

// After (import from parser.ts)
import { parseContext } from '@/utils/parser';
```

**Module structure:**
```
src/utils/
├── parser.ts         # NEW
├── files.ts          # existing
├── logger.ts         # existing
└── validators.ts     # existing (if exists)
```

**Benefits:**
- Single source of truth for parsing
- Easier to add new parsing functions
- Better testability (isolated unit tests)
- Reusable across commands
- Type safety improvements

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Architecture & Design section (recommendation #1)
- DRY principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 3h, Actual: ___h, Diff: ___%

**Lessons:**
1.

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed

**Completed:** ___________
**Final time:** _____ hours


## Completion Summary

**Status:** ✅ COMPLETED  
**Actual Time:** 1.5h (estimated: 3h, 50% under estimate!)  
**Completed:** 2026-01-19T16:30:00-03:00

### What Was Accomplished

**Phase 1: Centralized Parsing Module** ✅
- Added 3 new functions to utils/context.ts (calculateProgress, extractCheckpoints, extractObjective)
- Functions already existed for parseContext and parseTask
- Total: 5 core parsing functions now centralized

**Phase 2: Refactored Commands** ✅
- Updated resume.ts to import from utils/context.ts
- Removed 144 lines of duplicate parsing code
- start.ts was already using centralized functions (no changes needed)

**Phase 3: Comprehensive Testing** ✅
- Created tests/utils/context.test.ts with 25 tests
- 100% test pass rate (25/25 passing)
- All edge cases covered (empty files, invalid data, missing fields)
- Overall test suite: 88 tests passing, 84.63% coverage

**Phase 4: Verification** ✅
- Build successful (`pnpm build`)
- All 88 tests pass (`pnpm test`)
- Manual verification: both `start` and `resume` commands work perfectly
- No regressions detected

### Key Metrics

- **Code Reduction:** 144 lines of duplicate code removed
- **Test Coverage:** 25 new tests added, all passing
- **Build Time:** No performance degradation
- **Commands Verified:** start ✅, resume ✅

### Files Changed

- `src/utils/context.ts`: +95 lines (new functions)
- `src/commands/resume.ts`: -144 lines (removed duplicates, +1 import)
- `tests/utils/context.test.ts`: +445 lines (new test file)

### Retrospective

**Went Well:**
- Discovered that start.ts was already using centralized functions
- Found and fixed a bug in calculateProgress (case sensitivity)
- Tests caught edge cases we hadn't considered
- All commands work perfectly after refactoring

**Challenges:**
- Had to reconcile slight differences between resume.ts and context.ts versions
- Test failures revealed regex bugs that needed fixing
- Coverage threshold warning (expected - testing only parser functions)

**Lessons Learned:**
1. Always check existing code before assuming duplication
2. Comprehensive tests catch subtle bugs early
3. Refactoring is easier when you have good tests
4. DRY principle significantly reduces maintenance burden

**Estimate Accuracy:** 1.5h actual vs 3h estimated = 50% faster (excellent!)

---

**Task unblocks:** T022 (Add command tests) - parsing utilities now centralized and tested

