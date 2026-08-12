---
name: aipim-discovery
description: Use ONLY when the user explicitly asks to brainstorm, explore an idea, or plan something out — for example "let's brainstorm", "vamos pensar sobre", "/discovery", or when they ask to resume an open discovery session. Never invoke this on your own initiative during other work.
---

# AIPIM Discovery

Turn an idea into tasks, dependencies and decisions the project actually records —
grounded in what the project already contains.

## When this runs

Only when the user asks for it. A user describing a feature they want built is **not**
asking to brainstorm; that is ordinary work. Wait to be asked.

If `get_project_context` reports an open discovery, you may mention it. Do not enter it
unless the user says so.

## The loop

### 1. Ground before you ask anything

Call `get_project_context`, then `find_related` with the user's idea in their own words.

This is not optional and it is not a formality. It is what separates this from a generic
brainstorm: it tells you whether the idea already exists as a task, contradicts a decision
already made, or belongs as a dependency of something in flight.

An empty project matches nothing. That is fine — the conversation simply moves from
reconciling to inventing.

### 2. Open the session

`start_discovery` with a one-line topic. If it reports other open sessions on a related
topic, offer to resume that one instead.

### 3. Ask one question at a time

One question per message. Prefer concrete options over open prompts.

**Always make skipping available.** Say so plainly: the user can skip any question.

### 4. When the user skips, record an assumption — never decide silently

A skipped question becomes an entry in `assumptions`:

```
{ question: "which database?", assumed: "Postgres, matching the rest of the project", critical: false }
```

Mark it `critical: true` when being wrong there would invalidate the work.

This is the whole point of allowing skips: the user pays no interrogation tax, and nothing
gets decided behind their back. Open assumptions land in the generated record and are the
agenda if the session is ever resumed.

### 5. Write the state after every turn that moved your understanding

`update_discovery_state` with the **complete** state — it is stored as a snapshot, not a
delta. Fill in:

- `problem` — what hurts, in short prose
- `agreements` — what is settled, and why
- `alternatives` — what was considered and dropped, **and the reason**. Six months from now
  this is the half of the ADR that would otherwise be lost.
- `assumptions` — skipped questions and the premise you adopted
- `grounding` — what `find_related` surfaced, with how it relates
- `openThreads` — what you still intend to ask

### 6. Converge into a changeset

When `openThreads` is empty, or the user says to go ahead, call `propose_changeset` with:

- `tasks` — each with a `localId` (`#1`, `#2`), title, type, priority, and an estimate
- `dependencies` — edges. Either end may be a local ref (`#1`) or an existing ID (`TASK-035`)
- `decisions` — ADRs worth recording, with `supersedes` when one replaces an older decision
- `docs` — files to write, if any

Break anything over 12 hours into phases of 2–6 hours, wired as dependencies.

Proposing does not apply anything. It returns a validation report — read it.

### 7. Show the user a readable diff, then wait

Present the proposal as prose and lists, **never as raw JSON**: tasks with estimates, what
depends on what, the decisions, and — separately and visibly — the open assumptions.

Then stop and ask for approval. Do not apply anything the user has not approved out loud.

### 8. Resolve

- `resolve_changeset` with `applied` — creates everything as one atomic batch
- with `revision_requested` — reopens the session so you can rework the proposal
- with `abandoned` — closes it, changing nothing

If the consensus gate rejects the application, it tells you what is missing. Fix it rather
than reaching for `force`. Using `force` is recorded in the event log as a bypass.

## Resuming

`get_discovery_state` returns everything needed to pick up a session with no chat history:
the distilled state, the version, and the current proposal if there is one.

Start by reading back where things stand and which assumptions are still open. Then continue
the loop from step 3.
