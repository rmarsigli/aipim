---
title: "Document Feature-First Documentation Pattern"
created: 2026-01-18T19:00:00-03:00
last_updated: 2026-01-18T19:00:00-03:00
priority: P2-M
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [documentation, pattern, best-practices]
related_files: [docs/patterns/, src/templates/base/]
---

# Task: Document Feature-First Documentation Pattern

## Objective

Document the pattern of separating business logic (docs/features/) from code implementation, as discovered through real-world usage. This pattern reduces AI context consumption by 99% while maintaining full understanding of project requirements.

**Success:**
- [ ] Pattern documented with rationale
- [ ] Template structure provided
- [ ] Real-world example from DelphiChess project
- [ ] Integration with AIPIM workflow explained

## Context

**Why:** Users like @rmarsigli discovered that maintaining `.project/docs/features/{name}.md` with PURE business logic allows AI to understand requirements without reading entire codebase (2kb docs vs 500kb code = 99% token reduction).

**Dependencies:**
- [ ] Real-world validation (DelphiChess project example)
- [ ] User feedback on pattern effectiveness

**Related:** Complements existing task management, reduces context size

## Implementation

### Phase 1: Document Pattern (1.5h)
- [ ] Create `docs/patterns/feature-first-documentation.md`
- [ ] Explain rationale: business logic vs code separation
- [ ] Show token savings calculation
- [ ] Document when to use this pattern

### Phase 2: Create Template (1h)
- [ ] Add `feature-template.md` to src/templates/base/.project/docs/features/
- [ ] Include sections: Objective, Business Rules, User Stories, Edge Cases
- [ ] Provide DelphiChess example (Oracle, Apollo, Prometheus)
- [ ] Add "anti-patterns" (what NOT to include in feature docs)

### Phase 3: Integration Guide (0.5h)
- [ ] Update basic-usage.md with feature-first workflow
- [ ] Show how AI reads features/ before coding
- [ ] Explain relationship: features → tasks → code
- [ ] Add to project initialization checklist

## Definition of Done

### Functionality
- [ ] Pattern clearly explained with examples
- [ ] Template ready for copy-paste
- [ ] Integration with AIPIM workflow documented
- [ ] Token savings quantified (before/after)

### Testing
- [ ] Create sample feature.md for test project
- [ ] Verify AI understands feature without reading code
- [ ] Test with 3 different project types (web, ML, CLI)
- [ ] Validate token reduction claim (>90%)

### Code Quality
- [ ] Clear, concise documentation
- [ ] Real examples from dogfooding
- [ ] No jargon, accessible to beginners

### Documentation
- [ ] Time logged
- [ ] Examples from real projects
- [ ] ADR created for pattern adoption

### Git
- [ ] Atomic commits
- [ ] Convention: docs(patterns): add feature-first documentation pattern
- [ ] No conflicts

## Testing

### Manual
- [ ] Create feature.md for sample e-commerce project
- [ ] Ask AI to implement feature using only feature.md
- [ ] Compare tokens: with feature.md vs without
- [ ] Verify AI understood requirements correctly

## Technical Notes

**Pattern Structure:**
```
.project/docs/features/
  ├── user-authentication.md    # WHAT: Login, roles, permissions
  ├── payment-processing.md     # WHAT: Stripe, refunds, receipts
  └── recommendation-engine.md  # WHAT: ML, personalization logic

src/                             # HOW: Implementation details
  ├── auth/
  ├── payments/
  └── recommendations/
```

**Anti-Patterns (What NOT to include):**
- ❌ Code snippets (those go in src/)
- ❌ Implementation details (framework-specific)
- ❌ Variable names, class names
- ✅ Business rules, edge cases, user stories
- ✅ "A user can X if Y condition"
- ✅ "System must reject Z when W"

**Token Savings Example:**
- Traditional: AI reads `src/oracle/**/*.py` (482kb, ~120k tokens)
- Feature-First: AI reads `docs/features/oracle.md` (2.1kb, ~500 tokens)
- **Savings: 99.6% tokens, 240x faster context loading**

## References

- User feedback: @rmarsigli DelphiChess project
- Domain-Driven Design: Ubiquitous Language concept
- Agile: User Story format

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] ADR created for pattern
