---
number: 004
title: "Standardize File Naming Conventions"
date: 2026-01-19
status: accepted
authors: [AIPIM Team]
tags: [standards, organization, knowledge-management]
---

# ADR-004: Standardize File Naming Conventions

## Status

**Accepted**

Date: 2026-01-19

## Context

**The Problem:**
Our file naming conventions were inconsistent (`TASK-XXX` vs `YYYY-MM-DD`), making it difficult to sort files chronologically in archives while maintaining ID traceability. The `TASK-XXX` format was also verbose.

**Context & Constraints:**
- **Navigation:** Archived files (`completed/`, `decisions/`) should sort by date.
- **Traceability:** All files must retain their unique ID (`T001`, `ADR001`) for reference.
- **Brevity:** Shorter IDs (`T001`) are easier to type than long ones (`TASK-001`).

## Decision

**We will adopt the following naming conventions:**

| Type | Directory | Format | Example |
|------|-----------|--------|---------|
| **Backlog** | `backlog/` | `T{XXX}-{name}.md` | `T001-setup.md` |
| **Completed** | `completed/` | `{YYYY-MM-DD}-T{XXX}-{name}.md` | `2026-01-18-T001-setup.md` |
| **Decisions** | `decisions/` | `{YYYY-MM-DD}-ADR{XXX}-{name}.md` | `2026-01-18-ADR001-tech-stack.md` |
| **Ideas** | `ideas/` | `I{XXX}-{name}.md` | `I001-marketing.md` |
| **Reports** | `reports/` | `{YYYY-MM-DD}-R{XXX}-{name}.md` | `2026-01-18-R001-health.md` |

**Rationale:**
1.  **Chronological Sorting:** Date prefix in archive folders ensures history is linear.
2.  **ID Persistence:** IDs allow cross-referencing (e.g., git commits referencing `T001`).
3.  **Visual Scanning:** `T`, `ADR`, `I`, `R` prefixes provide instant type recognition.

## Consequences

### Positive
- [x] "Time travel" view of the project in file explorer.
- [x] Clearer distinction between active (no date) and archived (dated) files.
- [x] Consistent shorthand for all artifacts.

### Negative
- [ ] Renaming files breaks old hyperlinks (mitigated by bulk rename).
