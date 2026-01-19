---
number: 006
title: "Separate CLI Output from System Logging"
date: 2026-01-19
status: accepted
authors: [Rafhael Marsigli, Claude Sonnet 4.5]
review_date: 2026-07-19
tags: [architecture, code-quality, testing]
---

# ADR-006: Separate CLI Output from System Logging

## Status

**Accepted**

Date: 2026-01-19

## Context

**Problem:**
Commands (`resume`, `start`, `template`) were using `console.log` directly with a fallback pattern (`options.logger?.log || console.log`), triggering ESLint warnings. This pattern also blurred the distinction between user-facing CLI output and system operational logging.

**Current Situation:**
- ESLint rule `no-console` prohibits `console.log` (only allows `warn`/`error`)
- Commands had logger injection for testing: `{ logger: { log: mockFn } }`
- This "logger" wasn't actually logging - it was displaying CLI content
- Semantic confusion: `logger.*` is for system messages, but commands needed output display
- Three files affected: `src/commands/resume.ts`, `start.ts`, `template.ts`

**Forces:**
- Technical: Need clean, testable output mechanism without ESLint violations
- Code Quality: Must maintain clear separation of concerns
- Testing: Need mockable output that doesn't interfere with system logging
- Maintainability: Future extensibility (colors, silent mode, file output)

## Decision

**We will:** Create a dedicated `output.ts` utility that separates CLI content display from system logging.

**Rationale:**
1. **Technical fit**: Clear semantic distinction between output (user content) and logging (system messages)
2. **Operational**: Easy to mock in tests without affecting logger behavior
3. **Strategic**: Enables future enhancements (colorization, silent mode, file output) without touching logger

**Implementation:**
```typescript
// src/utils/output.ts
class Output {
    public print(message: string): void {
        console.log(message)  // ESLint-disabled here only
    }
}
export const output = new Output()

// Usage in commands
import { output } from '@/utils/output.js'
const log = output.print.bind(output)
log('User-facing content')
```

## Alternatives Considered

### Option A: Keep logger injection, change fallback to empty function

**Pros:**
- Minimal code change
- Maintains test injection pattern

**Cons:**
- Semantic confusion: "logger" that doesn't log
- Fallback `() => {}` silences output by default (bad UX)
- Doesn't solve ESLint issue properly

**Rejected because:** Architectural smell - using "logger" for non-logging purposes.

### Option C: Adjust ESLint rule to allow console.log in specific files

**Pros:**
- Pragmatic - acknowledges console.log is correct for CLI tools
- No new abstractions needed

**Cons:**
- Loses testability (can't mock console.log easily)
- Inconsistent - some files allow console.log, others don't
- Doesn't improve architecture

**Rejected because:** Loses important test coverage and doesn't improve code quality.

### Option D: Use inline eslint-disable comments with logger fallback

**Pros:**
- Keeps existing test injection pattern
- Minimal new code

**Cons:**
- Still maintains semantic confusion (logger vs output)
- Doesn't improve architecture
- ESLint-disable proliferates across codebase

**Rejected because:** Band-aid solution that doesn't address root cause.

## Consequences

### Positive
- [x] Clean semantic separation: `output.print()` vs `logger.*` (verified)
- [x] ESLint warnings eliminated (0 warnings) (verified)
- [x] Better testability: Mock `output.print` directly (verified)
- [x] Extensibility foundation: Easy to add `printColored()`, `silent`, etc. (planned)
- [x] Removed 45 lines of test boilerplate (`logger: { log: mockLog }`) (verified)

### Negative
- [x] One additional file to maintain (`src/utils/output.ts`)
  - Mitigation: Minimal - only 27 lines, well-documented
- [x] Breaking change for command interfaces (removed `logger` option)
  - Mitigation: Internal API only, no external consumers yet

### Neutral
- Commands now import both `logger` and `output` when needed
- Test files import `outputModule` for mocking

## Implementation

**Plan:**
1. [x] Create `src/utils/output.ts` with Output class
2. [x] Update commands to use `output.print.bind(output)`
3. [x] Remove `logger?: { log }` from command interfaces
4. [x] Update tests to mock `outputModule.output.print`
5. [x] Verify all tests pass (121/121)
6. [x] Verify lint passes (0 warnings)

**Technical:**
```typescript
// Before (resume.ts)
export interface ResumeOptions {
    logger?: { log: (msg: string) => void }
}
const log = options.logger?.log || console.log  // ⚠️ ESLint warning

// After (resume.ts)
import { output } from '@/utils/output.js'
export interface ResumeOptions {
    auto?: boolean
    verbose?: boolean
}
const log = output.print.bind(output)  // ✅ Clean
```

**Testing:**
```typescript
// Before
const mockLog = jest.fn()
await resume({ logger: { log: mockLog } })
const output = mockLog.mock.calls.flat().join('\n')

// After
jest.unstable_mockModule('../../src/utils/output.js', () => ({
    output: { print: jest.fn() }
}))
const outputModule = await import('../../src/utils/output.js')
await resume({})
const output = (outputModule.output.print as jest.Mock).mock.calls.flat().join('\n')
```

## Validation

**Success Criteria:**
- [x] ESLint passes with 0 warnings ✅
- [x] All tests pass (121/121) ✅
- [x] Commands work correctly in manual testing ✅
- [x] Test code more readable ✅

**Monitoring:**
- Code review: Ensure new commands use `output.print()` consistently
- Lint CI: Catches any new console.log violations
- Test coverage: Maintain >80% coverage

**Review Date:** 2026-07-19

Review if:
- Adding new output methods (colors, formatting)
- Considering logging frameworks (Winston, Pino)
- User feedback indicates output issues

## Lessons Learned

**Went Well:**
- Clear semantic separation immediately improved code readability
- Test updates were straightforward despite touching 3 test files
- ESLint warnings eliminated as expected
- No regressions - all tests passed first try after fixes

**Improve:**
- Could document this pattern in CONTRIBUTING.md for future developers
- Consider adding output type safety (OutputLevel enum) if we add more methods

**Surprises:**
- `.bind(output)` was necessary to preserve `this` context in class method
- Removing logger injection reduced test boilerplate significantly (cleaner than expected)

## Related

**Depends on:**
- Existing logger.ts implementation (unchanged)

**Impacts:**
- Future commands must use `output.print()` for CLI content
- Testing patterns: New commands should follow output mocking pattern
- May inform future decision about logging frameworks (ADR-007?)

## References

- Commit: `2e7fb6e` - refactor(commands): separate CLI output from system logging
- ESLint Rule: https://eslint.org/docs/rules/no-console
- Separation of Concerns: https://en.wikipedia.org/wiki/Separation_of_concerns

## Approval

**Decided by:** Rafhael Marsigli
**Date:** 2026-01-19
**Status:** ✅ Approved

---

**Version:** 1.0
**Last Updated:** 2026-01-19
