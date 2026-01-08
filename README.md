# AIPIM: Project Instruction Manager

> **Artificial Intelligence Project Instruction Manager — The root of your AI-assisted workflow.**

AIPIM acts as the interface layer between your project and your AI coding assistant (Claude, ChatGPT, Gemini). It manages the "root" instructions—context, guidelines, and memory—ensuring your AI always knows *how* to work on your codebase without hallucinating or forgetting rules.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Production Ready](https://img.shields.io/badge/Status-Version%201.1.0-green)]()

## The Concept

**"Aipim"** (manioc/cassava) is a resilient, versatile root essential to many cultures. 
In software, the **root** (`/`) is where everything begins.

**AIPIM** is the grounded structure that:
1.  **Anchors** your AI with persistent context (Memory).
2.  **Nurtures** your code with strict Framework Guidelines (Nutrition).
3.  **Grows** with your project via Task Management (Lifecycle).

Stop pasting context manually. Let **AIPIM** manage the root.

## Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g aipim

# Or use npx
npx aipim install
```

### Usage

#### 1. Initialize your project
Run this in your project root to generate the `.project` structure and framework guidelines:

```bash
aipim install
```

#### 2. Start your AI Session
AIPIM creates a `CLAUDE.md` (or `GEMINI.md`) file. Most modern AI tools will automatically read this if you mention it or if it's in the context.

**For a new project context:**
> "I have initialized the `.project` folder. Please read `CLAUDE.md` and `.project/context.md` to understand the project architecture and guidelines before we start."

#### 3. Manage Tasks
Create a new task file with a unique ID and signature:

```bash
aipim task init feature "Impl User Auth"
```

**Then tell your AI:**
> "I have created/updated the active task in `.project/current-task.md`. Please review it and generate a plan."

## Features

### 🔒 Safe Update Strategy
Updates are now reliable and safe. `aipim update` automatically:
- **Scans** your project for changes.
- **Backs up** the `.project` directory before touching anything.
- **Preserves** your customizations (modified files are skipped).
- **Updates** only pristine files to the latest version.

### 📐 Framework Guidelines
Stop pasting context manually. `aipim install` now:
- **Detects** your technology stack (e.g. Next.js, Astro, Vue, Node.js).
- **Injects** optimized official guidelines into your AI rules (`CLAUDE.md`, etc).
- **Ensures** AI follows project-specific coding standards automatically.

### 🩺 Doctor (`validate`)
Ensure your project is healthy with `aipim validate` (or `aipim check`). It checks:
- Directory structure integrity.
- Script permissions (smart cross-platform checks).
- File signature verification (detects legacy or tampered files).

### 📋 Task Automation
Stop copying templates manually. Use `aipim task init <type> <name>` to:
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