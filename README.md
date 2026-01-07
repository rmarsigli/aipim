# AI Project Manager

> **Markdown-based project management system optimized for AI-assisted development**

Stop spending time re-explaining context to AI. This system creates a persistent memory layer that dramatically improves AI coding sessions while reducing token consumption.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green)]()

I began by using custom markdown files to manage my projects. It was incredibly effective for documenting decisions, sprints, and tasks. Over the last six months, this system has consistently saved me time and provided a persistent record of every project's evolution.

However, I realized I was spending too much time re-explaining context to AI, and manually creating these files became a bottleneck. I built this system to automate that process and streamline project management for myself—and now, for you.

Useful information:

- [About Tokens Usage](docs/about-tokens-usage.md)
- [Troubleshooting](docs/troubleshooting.md)

## Quick Start

### Installation

```bash
# Install to your existing project
npx @rmarsigli/aipm install
```

### Usage

1. First use:

> {talk about your project, more details = better AI experience. You can write in any language} - Now, create a .project/ folder with a README.md file following submitted guidelines.

2. Create a task:

> {talk about your task, more details = better AI experience} - Now, plan a task for me to start working on it.

## Features

### 🔒 Safe Update Strategy
Updates are now reliable and safe. `aipm update` automatically:
- **Scans** your project for changes.
- **Backs up** the `.project` directory before touching anything.
- **Preserves** your customizations (modified files are skipped).
- **Updates** only pristine files to the latest version.

### 🩺 Doctor (`validate`)
Ensure your project is healthy with `aipm check` (or `validate`). It checks:
- Directory structure integrity.
- Script permissions (smart cross-platform checks).
- File signature verification (detects legacy or tampered files).

### 📋 Task Automation
Stop copying templates manually. Use `aipm task init <type> <name>` to:
- Generate a new task file (`TASK-001-feature.md`) with the correct ID.
- Sign the file for future updates.
- Automatically append the task to your `backlog.md`.

## Structure

The system relies on a simple file structure in your project root:

```bash
.project/
├── current-task.md      # The one active task you are working on
├── context.md           # Persistent session memory and state
├── backlog/             # Future tasks
├── completed/           # Archive of finished tasks
├── decisions/           # Architecture Decision Records (ADRs)
└── scripts/             # Helper scripts (e.g. pre-session checks)
```

## Commands

| Script | description |
| :--- | :--- |
| `.project/scripts/pre-session.sh` | Estimates token usage for the current session. |
| `.project/scripts/validate-dod.sh` | validating Definition of Done (tests, lint, etc). |

## Development Scripts

These scripts are available in `package.json` for development usage:

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compiles the project using `tsup` (dist/). |
| `pnpm test` | Runs unit tests (`src/tests`) with Jest. |
| `pnpm test:e2e` | Runs the comprehensive CLI test suite (Smoke Tests). |
| `pnpm lint` | Validates code style and checks logic errors. |
| `pnpm type-check` | Validates TypeScript types. |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing`)
3.  Commit your changes (`git commit -m 'feat: add amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing`)
5.  Open a Pull Request

## License

MIT -- see [LICENSE](LICENSE) file.