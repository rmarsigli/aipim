# Basic Usage Guide

> Welcome to **AIPIM** (AI Project Instruction Manager)!

This guide will help you understand how to effectively use the system to manage your project with AI assistance.

## 1. Core Concepts

AIPIM works by maintaining a structured "Context Memory" for your AI sessions. Instead of repeating project details every time, you maintain a few key files in the `.project/` folder.

### The `.project` Structure

- **`.project/context.md`**: The heart of your project.
  - Keeps high-level agreements: Tech Stack, Architecture, Rules, and Business Goals.
  - **Action**: You should edit this file once at the beginning and update it only when major decisions change.

- **`.project/task.md`** (or `current-task.md`): Your active focus.
  - **Backlog**: Tasks you plan to do later.
  - **Completed**: Tasks you have finished.
  - **Current Task**: The single file (`.project/current-task.md`) that represents what you are working on *right now*.

### The Workflow

1.  **Plan**: Define your task in `current-task.md`. Break it down into small steps.
2.  **Code**: Talk to the AI (Claude/ChatGPT/Gemini) using the generated prompt.
3.  **Verify**: Run tests and check requirements.
4.  **Archive**: Move the completed item to the "Completed" list in your backlog (or archive the file).

## 2. Talking to the AI

AIPIM generates a **System Prompt** for you. This prompt injects your `context.md` and `current-task.md` automatically into the AI's memory.

### How to Start a Session

1.  **Prepare**: Ensure your `current-task.md` is ready.
2.  **Prompt**: Copy the content of the generated prompt file (e.g., `.project/CLAUDE.md`) into your AI chat.
3.  **Develop**:
    - The AI now "knows" your project.
    - Ask it to implemented "Step 1 of the current task".
    - Paste code snippets or errors as needed.

> **Tip**: Keep your `current-task.md` updated as you progress. If you change course, update the file so the AI sees the new plan in the next message (if you re-paste the context or using tools).

> **Omega Tip**: You can use AI to create the `current-task.md` file for you. Just ask the AI to create a task for you and it will create the file for you. To be honest, for me, this is the best usage of AI. I use it to create the task, context, backlog and other files for me. It is like a "AI Assistant" that helps me to preserve the project history.

> **Alpha Tip**: Use AI as your Junior Developer, is **VERY IMPORTANT** that you know how the business logic works, so you can ask the AI to implement the business logic for you. AI will struggle - a lot - and make awful decisions - a lot. This method avoid this problem, but not completely, you'll need to review the code, fix the issues and be the engineer that understands the **business logic**.

## 3. Advanced Usage

Once you are comfortable, you can use the CLI to automate maintenance.

### `aipim validate` (Doctor)
Checks if your project structure is healthy.
```bash
aipim validate
```

### `aipim update` (Safe Update)
Updates the AIPIM system files in your project without overwriting your customizations.
```bash
aipim update
```

### `pre-session.sh`
A script to check your token usage and context size before starting a long AI session.
```bash
.project/scripts/pre-session.sh
```
Use this to ensure you aren't pasting a 50,000 token context unnecessarily!

### Context Management & Auto-Archiving

AIPIM automatically manages your `context.md` file to prevent it from growing too large and consuming excessive tokens.

**Automatic Archiving (v1.2+):**
- Every 10 sessions, AIPIM archives old session summaries
- Keeps the last 5 sessions in `context.md`
- Archives older sessions to `.project/context-archive/`
- Preserves all historical context without bloating the main file

**Manual archiving:**
```bash
.project/scripts/archive-context.sh          # Run archiving
.project/scripts/archive-context.sh --dry-run  # Preview without changes
.project/scripts/archive-context.sh --force    # Force archive now
```

**Best Practices:**
- Keep `context.md` focused on current state and recent history
- Review archived sessions when context is needed from older work
- Update session counter in frontmatter after each development session

---

**Happy Coding!**
For more details, visit the [GitHub Repository](https://github.com/rmarsigli/aipim).
