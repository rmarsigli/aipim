# Architecture Decision Records (ADR) Guide

ADRs are lightweight documents that capture significant architectural decisions, their context, and their consequences. They serve as a "log" of design choices.

## When to Create an ADR

Create an ADR when a decision involves a significant trade-off or change in architectural direction.

**Triggers (Automatic Detection):**
- **Technology Choice:** Choosing a library, database, or framework (e.g., "Postgres vs Mongo").
- **Schema Design:** Significant database structure changes.
- **API Architecture:** Defining new API patterns or protocols.
- **Security:** Implementing auth strategies or security controls.
- **Refactoring:** Applying major design patterns (Strategy, Factory, etc.).

## How to Create an ADR

1.  **Copy the template:**
    ```bash
    cp .project/_templates/adr.md .project/decisions/$(date +%Y-%m-%d)-my-decision.md
    ```

2.  **Fill in the sections:**
    - **Context:** What is the problem? What are the constraints?
    - **Decision:** What did we choose?
    - **Rationale:** Why is this the best fit?
    - **Alternatives:** What else did we consider and why did we reject it?
    - **Consequences:** What are the pros/cons (tech debt, complexity, etc.)?

3.  **Review status:** Mark as `Proposed` initially, then `Accepted` after team agreement.

## Naming Convention

`YYYY-MM-DD-short-title.md`

Example: `2026-01-18-use-postgresql-jsonb.md`

## ADR Status Lifecycle

- **Proposed:** Draft stage, open for discussion.
- **Accepted:** Approved and active.
- **Deprecated:** No longer the preferred approach (but still present).
- **Superseded:** Replaced by a newer ADR (reference the new one).

## Best Practices

- **Keep it immutable:** Once accepted, don't change the decision rationale. Create a new ADR to supersede it if things change.
- **Be honest about cons:** Every decision has trade-offs. Documenting them prevents "why did we do this?" questions later.
- **Link related ADRs:** Use "Supersedes ADR-XXX" or "relates to ADR-YYY".
