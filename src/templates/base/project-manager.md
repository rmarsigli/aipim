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

## Context Management

### context.md Structure

```yaml
---
session: 42
last_updated: 2025-01-07T14:30:00-03:00
active_branches: [feature/auth]
blockers: []
next_action: "Complete login tests"
---

# Current State
[2-3 sentences: where are we?]

# Active Work
[What's in progress, what's blocked]

# Recent Decisions
[Last 2-3 important decisions]

# Next Steps
1. Immediate action
2. Then this
3. Then that
```

**Keep concise:** Max 200 lines. Archive old sessions to `context-archive/`.

Template: `.project/_templates/context.md`

## File Management

**Complex tasks** (>20 checkboxes OR >500 lines): Use directory

```
current-task/
  ├── main.md           # Master checklist
  ├── implementation.md # Technical details
  └── testing.md        # Test plan
```

**Completion:** Move entire directory to `completed/YYYY-MM-DD-name/`

## Code Context Loading (IMPORTANT)

**Load selectively to save tokens:**
- Only files being actively edited (max 3-4 per turn)
- Use `view` tool for reference, don't keep in memory
- Avoid loading large files entirely (use line ranges)

Example:
```
# GOOD (specific)
view app/Models/User.php

# BAD (loads everything)
view app/
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

## Architectural Decisions (ADR)

**Create ADR for:**
- Technology/framework selection
- Database schema design
- API architecture
- Security approach
- Major refactoring

**Format:** See `.project/_templates/adr.md`

**Status values:** Proposed | Accepted | Deprecated | Superseded

## Automation

### Validation Script

```bash
# Before completing task
.project/scripts/validate-dod.sh
```

Checks: debug statements, tests, N+1 queries, security, documentation

### Pre-session Check

```bash
# Before starting session
.project/scripts/pre-session.sh
```

Shows: token estimate, large files, git status

## Working with Multiple Devs

**Option 1:** Personal task files
```
current-task-rafhael.md
current-task-joao.md
```

**Option 2:** Branch-based (recommended)
```
git checkout feature/auth     → .project/current-task.md
git checkout feature/payments → .project/current-task.md (different)
```

## Metrics to Track

**Quality:**
- Test coverage trend
- Bugs in production
- DoD compliance rate

**Velocity:**
- Tasks completed/week
- Estimate accuracy (actual vs estimated)
- Time to restore context

**Process:**
- Stale tasks (>14 days not updated)
- Blocker resolution time
- ADR review compliance

## Troubleshooting

**context.md too long?**
```bash
mkdir -p .project/context-archive/
mv .project/context.md .project/context-archive/2025-01-Q1.md
cp .project/_templates/context.md .project/context.md
```

**Backlog overwhelming?**
```bash
# Archive low-priority old items
mkdir -p .project/ideas/archived/
mv .project/backlog/*P4*.md .project/ideas/archived/
```

**Hit token limits?**
- Run `pre-session.sh` before starting
- Archive old context sessions
- Load fewer files in memory
- Use line ranges with view tool

## Documentation Links

**Full documentation:**
- `.project/docs/task-management.md` - Complete task workflow
- `.project/docs/definition-of-done.md` - Full DoD checklist
- `.project/docs/adr-guide.md` - Architecture decision records
- `.project/docs/examples/` - Complete examples

**Quick references:**
- Git convention: `type(scope): description`
  - Types: feat, fix, docs, style, refactor, test, chore
- Commit atomically (one logical change per commit)
- Branch naming: `feature/name` or `fix/name`

## Version & Updates

**Version:** 1.2 Compact  
**Last updated:** 2025-01-07  
**Full version:** Available as `CLAUDE-full.md` for reference  

**When to use full version:**
- First time using system (read once)
- Training new team members
- Need detailed examples

**When to use compact version:**
- Daily development (this file)
- Quick reference
- Token optimization