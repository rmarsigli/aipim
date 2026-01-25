# AIPIM: Project Instruction Manager

```text
    ▄▄█▄▄      █████╗ ██╗██████╗ ██╗███╗   ███╗
  ▀▀▀███▀▀▀   ██╔══██╗██║██╔══██╗██║████╗ ████║
     ███      ███████║██║██████╔╝██║██╔████╔██║
   ▄█████▄    ██╔══██║██║██╔═══╝ ██║██║╚██╔╝██║
  ▐███████▌   ██║  ██║██║██║     ██║██║ ╚═╝ ██║
   ▀█████▀    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝     ╚═╝
     ▀█▀      ═════════════════════════════════
```

> **Artificial Intelligence Project Instruction Manager — The root of your AI-assisted workflow.**

AIPIM acts as the interface layer between your project and your AI coding assistant (Claude, ChatGPT, Gemini, Cursor). It manages the "root" instructions—context, guidelines, and memory—ensuring your AI always knows *how* to work on your codebase without hallucinating or forgetting rules.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Production Ready](https://img.shields.io/badge/Status-Version%201.2.0-green)]()

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

### Methodology: The Cognitive Architecture

AIPIM isn't just a file generator. It implements an **External Memory Architecture** for LLMs to solve the problems of Context Window Limits and Catastrophic Forgetting.

The structure maps directly to how a processor handles memory, but optimized for AI tokens:

### 1. `.project/context.md` (Heap Memory)
**The Single Source of Truth.**
Stores immutable project facts: Tech Stack, Business Rules, and Design Patterns. By keeping this file in your prompt context, you prevent hallucinations and ensure the AI respects your architectural constraints (e.g., "Always use `zod` for validation").

### 2. `.project/current-task.md` (Instruction Pointer)
**The Active Focus.**
LLMs perform significantly better when focused on a constrained scope. This file acts as the current "Stack Frame," containing only the immediate checklist. Once completed, it is moved to archive, freeing up token space for the next task.

### 3. `.project/decisions/` (Immutable Log)
**Prevention of Recursion.**
Architecture Decision Records (ADRs). By documenting *why* you chose a path (e.g., "We use generic components because X"), you prevent the AI from confusingly suggesting refactors or alternatives that were already discarded.

---

## Usage

#### 1. Initialize your project
Run this in your project root to generate the `.project` structure and framework guidelines:

```bash
aipim install
```

#### 2. Start your AI Session
AIPIM creates AI-specific prompt files (`CLAUDE.md`, `GEMINI.md`, `CURSOR.md`, etc.). Most modern AI tools will automatically read these if you mention them or if they're in the context.

**For chat-based AI (Claude, Gemini, ChatGPT):**
> "I have initialized the `.project` folder. Please read `CLAUDE.md` and `.project/context.md` to understand the project architecture and guidelines before we start."

**For Cursor IDE:**
Cursor automatically detects and loads `.cursorrules` - no manual setup needed! Just open your project and start coding. See [Cursor Integration Guide](docs/cursor-integration.md) for details.

#### 3. Manage Tasks
Create a new task file with a unique ID and signature:

```bash
aipim task init feature "Impl User Auth"
```

**Then tell your AI:**
> "I have created/updated the active task in `.project/current-task.md`. Please review it and generate a plan."

## Features

### Safe Update Strategy
Updates are now reliable and safe. `aipim update` automatically:
- **Scans** your project for changes.
- **Backs up** the `.project` directory before touching anything.
- **Preserves** your customizations (modified files are skipped).
- **Updates** only pristine files to the latest version.

### Supported AI Tools

AIPIM generates tailored configuration for each AI tool:

| AI Tool | File Generated | Auto-Detection | Best For |
|---------|---------------|----------------|----------|
| **Claude Code** | `CLAUDE.md` | Manual (paste in chat) | Terminal-based development |
| **Google Gemini** | `GEMINI.md` | Manual (paste in chat) | Web-based chat interface |
| **ChatGPT** | `CHATGPT.md` | Manual (paste in chat) | Web-based chat interface |
| **Cursor IDE** | `CURSOR.md` + `.cursorrules` | **Automatic** ✨ | AI-powered code editor |

**Example:**
```bash
# Install for Cursor with Rust guidelines
aipim install --ai cursor --guidelines rust

# Multiple AI tools
aipim install --ai cursor --ai gemini --guidelines nextjs
```

👉 **Cursor users**: See the complete [Cursor Integration Guide](docs/cursor-integration.md)

### Framework Guidelines

AIPIM detects your tech stack and injects production-ready guidelines:

| Framework | Guideline Highlights | Focus |
|-----------|---------------------|-------|
| **React** | Hooks, TypeScript, no semicolons | Modern patterns |
| **Next.js** | App Router, Server Components | Production optimization |
| **Astro** | Islands Architecture, Content Collections | Zero JS by default |
| **Vue 3** | Composition API, Pinia, VueUse | Reactive patterns |
| **Node.js** | ESM, async/await, error handling | Backend best practices |
| **Rust** | No `.unwrap()`, Result<T,E>, Tokio | Production safety |

**How it works:**
```bash
aipim install --ai cursor --guidelines rust
# ✓ Detects Cargo.toml
# ✓ Injects 381 lines of Rust production guidelines
# ✓ AI enforces: no unwrap(), proper error handling, Tokio async
```

### Doctor (`validate`)
Ensure your project is healthy with `aipim validate` (or `aipim check`). It checks:
- Directory structure integrity.
- Script permissions (smart cross-platform checks).
- File signature verification (detects legacy or tampered files).

### Task Lifecycle & Automation
AIPIM enforces a clear lifecycle for your tasks, preventing chaos.

`[ Backlog ] --> [ Current Task ] --> [ Completed / Archive ]`

Use `aipim task init <type> <name>` to:
- **Auto-number** tasks (`TASK-001`, `TASK-002`) to maintain order.
- **Generate** a structured file with sections for Context, Objective, and Verification.
- **Register** the task in `backlog.md` automatically.

### Advanced Workflows

- **Pain-Driven Development**: A protocol to capture friction during testing (`current-task.md`) and automatically convert it into prioritized backlog items using `pain-to-tasks.sh`.
- **Feature-First Documentation**: A pattern of documenting business logic in `.project/docs/features/` before implementation, significantly reducing AI context consumption.

*You focus on the code; AIPIM keeps the history organized.*

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
| `.project/scripts/analyze-quality.sh` | Generates a comprehensive code quality report using AI. |
| `.project/scripts/task-velocity.sh` | Calculates team velocity and completion estimates. |
| `.project/scripts/pain-to-tasks.sh` | Converts "pain points" documented during testing into backlog tasks. |

## Development Scripts

These scripts are available in `package.json` for development usage:

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compiles the project using `tsup` (dist/). |
| `pnpm test` | Runs unit tests (`src/tests`) with Jest. |
| `pnpm test:e2e` | Runs the comprehensive CLI test suite (Smoke Tests). |
| `pnpm lint` | Validates code style and checks logic errors. |
| `pnpm type-check` | Validates TypeScript types. |
| `pnpm test:coverage` | Runs unit tests and generates a coverage report (min 80%). |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing`)
3.  Commit your changes (`git commit -m 'feat: add amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing`)
5.  Open a Pull Request

## License

[MIT](LICENSE)