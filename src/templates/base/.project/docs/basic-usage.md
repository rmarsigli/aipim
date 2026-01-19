# Basic Usage Guide

## Getting Started

1.  **Start a session:**
    ```bash
    aipim start
    ```
    This copies the context prompt to your clipboard. Paste it into your AI chat (Claude/Gemini/ChatGPT).

2.  **Resume work:**
    ```bash
    aipim resume
    ```
    Shows your current progress and helps you pick up where you left off.

## Task Workflow

1.  **Pick a task:**
    ```bash
    # Move from backlog to current work
    mv .project/backlog/T001-setup.md .project/current-task.md
    ```

2.  **Work on it:**
    -   Update checkboxes in `current-task.md` as you go.
    -   Commit frequently.

3.  **Pain-Driven Development:**
    -   Found a bug/annoyance? Add it to "Pain Points" in `current-task.md`.
    -   Convert to tasks: `.project/scripts/pain-to-tasks.sh` (High Impact = P1)

4.  **Complete it:**
    ```bash
    # Archive the task
    mv .project/current-task.md .project/completed/$(date +%Y-%m-%d)-T001-setup.md
    ```

## Feature-First Documentation (Recommended)

For complex features (>500 lines of code or complex business logic), use the **Feature-First** pattern to save 99% of AI tokens.

1.  **Create a Feature Doc:**
    ```bash
    cp .project/docs/features/feature-template.md .project/docs/features/my-feature.md
    ```

2.  **Define Logic:**
    Describe *WHAT* the feature does (rules, user stories) without writing *HOW* (code).

3.  **Implement:**
    Ask the AI: "Implement the feature based on .project/docs/features/my-feature.md".

## Code Quality Analyzer

To ensure technical debts don't accumulate, run a quality check before finishing a session.

```bash
# Generate a brutally honest quality report prompt
.project/scripts/analyze-quality.sh --manual
```

1.  Copy the output prompt.
2.  Send to AI.
3.  Save result to `.project/quality-reports/YYYY-MM-DD.md`.

