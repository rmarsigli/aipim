---
title: "Turn the event log into a control mechanism (loop & graph engineering)"
date: 2026-08-12
status: Accepted
---

# ADR010 — Turn the event log into a control mechanism

## Context

AIPIM 2.x is a well-built **system of record**: an append-only `events.jsonl`, a SQLite read
model rebuilt from it, an MCP server, a REST API and a Svelte UI. Every write goes through
`appendEvent() → applyEvent()`.

What it was not, was a **system of control**. The process that makes an agent work well lived
entirely in ~21KB of prose in `CLAUDE.md` — "MANDATORY: quality gates", "MANDATORY: break down
tasks >12h", "MANDATORY: update metrics" — and nothing in the codebase verified any of it.
`validate-dod.sh` was scaffolded by the installer and never called. `complete_task` marked a
task done without asking whether anything passed.

Two adjacent gaps made this concrete:

1. **The verification step of the loop was missing.** The agent loop is gather → act →
   **verify** → repeat. AIPIM owned the completion transition — the only choke point that
   matters — and let it through unconditionally.
2. **The graph existed only in the type system.** `task.dependency_added` and
   `task.dependency_removed` were declared event types that `applyEvent` dropped through
   `default: break`. There was no dependencies table, no MCP tool to create or read an edge,
   and `getNextTask` ordered purely by priority — so it could hand an agent a task blocked by
   unfinished work. Meanwhile `src/utils/dependencies.ts` reimplemented a parallel graph by
   parsing markdown frontmatter with a hand-rolled parser and fuzzy ID matching
   (`key.includes(id)`, which matches `TASK-1` against `TASK-10`).

## Decision

### 1. A verification gate over evidence events

A new `check.run` event records that a command ran against a task: command, exit code, pass/fail,
duration, and a truncated output tail. `verify_task` runs the commands declared in
`[checks] commands` and records one event per command.

`complete_task` is rejected unless every required command has a passing run **after the task's
last non-check event**. Freshness is relative to the work, not to wall-clock time: evidence that
predates the last change is stale, not valid. `check.run` events are excluded when computing
"last activity", otherwise recording evidence would invalidate itself.

With no `[checks]` configured the gate is a no-op, so existing projects are unaffected.

`force: true` bypasses the gate but writes `checksBypassed: true` into the completion event. The
escape hatch exists because docs-only tasks are real; making it auditable is what keeps it from
gutting the gate.

### 2. Dependencies as first-class read-model state

A `task_dependencies` table is fed by the dependency events. `core/graph.ts` derives, from tasks
plus edges: each node's forward and reverse edges, which dependencies are blocking it, the
**ready frontier** (unfinished tasks whose dependencies are all done, priority-ordered), the
blocked set, and any cycles.

`get_next_task` now returns from the ready frontier and never returns a blocked task; when
nothing is ready it says so and names what is blocking. `add_dependency` rejects an edge that
would close a loop, checked by reachability rather than a full cycle scan. A dependency on a
task that does not exist counts as blocking — an unknown prerequisite is not a satisfied one.

`src/utils/dependencies.ts` is deleted. The migrator converts legacy `depends_on:` frontmatter
into dependency events so 1.x projects keep their graph, dropping edges that point at tasks that
were never migrated.

### 3. Hooks instead of prose

`aipim install` (and `aipim hook install` for existing projects) registers Claude Code hooks in
`.claude/settings.json`:

- `SessionStart` → `aipim hook session-start` injects current state: task in progress, next ready
  task, blocked set, cycles, required checks.
- `Stop` → `aipim hook stop` checks that in-progress work has been verified.

Blocking on `Stop` is opt-in via `[hooks] block_on_unverified`. A hook that fights the user is
worse than one that does nothing. Merging into `settings.json` preserves user-authored hooks and
replaces AIPIM's own previous entries — marked with an `aipim-managed` tag — so re-running is
idempotent. A settings file that cannot be parsed is left untouched rather than overwritten.

## Consequences

**Positive**
- "Done" becomes a verifiable fact carrying evidence, instead of a claim.
- The agent is never handed work it cannot start; parallelisable work becomes visible.
- Rules that the harness can enforce stop consuming context on every session.
- One graph implementation instead of two that disagreed.

**Negative**
- `config.toml` grows two optional sections; the gate is invisible until configured.
- Check commands run with the same trust level as `package.json` scripts. This is not a sandbox
  boundary, and is documented as such.
- Hooks only apply to Claude Code. Gemini and Cursor users still rely on prose.

**Explicitly out of scope**
- AIPIM does not orchestrate the agent's loop — it is the persistent memory and governance layer
  around whichever loop is running. Becoming a LangGraph competitor is a rejected direction.
- AIPIM does not index code structure (symbols, call graphs). That category is crowded and the
  differentiator here is intent and provenance — why the code looks the way it does.

## Status

Accepted — implemented on `feature/loop-and-graph`.
