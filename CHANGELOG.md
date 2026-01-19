# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
