# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
