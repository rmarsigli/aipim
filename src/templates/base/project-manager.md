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
3. **Update metrics** (see Metrics Protocol below)
4. Commit & push

## Large Task Auto-Breakdown Protocol

**MANDATORY: Break down tasks >12h into manageable phases**

### When to Break Down

When starting a task with `estimated_hours > 12`:

1. **Analyze complexity** and identify natural phases
2. **Create 3-5 phases** of 2-6 hours each
3. **Document phases** in current-task.md under Implementation section
4. **Treat each phase as mini-task** with its own commit upon completion

### Phase Breakdown Criteria

**Typical phase structure:**

1. **Setup/Scaffolding** (1-3h)
   - Schema/migrations
   - Directory structure
   - Dependencies
   - Basic configuration

2. **Core Implementation** (4-6h)
   - Main business logic
   - Data processing
   - API endpoints
   - Integration points

3. **Testing** (2-4h)
   - Unit tests
   - Integration tests
   - Edge cases
   - Error handling

4. **Documentation & Polish** (1-3h)
   - API documentation
   - README updates
   - Code cleanup
   - Examples

### Phase Documentation Format

Add to current-task.md under Implementation:

```markdown
### Phase 1: Setup & Schema (3h)
- [ ] Define data schema
- [ ] Create database tables/migrations
- [ ] Setup dependencies
- [ ] Basic configuration

**Deliverable:** Database ready, dependencies installed
**Commit message:** feat(phase1): setup schema and dependencies

### Phase 2: Core Implementation (6h)
- [ ] Implement main business logic
- [ ] Create API endpoints
- [ ] Add data validation
- [ ] Error handling

**Deliverable:** Core functionality working
**Commit message:** feat(phase2): implement core functionality

### Phase 3: Testing (4h)
- [ ] Unit tests for core logic
- [ ] Integration tests
- [ ] Edge case coverage
- [ ] Performance validation

**Deliverable:** 80%+ test coverage
**Commit message:** test(phase3): comprehensive test suite

### Phase 4: Documentation (2h)
- [ ] API documentation
- [ ] README updates
- [ ] Usage examples
- [ ] Code comments where needed

**Deliverable:** Complete documentation
**Commit message:** docs(phase4): add comprehensive documentation
```

### Validation Rules

**Before starting implementation, verify:**

1. ✅ All phases clearly defined with deliverables
2. ✅ Sum of phase estimates matches total estimate (±1h tolerance)
3. ✅ Each phase is 2-6 hours (not too small, not too large)
4. ✅ Each phase has clear completion criteria
5. ✅ Commit message convention defined per phase

**During implementation:**

- Complete phases sequentially (no skipping)
- Commit immediately after completing each phase
- Update checkboxes in real-time
- If phase exceeds estimate by >50%, reassess remaining phases

### Benefits

- **Reduced stall risk:** Clear checkpoints prevent midway blockage
- **Better tracking:** Visible progress through phase completion
- **Atomic commits:** Each phase is a logical unit of work
- **Easier estimation:** Breaking down improves accuracy for future tasks
- **Context preservation:** Easier to resume if interrupted

### Example: 18h Task Breakdown

**Before (risky):**
```yaml
title: "Implement Oracle Profiling System"
estimated_hours: 18
```

**After (manageable):**
```markdown
## Implementation

### Phase 1: Setup & Schema (3h)
- [ ] Define profile schema (tactics, patterns, confidence)
- [ ] Create PostgreSQL tables with indexes
- [ ] Write migrations
- [ ] Setup model relationships

### Phase 2: Tactical Pattern Detection (6h)
- [ ] Implement pin detection algorithm
- [ ] Add fork detection logic
- [ ] Create skewer pattern recognition
- [ ] Build discovered attack tracker
- [ ] Add confidence scoring system

### Phase 3: Testing & Validation (5h)
- [ ] Unit tests for each pattern detector
- [ ] Integration tests with sample games
- [ ] Edge case handling (ambiguous positions)
- [ ] Performance tests (1000+ game analysis)

### Phase 4: Documentation & Polish (4h)
- [ ] API documentation for profiling endpoints
- [ ] README with usage examples
- [ ] Code cleanup and optimization
- [ ] Add inline comments for complex algorithms
```

**Result:** 4 phases × avg 4.5h = 18h total, each with clear deliverable

## Metrics Tracking Protocol

**MANDATORY: Update metrics after completing each task**

### When to Update

1. **After completing each task** - Update productivity metrics
2. **Weekly on Fridays** - Generate weekly report
3. **Monthly on last Friday** - Generate monthly trend report

### Metrics to Track

Update the Metrics section in `context.md` with:

**Productivity:**
```markdown
- Tasks completed this week: X
- Tasks completed this month: Y
- Estimate accuracy: Z (actual/estimated avg)
- Velocity trend: ↗️/→/↘️ (compare last 4 weeks)
```

**Calculation formulas:**
- Estimate accuracy = `sum(actual_hours from completed/) / sum(estimated_hours from completed/)`
- Velocity trend = Compare task counts: last week vs 4-week average
  - ↗️ Improving: >10% increase
  - → Stable: ±10%
  - ↘️ Declining: >10% decrease

**Quality:**
```markdown
- Test coverage: X% (from coverage reports)
- Bugs reported this week/month: Y
- Code quality warnings: Z (linter output)
```

**Blockers:**
```markdown
- Most common type: X (parse blocker: field from completed tasks)
- Average resolution time: Y hours
- Active blockers: Z (from current-task.md)
```

**Trends (Last 30 Days):**
```markdown
- Tasks completed: X (prev: Y) ↗️ +Z%
- Average task size: Xh (prev: Yh)
- Rework rate: X% (tasks requiring fixes after completion)
```

### Automation Helper

Optional: Use `.project/scripts/calculate-metrics.sh` to auto-calculate metrics from completed task files.

```bash
# Generate metrics report
.project/scripts/calculate-metrics.sh

# Output formatted for context.md
.project/scripts/calculate-metrics.sh --format=markdown
```

### Example Update

After completing TASK-003 (5h estimated, 4.5h actual):

```diff
  **Productivity:**
- - Tasks completed this week: 2
+ - Tasks completed this week: 3
- - Estimate accuracy: 1.15
+ - Estimate accuracy: 1.12
```

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
# Start new task from template (for new tasks)
cp .project/_templates/task.md .project/current-task.md

# Start task from backlog (IMPORTANT: use mv not cp)
mv .project/backlog/TASK-XXX.md .project/current-task.md

# Complete task
mv .project/current-task.md .project/completed/$(date +%Y-%m-%d)-name.md

# Create ADR
cp .project/_templates/adr.md .project/decisions/$(date +%Y-%m-%d)-name.md

# Validate quality
.project/scripts/validate-dod.sh

# Check session budget
.project/scripts/pre-session.sh
```

**⚠️ Critical:** When starting a task from backlog, use `mv` (not `cp`) to remove it from backlog. Task should only exist in one place: backlog → current-task → completed.

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

### Automatic Context Pruning

**MANDATORY: Archive old sessions every 10 sessions**

When `session number % 10 == 0`:

1. **Create archive directory** (if needed):
   ```bash
   mkdir -p .project/context-archive
   ```

2. **Archive old sessions**:
   - Extract sessions 1 through (N-5) from context.md
   - Save to `.project/context-archive/YYYY-MM-period.md`
   - Filename format: `2026-01-weeks1-2.md` (based on date range)

3. **Update context.md**:
   - Keep only last 5 session summaries
   - Preserve current state, active work, recent decisions
   - Update session counter

4. **Commit**:
   ```bash
   git add .project/context.md .project/context-archive/
   git commit -m "chore: archive context sessions 1-N"
   ```

**Archive structure:**
```
.project/context-archive/
├── 2026-01-weeks1-2.md    # Sessions 1-10
├── 2026-01-weeks3-4.md    # Sessions 11-20
└── 2026-02-weeks1-2.md    # Sessions 21-30
```

**Why:** Keeps context.md under 200 lines, reduces token consumption, preserves history.

**Script:** Optional helper at `.project/scripts/archive-context.sh` (see below)

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