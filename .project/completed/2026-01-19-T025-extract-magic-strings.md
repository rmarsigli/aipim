---
title: "Extract Magic Strings to Constants/Enums"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T02:00:00-03:00
priority: P2-M
estimated_hours: 2
actual_hours: 0
status: backlog
blockers: []
tags: [refactor, code-quality, constants]
related_files: [src/constants.ts, src/commands/, src/core/]
---

# Task: Extract Magic Strings to Constants (T025)

## Objective

Replace hardcoded "magic strings" with named constants or enums for better maintainability and type safety.

**Success:**
- [ ] All AI tool names centralized (claude-code, gemini, chatgpt, etc)
- [ ] File extensions in constants (.md, .ts, .json)
- [ ] Command names in enums
- [ ] No duplicate string literals
- [ ] Type-safe string references

## Context

**Why:** Quality report identified magic strings scattered in codebase. Hard to maintain and error-prone.

**Current problem:**
- AI tool names repeated everywhere ('claude-code', 'gemini', etc)
- File extensions hardcoded ('.md', '.ts')
- Command names as strings (typo risk)
- Hard to refactor (find-replace risky)

**Impact:** Better maintainability, type safety, easier refactoring

**Related:** Code Quality Analysis Report 2026-01-19, Code Quality & Readability section (Score: 85/100)

## Implementation

### Phase 1: Audit Magic Strings (Est: 0.5h)
- [ ] Find all string literals in codebase:
  ```bash
  # AI tools
  grep -rn "'claude-code'\|\"claude-code\"" src/
  grep -rn "'gemini'\|\"gemini\"" src/
  grep -rn "'chatgpt'\|\"chatgpt\"" src/

  # File extensions
  grep -rn "'\\.md'\|\"\.md\"" src/
  grep -rn "'\\.ts'\|\"\.ts\"" src/

  # Commands
  grep -rn "'start'\|\"start\"" src/commands/
  ```
- [ ] Document all magic strings by category
- [ ] Prioritize by frequency (most used first)

### Phase 2: Create Constants (Est: 1h)
- [ ] Update `src/constants.ts`:
  ```typescript
  // AI Tools
  export enum AITool {
    CLAUDE_CODE = 'claude-code',
    GEMINI = 'gemini',
    CHATGPT = 'chatgpt',
    CURSOR = 'cursor',
  }

  // File Extensions
  export enum FileExtension {
    MARKDOWN = '.md',
    TYPESCRIPT = '.ts',
    JSON = '.json',
    YAML = '.yaml',
  }

  // AIPIM Files
  export const AIPIM_FILES = {
    CONTEXT: 'context.md',
    CURRENT_TASK: 'current-task.md',
    CLAUDE_PROMPT: 'CLAUDE.md',
    GEMINI_PROMPT: 'GEMINI.md',
  } as const;

  // Commands
  export enum Command {
    START = 'start',
    RESUME = 'resume',
    PAUSE = 'pause',
    DEPS = 'deps',
    INSTALL = 'install',
    TEMPLATE = 'template',
    DIFF = 'diff',
  }

  // Directories
  export const AIPIM_DIRS = {
    PROJECT: '.project',
    BACKLOG: '.project/backlog',
    COMPLETED: '.project/completed',
    DECISIONS: '.project/decisions',
    TEMPLATES: '.project/_templates',
  } as const;
  ```
- [ ] Add JSDoc comments for clarity
- [ ] Export all constants

### Phase 3: Refactor Codebase (Est: 0.5h)
- [ ] Replace all magic strings with constants:
  ```typescript
  // Before
  if (tool === 'claude-code') { ... }

  // After
  import { AITool } from './constants';
  if (tool === AITool.CLAUDE_CODE) { ... }
  ```
- [ ] Update all files systematically
- [ ] Use find-replace carefully (verify each change)
- [ ] Run tests after each file/group

## Definition of Done

### Functionality
- [ ] All functionality unchanged
- [ ] No regressions
- [ ] All tests pass

### Testing
- [ ] Existing tests pass
- [ ] Manual verification of commands
- [ ] Type checking passes (`pnpm tsc --noEmit`)

### Performance
- [ ] No performance impact (constants are compile-time)

### Security
- [ ] No security implications

### Code Quality
- [ ] No duplicate string literals (for categorized strings)
- [ ] TypeScript types correct
- [ ] Enums used where appropriate
- [ ] Constants grouped logically
- [ ] Linting passes
- [ ] **Grep verification:**
  ```bash
  # Should have ZERO results after refactor
  grep -rn "'claude-code'" src/
  grep -rn "'gemini'" src/
  grep -rn "'\\.md'" src/
  ```

### Documentation
- [ ] Time logged
- [ ] Constants file has JSDoc
- [ ] No README changes needed

### Git
- [ ] Atomic commits:
  1. Add new constants to constants.ts
  2. Refactor commands/ to use constants
  3. Refactor core/ to use constants
  4. Refactor utils/ to use constants
- [ ] Convention: `refactor(constants): extract magic strings to typed constants`
- [ ] No conflicts

## Testing

### Type Safety
```typescript
// Type safety with enums
function handleTool(tool: AITool) {
  switch (tool) {
    case AITool.CLAUDE_CODE: // autocomplete works!
      return 'Claude Code';
    case AITool.GEMINI:
      return 'Gemini';
    // TypeScript error if case missing!
  }
}

// Type error caught at compile time
handleTool('invalid-tool'); // ERROR: not assignable to AITool
```

### Manual
```bash
# Build (catches type errors)
pnpm build

# Run all commands
aipim start
aipim resume
aipim install --ai claude-code
aipim install --ai gemini

# All should work exactly as before
```

### Grep Verification
```bash
# After refactor, verify no magic strings remain
grep -rn "'claude-code'\|'gemini'\|'chatgpt'" src/
# Should only match: enum definitions, comments, test mocks

grep -rn "'\\.md'\|'\\.ts'" src/
# Should only match: actual file operations (unavoidable)
```

## Blockers & Risks

**Current:**
- [ ] None (can start immediately)

**Potential:**
1. Risk: Breaking changes if strings used in comparisons - Mitigation: Careful refactor, test each file
2. Risk: External APIs might expect specific strings - Mitigation: Keep enum values identical to current strings
3. Risk: Over-engineering (too many constants) - Mitigation: Only extract frequently-used or error-prone strings

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| | 0 | Not started |

**Total:** 0h / 2h

## Technical Notes

**Prioritization:**
1. **High priority** (refactor):
   - AI tool names (claude-code, gemini, etc) → Enum
   - Command names (start, resume, etc) → Enum
   - AIPIM file names (context.md, etc) → Constants

2. **Medium priority** (refactor if time permits):
   - File extensions (.md, .ts) → Enum
   - Directory paths (.project/, etc) → Constants

3. **Low priority** (leave as-is):
   - User-facing strings ("Error: ...", "Success: ...")
   - Dynamic strings (variable content)
   - One-off strings

**Enum vs const:**
- **Use enum when:**
  - Fixed set of values
  - Want type checking
  - Values used in switch statements
  - Example: AITool, Command

- **Use const object when:**
  - Related constants
  - Don't need exhaustive type checking
  - Example: AIPIM_FILES, AIPIM_DIRS

**Example refactor:**
```typescript
// BEFORE
// src/commands/install.ts
if (options.ai === 'claude-code') {
  generateFile('CLAUDE.md');
} else if (options.ai === 'gemini') {
  generateFile('GEMINI.md');
}

// AFTER
// src/commands/install.ts
import { AITool, AIPIM_FILES } from '../constants';

if (options.ai === AITool.CLAUDE_CODE) {
  generateFile(AIPIM_FILES.CLAUDE_PROMPT);
} else if (options.ai === AITool.GEMINI) {
  generateFile(AIPIM_FILES.GEMINI_PROMPT);
}
```

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- Code Quality & Readability section (recommendation #1)
- TypeScript enums: https://www.typescriptlang.org/docs/handbook/enums.html
- Magic strings antipattern: https://refactoring.guru/smells/magic-numbers

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 2h, Actual: ___h, Diff: ___%

**Lessons:**
1.

**Magic strings eliminated:**
- AI tool names: ___ occurrences → 0
- File extensions: ___ occurrences → ___
- Command names: ___ occurrences → 0

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed
- [ ] Grep verification passed

**Completed:** ___________
**Final time:** _____ hours
