---
title: "Add ADR Auto-Creation Detection System"
created: 2026-01-18T15:55:00-03:00
last_updated: 2026-01-18T15:55:00-03:00
priority: P2-M
estimated_hours: 5
actual_hours: 4.5
status: done
blockers: []
tags: [template, automation, documentation, adr]
related_files: [src/templates/base/project-manager.md, src/templates/base/.project/_templates/adr-template.md]
---

# Task: Add ADR Auto-Creation Detection System

## Objective

Implement AI agent protocol that automatically detects when architectural decisions are made during implementation and prompts ADR creation, ensuring all significant decisions are documented.

**Success:**
- [ ] AI detects architectural decision patterns
- [ ] Prompts user to create ADR at appropriate time
- [ ] ADR template is auto-populated with context
- [ ] Decision rationale is captured consistently

## Context

**Why:** Architectural decisions often get lost in code/commits without proper documentation. Future team members (or future self) lose context on "why we chose X over Y".

**Dependencies:**
- [ ] None

**Related:** Uses existing ADR template, adds detection logic

## Implementation

### Phase 1: Define Detection Triggers (Est: 2h)
- [ ] Add section to `src/templates/base/project-manager.md`:
  ```markdown
  ## MANDATORY: ADR Auto-Detection

  After completing checkpoint, detect if you made:
  - Technology/library choice
  - Schema design decision
  - API architecture change
  - Security approach selection
  - Performance optimization pattern

  If YES: Create ADR with context, decision, alternatives, consequences
  ```
- [ ] List specific keywords that trigger detection:
  - "chose X over Y"
  - "decided to use X"
  - "refactored to pattern X"
  - "switched from X to Y"

### Phase 2: ADR Template Enhancement (Est: 2h)
- [ ] Update ADR template with prompts:
  - What was the context/problem?
  - What alternatives were considered?
  - What decision was made and why?
  - What are the consequences (pros/cons)?
- [ ] Add example ADRs for common decision types:
  - Database choice
  - Framework selection
  - Authentication approach
  - Caching strategy

### Phase 3: Integration with Task Workflow (Est: 1h)
- [ ] Add ADR check to task completion checklist
- [ ] Update DoD to include "ADR created if architectural decision made"
- [ ] Link ADR creation to commit message hint: `docs: add ADR for [topic]`

## Definition of Done

### Functionality
- [ ] Detection triggers clearly defined
- [ ] ADR template has decision prompts
- [ ] Example ADRs provided
- [ ] Integration with task workflow complete

### Testing
- [ ] Make sample architectural decision
- [ ] Verify AI prompts for ADR
- [ ] Check ADR is created with correct structure
- [ ] Validate ADR filename follows convention

### Code Quality
- [ ] Clear, unambiguous detection criteria
- [ ] ADR template is well-structured
- [ ] Examples are realistic

### Documentation
- [ ] Time logged
- [ ] Update docs/adr-guide.md
- [ ] Add "when to create ADR" section
- [ ] Include real-world examples

### Git
- [ ] Atomic commits
- [ ] Convention: feat(templates): add ADR auto-detection
- [ ] No conflicts

## Testing

### Manual
- [ ] Simulate choosing between two libraries
- [ ] Verify AI prompts: "This looks like an architectural decision. Should I create an ADR?"
- [ ] Create ADR through workflow
- [ ] Validate ADR content quality

### Scenarios to Test
- [ ] Database schema design
- [ ] REST vs GraphQL choice
- [ ] Monolith vs microservices
- [ ] Authentication method selection

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: False positives (detecting non-architectural decisions) - Mitigation: Tune detection keywords based on feedback
2. Risk: ADR creation friction slows development - Mitigation: Make templates quick to fill out

## Technical Notes

**Decisions:**
1. ADR detection is prompt-based, not AI inference (more reliable)
2. AI suggests ADR creation but doesn't force it
3. ADRs use date-based naming: `YYYY-MM-DD-topic.md`

**Detection Patterns:**
```
Triggers:
- "chose X instead of Y" → ADR
- "refactored to pattern X" → ADR
- "switched from X to Y" → ADR
- "decided on approach X" → ADR

Non-triggers:
- "fixed bug in X" → No ADR
- "renamed variable X" → No ADR
- "added feature X" → No ADR (unless involves new pattern)
```

**Example ADR Auto-Prompt:**
```
I noticed you made an architectural decision: "chose PostgreSQL over MongoDB for profiles".

Should I create an ADR to document this decision? This will help track:
- Why this choice was made
- What alternatives were considered
- Trade-offs and consequences

Create ADR? [yes/no/later]
```

## References

- Michael Nygard's ADR format
- GitHub ADR examples (adr/madr)
- User pain points from undocumented decisions

## Completion

- [x] All DoD checked
- [x] Time logged
- [x] Context updated
- [x] Examples tested
- [x] Documentation complete
