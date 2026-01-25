# Project Management System (Compact)

> AI-assisted development with context persistence. Full docs: `.project/docs/`

{{SLOT:guidelines}}
<!-- Framework guidelines go here -->
{{/SLOT:guidelines}}

## Directory Structure

```
.project/
  ├── _templates/          # Templates (task, context, adr, backlog)
  ├── current-task.md      # Active work (or current-task/ for complex)
  ├── context.md           # Session state persistence
  ├── backlog/             # Future: YYYY-MM-DD-name.md
  ├── completed/           # Archive: YYYY-MM-DD-name.md
  ├── decisions/           # ADRs: YYYY-MM-DD-name.md
  ├── docs/                # Documentation
  ├── scripts/             # Automation (validate-dod.sh, pre-session.sh)
  └── README.md            # Project overview
```

## Session Protocol

**Start:**
1. Read `context.md` (session state, next_action)
2. Read `current-task.md` (active checklist)
3. Review last commit: `git log -1 --oneline`
4. Continue from next_action

**During:**
- Update task checkboxes as completed
- Commit frequently
- Add discoveries to task or backlog

**End:**
1. Update `current-task.md`: actual_hours, checkboxes
2. Update `context.md`: session++, next_action, summary
3. Commit & push

## Task Workflow Protocol (MANDATORY)

**When user says "do next task" or "start task X", you MUST follow this protocol:**

**1. Context Loading (REQUIRED FIRST STEP):**
- Read THIS FILE (CURSOR.md) - contains MANDATORY project guidelines
- Read `.project/context.md` - session state and metrics
- Read `.project/backlog/` - check which task is next (or specified)
- Count completed tasks in `.project/completed/` to know progress

**2. Quality Gates (BEFORE marking task complete):**
- [ ] All tests passing (`npm test` or equivalent)
- [ ] No lint warnings (`npm run lint`)
- [ ] Definition of Done satisfied (see DoD section above)
- [ ] Code reviewed and clean (no debug code, console.logs, TODOs)

**3. Git Commit (ONE atomic commit per task):**
- Format: `type(scope): description` (SINGLE LINE ONLY)
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat(task): implement user authentication`
- NO multi-line commits, NO extra explanations in commit message

**4. Context Awareness (CRITICAL):**
- When your context window is running low (>70% used):
  - ⚠️ WARN the user explicitly: "Context running low, recommend pausing"
  - DO NOT continue to next task automatically
  - Let user start fresh session to maintain quality
- This prevents rushed work and maintains code quality

**5. Session Integrity (CRUCIAL FOR QUALITY):**
- NEVER pick up a session mid-task
- Complete current task fully OR pause and let user resume later
- One task = one complete cycle (start → implement → test → commit → done)
- This ensures each task has full context and attention

**Why this matters:** Tasks done with fragmented context lead to bugs, inconsistencies, and technical debt. Better to pause and resume fresh than rush through with degraded context.

## Task File Format

```yaml
---
title: "Feature Name"
created: 2025-01-07T10:00:00-03:00
last_updated: 2025-01-07T14:00:00-03:00
priority: P1-M              # P1-S/M/L | P2-S/M/L | P3 | P4
estimated_hours: 8
actual_hours: 0
status: in-progress         # backlog | in-progress | blocked | completed
blockers: []
tags: [backend, api]
---
```

Template: `.project/_templates/task.md`

## Priority System

| Code | Meaning | Action |
|------|---------|--------|
| P1-S | Critical + Small (<2h) | Do now |
| P1-M | Critical + Medium (2-8h) | Today |
| P1-L | Critical + Large (>8h) | Break down |
| P2-S | High + Small | Quick win |
| P2-M | High + Medium | This week |
| P2-L | High + Large | Plan |
| P3 | Nice to have | Backlog |
| P4 | Low priority | Maybe never |

## Definition of Done (Essential)

**Must check ALL before completing:**

Functionality: [ ] Works [ ] Edge cases [ ] Errors [ ] Loading [ ] Responsive
Testing: [ ] Unit [ ] Feature [ ] Browser OK [ ] 80%+ coverage
Performance: [ ] No N+1 [ ] Eager load [ ] Indexes [ ] Cache [ ] <2s [ ] Paginated
Security: [ ] Validation [ ] Auth [ ] No secrets logged [ ] CSRF [ ] SQL-safe [ ] XSS-safe
Code: [ ] PSR-12 [ ] Docs [ ] No debug [ ] Clean names
Docs: [ ] Time logged [ ] ADR if needed [ ] README if API changed
Git: [ ] Atomic commits [ ] Convention [ ] No conflicts

Full checklist: `.project/docs/definition-of-done.md`

## Cursor-Specific Guidelines

**Multi-file Editing (Composer):**
- When editing multiple files, maintain consistency across all changes
- Update imports/exports when moving code between files
- Verify type safety across file boundaries
- Run tests after multi-file changes

**Code Actions:**
- Use Cursor's inline suggestions judiciously - verify they follow project guidelines
- Prefer explicit refactoring over auto-complete for complex changes
- Always review generated code for adherence to DoD

**Chat Context:**
- Include relevant file paths in questions: "In src/components/Header.tsx, how should I..."
- Reference task checklist items when asking for help
- Provide error messages in full when debugging

## Common Commands

```bash
# Start new task
cp .project/_templates/task.md .project/current-task.md

# Complete task
mv .project/current-task.md .project/completed/$(date +%Y-%m-%d)-name.md

# Create ADR
cp .project/_templates/adr.md .project/decisions/$(date +%Y-%m-%d)-name.md

# Validate quality
.project/scripts/validate-dod.sh

# Check session budget
.project/scripts/pre-session.sh
```

## Output Guidelines

**Be concise by default:**
- Code: No explanatory comments unless complex
- Responses: 2-3 sentences per point
- Examples: Only when requested
- No apologies or meta-commentary

**Expand when:**
- User asks "explain in detail"
- Security/performance critical
- Complex architectural decision

## Version & Updates

**Version:** 1.2 Compact
**Last updated:** 2025-01-25
**Full version:** Available as `CURSOR-full.md` for reference

<!-- @aipim-signature: PLACEHOLDER -->
<!-- @aipim-version: 1.2.0 -->
