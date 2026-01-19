---
title: "Improve Documentation Structure"
created: 2026-01-19T00:55:00-03:00
priority: P3
estimated_hours: 2
status: in-progress
tags: [docs, refactor]
related_files: [src/templates/base/.project/docs/]
---

# Task: Improve Documentation Structure (T015)

## Objective
Refactor documentation to separate concerns:
- **CLI Reference:** Detailed command manual.
- **Advanced Usage:** Power-user workflows (scripts, pain-driven, etc.).
- **Troubleshooting:** Common issues and solutions.
- **Basic Usage:** Simplified "Getting Started" guide.

## Implementation

### Phase 1: Create New Docs (1h)
- [x] Create `src/templates/base/.project/docs/cli-reference.md`
  - [x] Document `start`, `resume`, `pause`
  - [x] Document `deps`, `install`, `update`
- [x] Create `src/templates/base/.project/docs/advanced-usage.md`
  - [x] Document `task-velocity.sh`
  - [x] Document `pain-to-tasks.sh`
  - [x] Document `analyze-quality.sh`
  - [x] Document Feature-First pattern
- [x] Create `src/templates/base/.project/docs/troubleshooting.md`
  - [x] Git conflicts during resume
  - [x] Dependency cycles in `deps`
  - [x] Script permission errors

### Phase 2: Refactor Basic Usage (0.5h)
- [x] Simplify `src/templates/base/.project/docs/basic-usage.md`
  - [x] Remove detailed command flags
  - [x] Link to new docs
  - [x] Focus on the "Happy Path" (Start -> Work -> Finish)

### Phase 3: Update Index/References (0.5h)
- [x] Update `README.md` (if applicable) or project manager references to point to new docs.

## Definition of Done
- [x] All 4 doc files exist and are well-structured
- [x] `basic-usage.md` is concise
- [x] All CLI commands documented
- [x] All helper scripts documented
