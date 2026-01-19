---
title: "Task Name"
created: 2025-01-07T10:00:00-03:00
last_updated: 2025-01-07T10:00:00-03:00
priority: P2-M
estimated_hours: 4
actual_hours: 0
status: backlog
blockers: []
tags: [backend, api]
related_files: []
---

# Task: [Task Name]

## Objective

[Clear description of what needs to be done and why]

**Success:**
- [ ] Criterion 1
- [ ] Criterion 2

## Context

**Why:** [Problem this solves]

**Dependencies:**
- [ ] Task X completed
- [ ] Resource Y available

**Related:** [Links to ADRs, docs]

## Implementation

### Phase 1 (Est: Xh)
- [ ] Step 1.1
- [ ] Step 1.2

### Phase 2 (Est: Xh)
- [ ] Step 2.1
- [ ] Step 2.2

<!--
NOTE: For tasks >12h, use Phase Breakdown Protocol (see project-manager.md)

Example for 18h task:

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

### Phase 3: Testing (5h)
- [ ] Unit tests for core logic
- [ ] Integration tests
- [ ] Edge case coverage
- [ ] Performance validation

**Deliverable:** 80%+ test coverage
**Commit message:** test(phase3): comprehensive test suite

### Phase 4: Documentation (4h)
- [ ] API documentation
- [ ] README updates
- [ ] Usage examples
- [ ] Code comments where needed

**Deliverable:** Complete documentation
**Commit message:** docs(phase4): add comprehensive documentation

Total: 3+6+5+4 = 18h ✓
-->

## Definition of Done

### Functionality
- [ ] Works as specified
- [ ] Edge cases: [list]
- [ ] Error messages user-friendly
- [ ] Loading states
- [ ] Responsive

### Testing
- [ ] Unit tests: [components]
- [ ] Feature tests: [scenarios]
- [ ] Manual browser (no errors)
- [ ] Coverage >80%

### Performance
- [ ] No N+1 (verified)
- [ ] Eager loading
- [ ] Indexes on FKs
- [ ] Cached: [strategy]
- [ ] <2s load
- [ ] Paginated

### Security
- [ ] Input validated: [Request class]
- [ ] Auth checked: [Policy]
- [ ] No secrets logged
- [ ] CSRF protected
- [ ] SQL-safe
- [ ] XSS-safe

### Code Quality
- [ ] PSR-12 compliant
- [ ] Complex logic documented
- [ ] No debug statements
- [ ] Clean names

### Documentation
- [ ] Time logged
- [ ] ADR if decision made
- [ ] README if API changed

### Git
- [ ] Atomic commits
- [ ] Convention: type(scope): msg
- [ ] No conflicts

## Testing

### Unit Tests
```php
test('handles X correctly', function () {
    // Test here
});
```

### Feature Tests
```php
test('user can do Y', function () {
    // Test here
});
```

### Manual
- [ ] Happy path
- [ ] Error cases
- [ ] Edge cases
- [ ] Large dataset

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: [desc] - Mitigation: [how]

## Progress

### Time Log
| Date | Hours | Activity |
|------|-------|----------|
| 2025-01-07 | 2.0 | Initial work |

**Total:** 0h / 4h

### Updates
#### 2025-01-07
- ✅ Done: X
- 🔄 In progress: Y
- 📝 Notes: Z

## Technical Notes

**Decisions:**
1. Use X because Y

**Gotchas:**
- ⚠️ Warning: Z

**Code:**
```php
// Important pattern
```

## References

- [Doc link](url)
- Issue #123

## Retrospective (Post-completion)

**Went well:**
- 

**Improve:**
- 

**Estimate:**
- Est: Xh, Actual: Yh, Diff: Z%

**Lessons:**
1. 

## Pain Points (During Testing)

### Category: Performance
- [ ] Feature X too slow (>5s response time)
  **Impact:** High - blocks user workflow
  **Frequency:** Every request
  **Action:** → Create task for optimization

### Category: UX Issues
- [ ] Error messages unclear
  **Impact:** Medium - confuses users
  **Frequency:** Occasional
  **Action:** → Create task for better error handling

### Category: Technical Debt
- [ ] Code duplication in Y and Z modules
  **Impact:** Low - maintenance burden
  **Frequency:** N/A
  **Action:** → Create refactoring task

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Retrospective done
- [ ] Context updated
- [ ] Git merged/ready
- [ ] Validation passed

**Completed:** ___________
**Final time:** _____ hours