---
title: "Fix completion.ts binary name (aipm → aipim)"
created: 2026-01-19T02:00:00-03:00
last_updated: 2026-01-19T02:00:00-03:00
priority: P1-S
estimated_hours: 0.25
actual_hours: 0
status: backlog
blockers: []
tags: [bugfix, naming, cli, urgent]
related_files: [src/commands/completion.ts]
---

# Task: Fix completion.ts Binary Name (T017)

## Objective

Fix hardcoded binary name in completion.ts that references `aipm` instead of `aipim`.

**Success:**
- [ ] Bash completion script generates correct binary name (`aipim`)
- [ ] Shell completion works correctly after fix
- [ ] No references to old name in completion logic

## Context

**Why:** Quality report identified naming inconsistency. Shell completion fails or completes wrong command.

**Impact:** Users installing bash/zsh completion get wrong command name, breaking autocomplete.

**Related:** Code Quality Analysis Report 2026-01-19, ADR-004 (Standardize Naming), T016 (package.json URLs)

## Implementation

### Single Phase (Est: 0.25h = 15min)
- [ ] Read src/commands/completion.ts
- [ ] Find all occurrences of `aipm` string
- [ ] Replace with `aipim`
- [ ] Test bash completion generation
- [ ] Verify completion works in shell
- [ ] Commit change

## Definition of Done

### Functionality
- [ ] Works as specified
- [ ] `aipim completion bash` generates correct script
- [ ] `aipim completion zsh` generates correct script
- [ ] Completion works in actual shell (manual test)

### Testing
- [ ] Unit test for completion command (if exists)
- [ ] Manual test: Install completion and verify `aipim <TAB>` works
- [ ] No errors in shell after sourcing completion

### Security
- [ ] Generated script safe (no command injection)
- [ ] No arbitrary code execution in completion

### Code Quality
- [ ] TypeScript types correct
- [ ] No hardcoded strings (use constant if needed)
- [ ] Clean code

### Documentation
- [ ] Time logged
- [ ] No ADR needed (trivial fix)
- [ ] Completion docs updated if they reference old name

### Git
- [ ] Atomic commit
- [ ] Convention: `fix(cli): correct binary name in completion from aipm to aipim`
- [ ] No conflicts

## Testing

### Manual
```bash
# Generate completion
pnpm build
aipim completion bash > /tmp/aipim-completion.sh

# Check it references correct name
grep "aipim" /tmp/aipim-completion.sh
grep "aipm" /tmp/aipim-completion.sh  # Should be ZERO results

# Test in shell
source /tmp/aipim-completion.sh
aipim <TAB>  # Should show commands
```

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Completion might be dynamically generated - Mitigation: Read code to understand generation logic
2. Risk: Name might be in multiple places - Mitigation: Grep entire file

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| | 0 | Not started |

**Total:** 0h / 0.25h

## Technical Notes

**Search pattern:**
```bash
# Find all references
grep -n "aipm" src/commands/completion.ts

# After fix, verify clean
grep -n "aipm" src/commands/completion.ts  # Should be empty
```

**Likely changes:**
- Command name in completion template
- Binary path if hardcoded
- Help text if it mentions binary name

## References

- Code Quality Analysis Report: `.project/reports/code-quality-analysis-2026-01-19.md`
- ADR-004: Standardize naming
- Shell completion docs (if exist)

## Retrospective (Post-completion)

**Went well:**
-

**Improve:**
-

**Estimate:**
- Est: 0.25h, Actual: ___h, Diff: ___%

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
