---
title: "Replace execSync with Async spawn for Git Operations"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T02:00:00-03:00
priority: P2-M
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [refactor, performance, async]
related_files: [src/commands/start.ts, src/core/, src/utils/]
---

# Task: Replace execSync with Async spawn (T024)

## Objective

Replace blocking `execSync` calls with non-blocking async `spawn` or `exec` from `child_process` for all git operations.

**Success:**
- [ ] No `execSync` usage in codebase (or minimal with justification)
- [ ] Git operations don't block event loop
- [ ] All async operations properly awaited
- [ ] Performance improvement measured
- [ ] All tests pass

## Context

**Why:** Quality report identified `execSync` blocking event loop, harming performance.

**Current problem:**
- `execSync` blocks Node.js event loop
- Slows down CLI commands
- Poor user experience (frozen UI)
- Prevents concurrent operations

**Impact:** Better performance, responsive CLI, cleaner async patterns

**Related:** Code Quality Analysis Report 2026-01-19, Performance & Scalability section (Score: 78/100)

## Implementation

### Phase 1: Audit execSync Usage (Est: 0.5h)
- [ ] Find all `execSync` calls:
  ```bash
  grep -rn "execSync" src/
  ```
- [ ] Document each usage:
  - Where: file and line number
  - Purpose: what git command
  - Blocking time: estimate (<100ms? >1s?)
- [ ] Prioritize by impact (frequently called? slow command?)

### Phase 2: Create Async Helper (Est: 1h)
- [ ] Create `src/utils/git.ts` with async git helpers:
  ```typescript
  import { spawn } from 'child_process';

  export async function git(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`git ${args.join(' ')} failed: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // Convenience wrappers
  export async function gitStatus(): Promise<string> {
    return git(['status', '--short']);
  }

  export async function gitLog(limit = 5): Promise<string> {
    return git(['log', `--oneline`, `-n`, limit.toString()]);
  }

  export async function gitBranch(): Promise<string> {
    return git(['rev-parse', '--abbrev-ref', 'HEAD']);
  }
  ```
- [ ] Add TypeScript types
- [ ] Add error handling
- [ ] Add timeout support (optional)

### Phase 3: Refactor All Usages (Est: 1h)
- [ ] Replace each `execSync` with async `git()`:
  ```typescript
  // Before
  const status = execSync('git status --short').toString();

  // After
  const status = await gitStatus();
  ```
- [ ] Update callers to be async (add `async` keyword)
- [ ] Properly await all git operations
- [ ] Remove `execSync` imports

### Phase 4: Testing (Est: 0.5h)
- [ ] Write unit tests for `git.ts`:
  - [ ] Successful git command
  - [ ] Failed git command
  - [ ] Invalid args
  - [ ] Not in git repo
- [ ] Run existing tests (should pass)
- [ ] Manual testing on real projects
- [ ] Benchmark performance improvement

## Definition of Done

### Functionality
- [ ] All git operations work correctly
- [ ] Edge cases handled:
  - [ ] Not in git repo
  - [ ] Git command fails
  - [ ] Empty output
  - [ ] Large output (>1MB)
- [ ] Error messages user-friendly

### Testing
- [ ] Unit tests for git helper
- [ ] All existing tests pass
- [ ] Manual verification
- [ ] Performance test (optional)

### Performance
- [ ] No blocking operations
- [ ] Commands feel more responsive
- [ ] Benchmark improvement (optional)

### Security
- [ ] No command injection (args properly escaped)
- [ ] User input sanitized before passing to git
- [ ] Safe error messages (no sensitive data leaked)

### Code Quality
- [ ] TypeScript strict mode
- [ ] Proper async/await patterns
- [ ] No unhandled promise rejections
- [ ] Clean code
- [ ] JSDoc on public functions

### Documentation
- [ ] Time logged
- [ ] JSDoc on git helper functions
- [ ] README unchanged (internal optimization)

### Git
- [ ] Atomic commits:
  1. Create git helper utilities
  2. Refactor start.ts to use async git
  3. Refactor other files to use async git
  4. Remove all execSync imports
- [ ] Convention: `refactor(utils): replace execSync with async spawn for git operations`
- [ ] No conflicts

## Testing

### Unit Tests
```typescript
// tests/utils/git.test.ts
import { git, gitStatus, gitLog } from '@/utils/git';
import { spawn } from 'child_process';

jest.mock('child_process');

describe('git utilities', () => {
  test('git() executes command successfully', async () => {
    const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    // Mock spawn to return success

    const result = await git(['status']);
    expect(result).toBe('expected output');
  });

  test('git() handles command failure', async () => {
    // Mock spawn to return non-zero exit code

    await expect(git(['invalid'])).rejects.toThrow();
  });

  test('gitStatus() returns short status', async () => {
    const result = await gitStatus();
    expect(result).toMatch(/M\s+file\.ts/);
  });
});
```

### Manual
```bash
# Build and test
pnpm build

# Test git operations
aipim start  # Should show git status
aipim resume # Should show last commit

# Verify no blocking
# CLI should feel responsive
# No frozen UI
```

## Blockers & Risks

**Current:**
- [ ] None (can start immediately)

**Potential:**
1. Risk: spawn is more complex than execSync - Mitigation: Create clean helper functions
2. Risk: Breaking changes to existing code - Mitigation: Comprehensive testing
3. Risk: Async refactor might introduce bugs - Mitigation: Gradual migration, test each change
4. Risk: User input in git commands - Mitigation: Sanitize and validate all inputs

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| | 0 | Not started |

**Total:** 0h / 3h

## Technical Notes

**Current execSync locations (to be found):**
```bash
# Find all usages
grep -rn "execSync" src/

# Example locations:
# - src/commands/start.ts (git status, git log)
# - src/core/detector.ts (git check)
# - Others?
```

**Security considerations:**
```typescript
// BAD: Command injection risk
const branch = await git([userInput]); // DANGEROUS

// GOOD: Sanitized input
const safeBranch = userInput.replace(/[^a-zA-Z0-9_-]/g, '');
const branch = await git(['checkout', safeBranch]);

// BETTER: Whitelist validation
if (!/^[a-zA-Z0-9_-]+$/.test(userInput)) {
  throw new Error('Invalid branch name');
}
const branch = await git(['checkout', userInput]);
```

**Error handling:**
```typescript
// Wrapper with better error messages
export async function gitSafe(
  args: string[],
  fallback?: string
): Promise<string> {
  try {
    return await git(args);
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// Usage
const status = await gitSafe(['status', '--short'], 'Not a git repository');
```

**Timeout support (optional):**
```typescript
export async function git(
  args: string[],
  timeout = 5000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args);
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Git command timed out after ${timeout}ms`));
    }, timeout);

    // ... rest of implementation ...

    proc.on('close', (code) => {
      clearTimeout(timer);
      // ... handle result ...
    });
  });
}
```

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Performance & Scalability section (recommendation #3)
- Node.js child_process docs: https://nodejs.org/api/child_process.html
- Async best practices: https://nodejs.org/en/docs/guides/blocking-vs-non-blocking/

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 3h, Actual: ___h, Diff: ___%

**Lessons:**
1.

**Migration summary:**
- execSync usages before: ___
- execSync usages after: ___
- Performance improvement: ___%

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed
- [ ] No execSync in codebase (or justified exceptions)

**Completed:** ___________
**Final time:** _____ hours
