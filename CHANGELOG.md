# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-alpha] - 2026-02-20

Complete architectural rewrite. The clipboard/copy-paste session workflow is replaced by a persistent MCP server that Claude Code connects to directly.

### Breaking Changes

- `aipim start`, `aipim resume`, `aipim pause` removed — replaced by the MCP server.
- Session prompts and clipboard workflow removed entirely.
- `.project/` markdown files are no longer the source of truth — `events.jsonl` is.

### Added

**Event-sourced core (`src/core/events.ts`)**
- Append-only `events.jsonl` log — 12 event types covering the full task lifecycle.
- `appendEvent()` auto-assigns `id`, `timestamp`, `actor` (resolved from `AIPIM_USER` env, git email, or team config).
- `readEvents()`, `readEventsForTask()`.
- `.gitattributes` configured with `merge=union` so concurrent team pushes never conflict.

**SQLite derived state (`src/core/db.ts`)**
- `rebuild()` drops and recreates all tables from `events.jsonl` — fully idempotent.
- `applyEvent()` for incremental updates (append → apply, never write DB directly).
- Tables: `tasks`, `comments`, `decisions`, `events_log`.
- Query helpers: `queryTasks()`, `getNextTask()`, `getTask()`, `getBlockers()`, `getStats()`, `getCommentsForTask()`, `getDecisions()`.

**Migration from 1.x (`src/core/migrator.ts`)**
- `migrate()` reads `backlog/*.md` and `completed/*.md`, synthesizes events into `events.jsonl`.
- Idempotent — skips already-migrated tasks. Run once, safe to re-run.
- `aipim migrate [--project <path>]`

**MCP server (`src/mcp/server.ts`)**
- Hono HTTP server on port 3141 (configurable).
- Boot sequence: migrate → rebuild SQLite → serve.
- `POST /mcp` — JSON-RPC 2.0 endpoint for Claude Code.
- Supports: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`.
- `aipim mcp start [--port 3141] [--project <path>]`

**MCP read tools (`src/mcp/tools/read.ts`)**
- `get_project_context` — project name, stats, active blockers, recent decisions.
- `get_next_task` — highest-priority backlog task.
- `list_tasks` — all tasks with optional `status`/`assignee`/`priority` filter.
- `get_task` — single task with comments.
- `get_blockers` — all tasks with status `blocked`.

**MCP write tools (`src/mcp/tools/write.ts`)**
- `create_task` — adds task to backlog, writes `.md` file, appends event.
- `complete_task` — marks done, moves `.md` to `completed/`, appends event.
- `update_task_status` — changes status with optional reason comment.
- `assign_task` — assigns to a team member from `config.toml`.
- `add_comment` — appends immutable comment.
- `log_decision` — writes ADR `.md` to `decisions/`, appends event.

**REST API (`src/mcp/api.ts`)**
- `GET /api/tasks` — task list with `status`, `assignee`, `priority` filters.
- `GET /api/tasks/:id` — task + markdown content + comments.
- `GET /api/tasks/:id/events` — events related to a specific task.
- `PUT /api/tasks/:id/content` — overwrite the task's `.md` file (used by UI editor).
- `POST /api/events` — write any event directly.
- `GET /api/events` — paginated history (`limit` max 500, `offset`).
- `GET /api/events/stream` — SSE real-time feed with 30s keep-alive ping.
- `GET /api/stats` — task counts by status.
- `GET /api/team` — team members from `config.toml`.
- `GET /api/decisions` — all ADRs.
- `GET /ui/*` — Svelte UI static files served by Hono (`serveStatic` + SPA fallback).
- CORS restricted to `localhost` / `127.0.0.1`.

**Svelte UI (`ui/`)**
- Stack: Svelte 5 (runes), Vite 6, Tailwind CSS v4, `marked` for markdown rendering.
- `aipim ui [--port 3141] [--no-open] [--dev]` — starts server and opens browser.
  - Production: Hono serves `ui/dist/` at `/ui/*` with SPA fallback.
  - Dev mode: Vite dev server on `:5173`, proxying `/api` to Hono.
- **Dashboard** (`/ui/`) — stats cards (total, in-progress, backlog, blocked, done) + in-progress task grid.
- **Kanban board** (`/ui/kanban`) — 5 columns (Backlog, In Progress, Review, Done, Blocked); HTML5 drag-and-drop (no library); drop emits `task.status_changed` via `POST /api/events`; optimistic update + revert on failure; blocked column shows days blocked.
- **Event timeline** (`/ui/timeline`) — chronological event log grouped by day; filters by type, actor, and period (7/30/90 days/all); rich per-type descriptions; SSE live updates prepend new events without reload.
- **Task detail** (`/ui/task/:id`) — markdown rendered with `marked`; inline editor (textarea + save button); `PUT /api/tasks/:id/content` + `task.content_updated` event on save; comment thread with submit (Ctrl+Enter); event history via `GET /api/tasks/:id/events`.
- Shared components: `TaskCard` (priority-colored left border, draggable), `Column`, `StatusBadge`, `PriorityBadge`.
- SSE client (`ui/src/lib/sse.ts`) — EventSource wrapper with 3s auto-reconnect.
- API client (`ui/src/lib/api.ts`) — typed fetch wrappers for all REST endpoints.
- Bundle: ~37 KB gzipped (well under 100 KB).

**Team configuration (`src/core/team.ts`)**
- `.project/config.toml` — project name + team members (`id`, `name`, `email`, `role`, `areas`).
- `resolveActor()` — `AIPIM_USER` env → git email matched to member id → raw email → `"unknown"`.
- `loadConfig()`, `getMember()`, `addTeamMember()`.
- `aipim team list` — list members.
- `aipim team whoami` — show resolved actor.
- `aipim team add` — interactive wizard.
- `aipim team setup-git` — configure `.gitattributes` union merge (idempotent).

**Task priority fix**
- `aipim task next` now sorts by real priority (`P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3`), oldest first on tie — previously sorted by filename.
- `resolveNextTask()` extracted as a pure exportable function.

### Changed

- `appendEvent()` now calls `resolveActor(projectRoot)` for actor resolution, replacing the local `getActor()` function. Actors are resolved against `config.toml` team members when available.
- `aipim install` now calls `setupGitAttributes()` to configure `.gitattributes` automatically.
- `aipim mcp start` logs both the MCP endpoint and the REST API base URL on boot.

### Documentation

- README rewritten for 2.0 (architecture diagram, MCP quick start, all commands, MCP tools table).
- `docs/cli-reference.md` — updated to reflect actual commands, removed 1.x commands.
- `docs/basic-usage.md` — MCP-first workflow.
- `docs/quick-start.md` — rewritten for 2.0.
- `docs/advanced-usage.md` — multiple projects, DB rebuild, REST API examples, team collaboration.
- `docs/troubleshooting.md` — 2.0-specific issues.
- Removed `docs/about-tokens-usage.md` and `docs/cursor-integration.md` (obsolete).

---

## [1.3.0] - 2026-01-25
### Added
- **Cursor IDE Support**: Full integration with CURSOR.md and .cursorrules.
  - Native Cursor rules file with automatic detection
  - Chat-compatible prompt file (1039 lines)
  - Multi-file editing and Code Actions guidance
  - Hybrid approach: both chat-compatible and native integration
  - Added 'cursor' to AI tools list
- **Task Workflow Command**: New `aipim task next` command.
  - Generates prompts for next backlog task automatically
  - Embedded mandatory instructions (eliminates manual repetition)
  - Context awareness and session integrity guidelines
  - Includes Task Workflow Protocol in all AI prompts
- **Rust Production Guidelines**: Comprehensive Rust guideline (381 lines).
  - Zero-cost abstractions and production-ready patterns
  - Strict linting rules (deny unwrap/expect/panic in production)
  - Tokio async runtime, error handling with Result<T,E>
  - Framework auto-detection via Cargo.toml/Cargo.lock
  - Type-safe domain modeling with newtypes
  - Comprehensive testing (unit, integration, property-based)

### Changed
- **Templates**: Renamed template files removing -template suffix for cleaner structure.
- **Documentation**: Added complete Cursor Integration Guide with screenshots.

## [1.2.0] - 2026-01-19
### Added
- **Template System**: New `aipim template` command for managing prompt templates.
  - Access core templates: `stuck`, `review`, `summary`, `optimize`, `explain`
  - Create custom templates: `aipim template add <name>`
  - Edit custom templates: `aipim template <name> --edit`
  - List available templates: `aipim template --list`
  - Dynamic variable injection (task context, git info, session data)
  - Output options: clipboard (default), `--print` for terminal
- **Task Management**: Enhanced task lifecycle with `aipim task init <type> <name>`.
  - Auto-incrementing task IDs (TASK-001, TASK-002, etc.)
  - Structured task files with Context, Objective, and Verification sections
  - File signature protection for integrity
  - Automatic backlog registration
- **Dependency Visualization**: New `aipim deps` command.
  - Visual task dependency graphs
  - Circular dependency detection with warnings
  - Task grouping by status (blocked, in-progress, backlog, completed)
- **Session Management**: New `aipim pause --reason "<reason>"` command.
  - Captures current session state and task context
  - Optional git stashing for uncommitted changes
  - Creates interruption snapshots for resumption
- **Session Starter**: Enhanced `aipim start` command.
  - Generate comprehensive session prompts with project context
  - Options: `--print`, `--file <path>`, `--full`, `--verbose`
  - Clipboard integration by default
  - Includes git status, recent commits, and task progress
- **Core Utilities**: New utility modules for improved functionality.
  - Template engine with dynamic variable rendering
  - Dependency graph builder with cycle detection
  - Path validation for security
  - Enhanced clipboard integration

### Changed
- **Task Manager**: Full rewrite with auto-ID generation and signature-based protection.
- **Context Parsing**: Improved utilities for parsing context and task files.

### Fixed
- Path traversal vulnerabilities with new validation layer.
- Template rendering edge cases with better error handling.

## [1.1.3] - 2026-01-19
### Added
- **Commands**: New `deps`, `pause`, and `resume` commands for improved workflow management.
- **Documentation**: Comprehensive guides for CLI Reference, Advanced Usage, and Troubleshooting.
- **Scripts**: `task-velocity.sh` for tracking progress velocity.

### Changed
- **Architecture**: Extracted parsing utilities to centralized `src/utils/context.ts` module (T020).
- **UX**: Improved session resumption workflow with `resume` command.

### Fixed
- **Naming**: Corrected binary name and references from `aipm` to `aipim` throughout the codebase (T016, T017).
- **Linting**: Resolved all linting errors in CLI commands and utilities.

### Removed
- **Redundancy**: Removed non-functional `diff` command in favor of `update --dry-run` (T019).

## [1.1.2] - 2026-01-07
### Added
- **Documentation**: New `docs/basic-usage.md` guide covering core concepts, "Junior Dev" mindset, and advanced CLI features.
- **Onboarding Link**: Installer now links directly to the basic usage guide.

### Changed
- **UI Polish**: Removed all emojis from CLI output and prompts for a cleaner "Hacker" aesthetic.
- **Prompts**: Migrated to `@inquirer/prompts` to customize symbols (no `?`, using `-` for cursor/prefix).

### Fixed
- **CLI Exit Code**: Fixed `pnpm start` (no args) exiting with code `1`. Now shows help and exits with `0`.
- **Linting**: Resolved all remaining TypeScript and Prettier issues.

## [1.1.1] - 2026-01-07
### Changed
- **Documentation**: Polished `README.md` with new "Cognitive Architecture" and "Task Lifecycle" sections to better explain the "Why" and "How" of AIPIM.
- **Security**: Enabled NPM Provenance signing for Trusted Publishing.

## [1.1.0] - 2026-01-07
### Added
- **Framework Guidelines System**: Auto-detects project framework (`react`, `next`, `vue`, `astro`, `node`) and configures AI prompts with strict, best-practice guidelines.
- **CLI Options**: Added `--guidelines <name>` to manually specify frameworks during install/update.
- **Safe Operational Cycle**: Implemented `SignatureManager` and transactional updates to protect user modifications. Files are now hashed and only safely updated if pristine.
- **E2E Testing**: Comprehensive end-to-end test suite (`pnpm test:e2e`) verifying real-world usage.
- **Developer Experience**: Added `pnpm start` for local development.

### Fixed
- **Unit Tests**: Full pass on `installer.test.ts` (mocking issues resolved) and `updater.test.ts`.
- **Test Noise**: Suppressed expected warnings during test runs for cleaner output.

## [1.0.5] - 2026-01-07
### Changed
- **Packaging**: Switched from `.npmignore` (denylist) to `files` in `package.json` (allowlist) for more secure and predictable artifact publishing.

## [1.0.4] - 2026-01-07
### Fixed
- **Windows CI**: Conditional test logic to skip executable bit checks on Windows filesystems.

## [1.0.3] - 2026-01-07
### Fixed
- **CI/CD**: Synced `pnpm-lock.yaml` with `package.json` to resolve frozen lockfile error.

## [1.0.2] - 2026-01-07
### Fixed
- **Cross-Platform CI**: Added `cross-env` to fix `test` script on Windows.
- **Line Endings**: Enforced LF via `.gitattributes` and `.prettierrc` to prevent linting errors on Windows.

## [1.0.1] - 2026-01-07
### Fixed
- Resolved CI build issue by removing build artifacts from Git.
- Addressed NPM versioning conflict.

## [1.0.0] - 2026-01-07
### Official Release
- **Production Ready**: Full transition to Native ESM.
- **Features**:
  - `install` command with interactive prompts and dry-run mode.
  - `update` command for upgrading configurations.
  - `completion` command for shell autocompletion.
  - `validate` command linked to health checks.
  - `validate-dod.sh` supporting JS/TS, PHP, Python, and Go.
  - Multi-OS CI/CD support (Ubuntu, Windows, macOS).
- **Guidelines**: Standardized templates for React, Astro, Next.js, and Vue.
- **Testing**: 100% pass rate on unit tests and comprehensive lab scenarios.

### Changed
- Refactored codebase to remove `any` types and improve type safety.
- Renamed package to `@rmarsigli/aipm`.
- Improved installation prompts and logic.

### Fixed
- Version import issues (`resolveJsonModule`).
- Linting and code style issues.

## [1.0.1-beta.1] - 2026-01-07
### Added
- Initial beta release with scoped package name.
