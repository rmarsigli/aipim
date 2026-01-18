---
number: 001
title: "Use AIPIM to Manage AIPIM Development (Dogfooding)"
date: 2026-01-18
status: accepted
authors: [Claude, Rafhael]
review_date: 2026-07-18
tags: [meta, workflow, dogfooding, project-management]
---

# ADR-001: Use AIPIM to Manage AIPIM Development (Dogfooding)

## Status

**Accepted** ✅

Date: 2026-01-18

## Context

**Problem:**
AIPIM is a tool designed to help AI agents manage projects efficiently with persistent context, task tracking, and automated workflows. However, AIPIM's own development was not using AIPIM itself, creating a paradox: we're building a context management tool without using our own context management system.

**Current Situation:**
- AIPIM has no `.project/` structure
- Enhancement ideas exist but aren't tracked systematically
- No backlog, context.md, or task management for AIPIM development
- Missing opportunity to validate our own tool in real-world usage
- Unable to identify gaps in the workflow we're recommending to users

**Forces:**
- **Technical**: AIPIM is a CLI tool that can be used on any project, including itself
- **Quality**: Dogfooding is the gold standard for product development (Microsoft, Apple, GitHub all do it)
- **Validation**: Using our own tool reveals UX issues, missing features, and workflow friction
- **Credibility**: "We use what we build" increases user trust
- **Meta-awareness**: Managing AIPIM with AIPIM creates a feedback loop for continuous improvement

## Decision

**We will:** Use AIPIM to manage AIPIM development, following the exact same workflow we recommend to users.

**Rationale:**

1. **Technical Fit**: AIPIM is framework-agnostic and works perfectly with Node.js/TypeScript projects (which AIPIM itself is)

2. **Operational Viability**:
   - Zero setup cost (just run `aipim install`)
   - No infrastructure needed
   - Works with existing git workflow
   - Compatible with current development tools (pnpm, tsup, jest)

3. **Strategic Alignment**:
   - Validates product-market fit through internal usage
   - Identifies missing features organically (e.g., we discovered need for session metrics tracking while using it on DelphiChess)
   - Demonstrates confidence in our own product
   - Creates authentic examples and documentation
   - Enables rapid iteration based on real pain points

## Alternatives Considered

### Option 1: GitHub Issues + Projects

**Pros:**
- Industry standard
- Built-in collaboration features
- Integration with PRs/commits
- Free for open source

**Cons:**
- No persistent AI context management
- Manual context restoration between sessions
- No task lifecycle automation
- Doesn't validate our own product
- Context scattered across issues/PRs/discussions

**Rejected because:** Doesn't help us understand AIPIM's value proposition or identify improvement areas. We'd be recommending a tool we don't use ourselves.

### Option 2: Linear/Notion/Jira

**Pros:**
- Polished UI
- Advanced features (roadmaps, dependencies)
- Team collaboration built-in

**Cons:**
- External service dependency
- Overkill for solo/small team development
- No AI-context integration
- Misses dogfooding opportunity
- Costs money (or free tier limitations)

**Rejected because:** Same as GitHub Issues - doesn't validate our own product. Also adds external dependencies.

### Option 3: Ad-hoc TODO.md File

**Pros:**
- Simple
- No setup
- In-repo

**Cons:**
- No structure
- No task lifecycle
- No context persistence
- No AI automation
- Becomes stale quickly

**Rejected because:** This is exactly the problem AIPIM was designed to solve.

## Consequences

### Positive
- [x] Real-world validation of AIPIM workflows (verified during DelphiChess usage)
- [x] Identified 5 enhancement tasks organically (TASK-001 through TASK-005)
- [x] Created authentic examples for documentation
- [x] Increased confidence in product quality
- [ ] Community sees "we use what we build" (expected credibility boost)
- [ ] Bug discovery through daily usage (expected)
- [ ] Feature ideas emerge naturally from pain points (expected)

### Negative
- [ ] Potential meta-confusion ("which AIPIM am I using?")
  - **Mitigation:** Clear directory structure, use full paths when ambiguous
- [ ] Risk of over-engineering to serve our own use case
  - **Mitigation:** Validate features with external users before adding

### Neutral
- Development velocity depends on AIPIM's own stability (chicken-and-egg)
- Creates interesting recursive scenarios (e.g., "AIPIM task to improve AIPIM task management")

## Implementation

**Plan:**
1. [x] Install AIPIM in AIPIM project (`aipim install`)
2. [x] Create backlog with enhancement tasks (TASK-001 through TASK-005)
3. [x] Document decision in this ADR
4. [ ] Use AIPIM workflow for next feature development
5. [ ] Iterate on templates based on dogfooding feedback
6. [ ] Share learnings in documentation

**Technical:**
```bash
# Setup (completed 2026-01-18)
cd ~/www/html/aipim
aipim install --yes --ai claude-code --ai gemini

# Created tasks:
# - TASK-001: Session Metrics Tracking
# - TASK-002: Large Task Auto-Breakdown
# - TASK-003: ADR Auto-Creation Detection
# - TASK-004: Context Auto-Pruning
# - TASK-005: Backlog Health Check

# Next development session:
# 1. Read .project/backlog/README.md
# 2. Pick highest priority task
# 3. Follow AIPIM workflow exactly as documented
# 4. Note friction points for future improvement
```

## Validation

**Success Criteria:**
- [x] AIPIM installed successfully in own project ✅
- [x] Backlog created with structured tasks ✅
- [x] First ADR documented (this file) ✅
- [ ] Complete at least 1 task using AIPIM workflow
- [ ] Identify at least 1 UX improvement from dogfooding
- [ ] Update documentation with real-world examples

**Monitoring:**
- Track task completion velocity (actual vs estimated hours)
- Note workflow friction points in task retrospectives
- Measure context.md effectiveness across sessions
- Collect "I wish AIPIM could..." notes for future tasks

**Review Date:** 2026-07-18 (6 months)

Review if:
- AIPIM workflow consistently feels clunky for our own use
- External users report different pain points than we experience
- Dogfooding becomes a development bottleneck

## Lessons Learned

**Went Well:**
- Installation was instant and frictionless
- Task creation felt natural using existing templates
- Backlog immediately provides clarity on roadmap
- Meta-awareness: Writing this ADR validated ADR auto-detection need (TASK-003)

**Improve:**
- Need better onboarding docs for "first task" workflow
- Task template is PHP-focused, should be more generic
- Could use guideline detection for Node.js projects

**Surprises:**
- Writing enhancement tasks revealed template improvements needed
- ADR creation itself triggered idea for ADR automation (recursive improvement!)
- Felt immediately more organized after running `aipim install`

## Related

**Depends on:**
- None (foundational decision)

**Impacts:**
- All future AIPIM development (will follow AIPIM workflow)
- Template improvements (will be informed by dogfooding)
- Documentation (will include authentic examples)
- Community trust (demonstrates product confidence)

## References

- [Eating your own dog food (Wikipedia)](https://en.wikipedia.org/wiki/Eating_your_own_dog_food)
- AIPIM basic usage docs: `docs/basic-usage.md`
- DelphiChess project (real-world AIPIM usage that validated approach)
- Session transcript where enhancement tasks were identified (2026-01-18)

## Approval

**Decided by:** Rafhael (with Claude's recommendation)
**Date:** 2026-01-18
**Status:** ✅ Approved

**Notable Quote:**
> "We should use the AIPIM inside the AIPIM project to create the next tasks in the backlog" - User (2026-01-18)
>
> Response: "Excellent meta idea! 🤯"

---

**Version:** 1.0
**Last Updated:** 2026-01-18
**Next Review:** 2026-07-18

**Meta Note:** This ADR was created following the ADR auto-detection protocol from the enhanced GEMINI.md/CLAUDE.md guidelines. The irony of creating an ADR about using AIPIM while simultaneously validating AIPIM's ADR workflow is not lost on us. 🎭
