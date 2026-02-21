---
number: 009
title: "Rewrite AIPIM as an Event-Sourced MCP Server (v2.0)"
date: 2026-02-21
status: accepted
authors: [Claude, Rafhael]
review_date: 2026-08-21
tags: [architecture, mcp, event-sourcing, sqlite, breaking-change]
---

# ADR-009: Rewrite AIPIM as an Event-Sourced MCP Server (v2.0)

## Status

**Accepted** ✅

Date: 2026-02-21
Supersedes: ADR-002 (Session Starter Architecture)

---

## Context

### Background

AIPIM v1.0 was released on 2026-01-07. Its core premise was sound: give AI coding assistants persistent, structured context for project management. However, the implementation relied on a **clipboard-based session workflow** that proved to be fundamentally incompatible with how modern AI tooling actually works.

### How v1 Worked (and Why It Broke)

The v1 architecture was built around three commands: `aipim start`, `aipim pause`, and `aipim resume`. The workflow was:

1. Developer runs `aipim start` → generates a large prompt string summarizing `context.md`, `current-task.md`, and recent git history
2. Prompt is **copied to the OS clipboard** via `clipboardy`
3. Developer manually **pastes** the prompt into Claude/ChatGPT/Gemini chat
4. AI responds with work
5. Developer runs `aipim pause --reason="..."` to stash changes and serialize session state back to `context.md`
6. Next session: `aipim resume` reconstructs the prompt, copies to clipboard again

The `resume.ts` module alone was **377 lines** mixing git operations, file parsing, markdown formatting, and clipboard I/O — a clear sign of excessive accidental complexity.

### The Structural Problems

#### 1. The AI Tool Landscape Shifted

When v1 was designed, clipboard injection was the only viable integration point for web-based AI chat. But the MCP (Model Context Protocol) spec was already gaining adoption in Claude Code and other agentic tools. By the time v1.3 shipped (2026-01-25), the clipboard approach was already anachronistic: Claude Code can connect to arbitrary HTTP servers and call their tools directly. Pasting context manually was unnecessary friction.

#### 2. Markdown Files as Source of Truth Are Inherently Racy

v1 stored all state in `.project/` markdown files (`context.md`, `current-task.md`, `backlog/*.md`). These files are:

- **Not atomic**: concurrent writes (two agents, or an agent + human) produce merge conflicts
- **Not queryable**: finding "all P1 tasks assigned to Alice" requires parsing every `.md` file in `backlog/`
- **Not auditable**: overwriting a file loses its history. When did this task go from `in-progress` to `blocked`? Unknown.
- **Not consistent**: `context.md` contained a manually updated summary of state that could drift from the actual files

The v1.3.0 quality report (2026-01-25) identified `resume.ts` as a 377-line god function responsible for parsing, diffing, and synchronizing this state. The complexity was a symptom of the underlying data model.

#### 3. Test Coverage Collapse

Between v1.0 and v1.3, test coverage dropped from ~86% to **54.28% statements / 45.34% branches**. The clipboard/resume path was nearly untestable: it had side effects on the OS clipboard, required a git repository in a specific state, and parsed multi-format markdown with ad-hoc regex. The code quality score regressed from 86.1 to 81.0.

#### 4. The Single-Agent Assumption

v1 assumed one human, one AI, one active session. The `current-task.md` file was a mutex. This made team workflows impossible: two developers could not have concurrent active tasks without file conflicts.

#### 5. The Context Window Tax

Every session started by re-reading and re-pasting the same large prompt. As `context.md` grew (it had a mandatory pruning protocol at 200 lines precisely because of this), the cost of context restoration increased linearly. The protocol required manual archiving every 10 sessions.

---

## Decision

**We will rewrite AIPIM 2.0 as a persistent HTTP server implementing the MCP protocol, backed by an event-sourced log and a SQLite derived state layer.**

The core architecture shifts from:
> *Markdown files → clipboard → AI chat → paste back*

To:
> *Append-only event log → SQLite projection → MCP tools → Claude Code calls tools directly*

### Architectural Pillars

#### Pillar 1: Event Sourcing via `events.jsonl`

All state mutations are expressed as **immutable, append-only events**:

```jsonl
{"type":"task.created","taskId":"TASK-007","title":"...","timestamp":"...","actor":"alice"}
{"type":"task.status_changed","taskId":"TASK-007","from":"backlog","to":"in-progress","timestamp":"..."}
{"type":"task.completed","taskId":"TASK-007","actualHours":3.5,"timestamp":"..."}
```

12 event types cover the full task lifecycle. Events are never modified or deleted.

**Why this matters:**
- Complete audit trail: every state change is timestamped and attributed
- Merge-safe: `.gitattributes` configures `merge=union` for `events.jsonl`, so concurrent team pushes append rather than conflict
- Replayable: the entire project state can be reconstructed from scratch at any point in time
- Testable: tests can construct precise state by injecting specific event sequences

#### Pillar 2: SQLite as Derived State

SQLite is rebuilt from `events.jsonl` on every server boot via `rebuild()`. During runtime, new events are applied incrementally via `applyEvent()`. The DB is never the source of truth — it is always a projection.

**Why SQLite over in-memory:**
- Survives server restarts without full replay on large histories
- Enables SQL queries (`ORDER BY priority`, `WHERE status = 'blocked' AND updated_at < ?`)
- Zero infrastructure: SQLite is a single file, no separate process

**Why not Postgres/MySQL:**
- AIPIM is a local developer tool, not a hosted service
- Zero-setup is a core product requirement
- SQLite handles the expected load (hundreds of tasks, single developer or small team) with microsecond query times

#### Pillar 3: MCP Server (JSON-RPC 2.0 over HTTP)

A Hono server on port 3141 exposes a `POST /mcp` endpoint implementing the MCP spec. Claude Code connects to it once (`claude mcp add --transport http aipim http://localhost:3141/mcp`) and can then call 11 tools directly from any conversation, without any clipboard interaction:

```
get_project_context   get_next_task    list_tasks
get_task              get_blockers     create_task
complete_task         update_task_status  add_comment
log_decision          assign_task
```

The session restoration problem is eliminated: Claude calls `get_project_context` and receives the current state as structured JSON. No prompt engineering, no clipboard, no paste.

#### Pillar 4: REST API + Svelte UI

The same Hono server exposes a REST API (`/api/*`) consumed by a Svelte 5 UI served at `/ui/*`. This provides a human-readable view of the project state — Kanban board, event timeline, task detail with inline editing — without requiring a separate process or external service.

---

## Alternatives Considered

### Alternative A: Patch v1 (Incremental Fixes)

The v1.3.0 quality report identified 31 fixable issues. We could have addressed them iteratively: refactor `resume.ts`, extract shared utilities, improve test coverage.

**Why rejected:**

The 31 issues were symptoms of the architectural problem, not the problem itself. Fixing `resume.ts` would still leave a clipboard-based workflow that cannot integrate with MCP. Improving test coverage on clipboard-dependent code requires mocking the OS clipboard. The fundamental coupling between "state serialized to markdown" and "context delivered via paste" cannot be untangled with refactors — it requires replacing both the storage model and the delivery mechanism.

Estimated effort to patch v1 to MCP parity: 6-8 weeks. Estimated effort to rewrite: 2 weeks (actual: 10 days). The rewrite was faster because the v2 architecture is simpler.

### Alternative B: Use a Database from the Start (Skip Event Sourcing)

Write directly to SQLite, skip the `events.jsonl` layer.

**Why rejected:**

Without an event log, we lose the audit trail and the ability to replay state. More critically, we lose the merge-safe team workflow: two developers committing SQLite binary files to git will always conflict. `events.jsonl` with `merge=union` is the only mechanism that makes concurrent team usage viable without a central server.

The event log also provides the raw material for the event timeline UI — a feature that would be impossible to reconstruct from a mutable database.

### Alternative C: Use an Existing Project Management MCP Server

Several MCP servers for Linear, GitHub Issues, and Notion exist.

**Why rejected:**

These require external accounts, internet connectivity, and ongoing service costs. AIPIM's value proposition is **local-first, zero-infrastructure** project management. A dependency on Linear's API introduces availability risk, rate limits, and data sovereignty concerns for commercial codebases. More fundamentally, none of these tools integrate with the `.project/` markdown convention that AIPIM uses for AI-readable context.

### Alternative D: Keep Clipboard, Add MCP as Optional Layer

Add an MCP server while keeping `start`/`pause`/`resume` for users on non-MCP tools (ChatGPT, Gemini).

**Why rejected:**

Maintaining two delivery mechanisms (clipboard + MCP) doubles the surface area and ensures neither is first-class. The clipboard workflow requires `clipboardy` (a native dependency with platform-specific binaries), `diff`, and a complex `resume.ts` that reads and parses multiple file formats. These 378 lines and two native dependencies were deleted entirely in the 2.0 migration commit. Supporting clipboard alongside MCP would have prevented this simplification.

The correct approach for non-MCP tools is to expose `get_project_context` as a REST endpoint that can be curled and pasted manually — simpler than a dedicated clipboard command, and composable with any workflow.

---

## Consequences

### Positive

- **Eliminated the context restoration problem**: Claude calls `get_project_context` in < 50ms. Zero manual steps.
- **Team workflows now viable**: `events.jsonl` with union merge supports concurrent pushes without conflicts.
- **Full audit trail**: every task state change is timestamped, attributed, and queryable.
- **Testability**: event-sourced tests construct precise state via event injection. The 83 tests passing at migration commit require no clipboard mocking.
- **Bundle size**: removing `clipboardy` and `diff` reduced the dependency footprint significantly.
- **UI as a first-class feature**: the REST API enables a Svelte UI (Kanban, timeline, task detail) served by the same process, with no additional infrastructure.

### Negative / Trade-offs

- **Breaking change**: `aipim start`, `aipim pause`, `aipim resume` are removed. Users on v1 must migrate.
- **Migration required**: v1 markdown files must be processed by `aipim migrate` to generate `events.jsonl`. The migrator is idempotent and safe to re-run, but it adds a one-time setup step.
- **Server must be running**: unlike v1 (which was a stateless CLI), v2 requires `aipim ui` (or `aipim mcp start`) to be running for Claude Code to access tools. This is a process lifecycle concern.
- **Non-MCP AI tools lose the workflow**: users of ChatGPT or Gemini no longer have a `aipim start` command. Workaround: `curl http://localhost:3141/api/tasks` and paste the JSON, or expose a `/api/context` endpoint in a future version.

### Migration Path

Existing v1 projects: run `aipim migrate` once. The migrator reads `backlog/*.md` and `completed/*.md`, synthesizes `task.created` and `task.completed` events, and writes `events.jsonl`. Subsequent `aipim ui` starts will rebuild SQLite from this log. The `.project/` markdown files are preserved and continue to serve as human-readable task documentation.

---

## Implementation Notes

The rewrite was completed in 10 working days across 15 commits (2026-02-20), including:

- Core event system (`src/core/events.ts`)
- SQLite projection (`src/core/db.ts`)
- 1.x migration (`src/core/migrator.ts`)
- MCP server + 11 tools (`src/mcp/`)
- REST API (`src/mcp/api.ts`)
- Svelte 5 UI: Kanban, Timeline, Task Detail (`ui/`)
- Team identity resolution + `config.toml` (`src/core/team.ts`)

The final bundle is **55 KB** (CLI) + **37 KB gzipped** (UI), well within the 100 KB threshold established as a prerequisite for any monorepo split consideration.

---

## References

- `CHANGELOG.md` — v2.0.0-alpha release notes (full feature list)
- `.project/reports/code-quality-analysis-2026-01-25.md` — v1.3.0 quality analysis that identified architectural limits
- ADR-002 — Session Starter Architecture (superseded by this decision)
- MCP specification: https://modelcontextprotocol.io/spec/2024-11-05
- Hono framework: https://hono.dev
- `src/core/migrator.ts` — 1.x → 2.0 migration implementation
