# Basic Usage

## Setup

```bash
npm install -g aipim
cd my-project
aipim install
aipim mcp start
claude mcp add aipim http://localhost:3141/mcp
```

That's it. Claude Code now calls AIPIM tools directly.

---

## Day-to-day workflow

### Starting a session

If you installed the Claude Code hooks, you do not have to ask for anything: the
`SessionStart` hook injects the current state — task in progress, next ready task, what is
blocked, which checks are required — before your first message.

Otherwise ask: _"What's the next task?"_ — it will call `get_next_task` and
`get_project_context`. `get_next_task` only ever returns work that can actually start; a
task waiting on an unfinished dependency is skipped, however high its priority.

Or check yourself:

```bash
aipim task next
```

### During a session

Claude Code writes all state via MCP tools:

- **Progress** → `update_task_status` (backlog → in-progress → review)
- **Notes/findings** → `add_comment`
- **Architecture choices** → `log_decision`
- **New work discovered** → `create_task`
- **This task waits on another** → `add_dependency`
- **Work finished** → `verify_task` (runs your checks, records the evidence)
- **Done** → `complete_task` (moves `.md` to `completed/`, appends event)

You never need to edit `events.jsonl` or the SQLite database manually.

### Making "done" mean something

By default `complete_task` takes the agent at its word. Declare what done requires and it
stops doing that:

```toml
# .project/config.toml
[checks]
commands = ["npm test", "npm run lint"]
```

Now `complete_task` is refused unless every command has a passing run recorded *after the
task last changed* — stale evidence does not count. `verify_task` runs them and records a
`check.run` event each, so the proof lives in the log next to everything else.

For a task where the checks genuinely do not apply, `complete_task` accepts `force: true`.
It completes, and writes `checksBypassed: true` into the event. Allowed, never invisible.

Leave `[checks]` out and nothing changes — the gate simply does not exist.

See [advanced-usage.md](advanced-usage.md) for dependencies, the ready frontier and hooks.

### Updating context.md

`.project/context.md` is for session state you want the AI to remember across conversations: current branch, active decisions, next action. Keep it short — it's loaded into context at session start.

### Modular Skills

As your project grows, you might integrate new tools like **Tailwind**, **Pest PHP**, or adopt **Strict TypeScript**. Instead of re-running the full installer, you can inject modular guidelines (Skills):

```bash
# See which skills are built-in
aipim list skills

# Inject Tailwind CSS guidelines into your active prompt context safely
aipim add skill tailwind
```
AIPIM will automatically recalculate file signatures and gracefully append the rules inside your `.md` files without destroying custom content. If you're on a Laravel Boost project, it elegantly scopes the skill to its own `.blade.php` file in `.ai/guidelines/`.

---

## Task files

Tasks live in `.project/backlog/YYYY-MM-DD-TASK-NNN-name.md`. Each has YAML frontmatter:

```yaml
---
title: "Feature Name"
created: 2025-01-07T10:00:00-03:00
priority: P1-M
estimated_hours: 4
status: backlog
tags: [backend]
---
```

Priority codes: `P1-S/M/L` (critical), `P2-S/M/L` (high), `P3` (nice-to-have), `P4` (maybe never).

---

## Team setup

If working solo, skip this.

1. Create or edit `.project/config.toml`:

```toml
[project]
name = "MyApp"

[[team]]
id = "alice"
name = "Alice Smith"
email = "alice@example.com"
role = "tech-lead"
```

2. Or use the wizard: `aipim team add`

3. Ensure `.gitattributes` is configured (done automatically by `aipim install`, or run `aipim team setup-git`).

With `config.toml` in place, events record the member id (e.g., `"alice"`) instead of a raw email. Claude Code can assign tasks via `assign_task`.

---

## Migration from 1.x

```bash
aipim migrate
```

Reads existing `backlog/*.md` and `completed/*.md`, synthesizes events, rebuilds SQLite. The original markdown files are preserved.

---

## Scripts

Helper scripts in `.project/scripts/` are still available for manual checks:

| Script | Purpose |
|--------|---------|
| `pre-session.sh` | Estimates token usage before a long session |
| `validate-dod.sh` | Checks Definition of Done (tests, lint, no debug code) |
| `task-velocity.sh` | Team velocity and completion estimates |
| `backlog-health.sh` | Flags stale or misconfigured tasks |
