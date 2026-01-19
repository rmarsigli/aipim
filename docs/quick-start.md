# Quick Start Guide (For Forgetful Humans)

> **Assume you forgot everything.** This guide gets you coding in 2 minutes.

AIPIM helps you work with AI assistants (Claude, Gemini, ChatGPT) by automatically preparing session prompts with all the context the AI needs. No more manual copy-pasting of files or forgetting what to say.

## Every Session Starts The Same Way

### Step 1: Open Terminal

```bash
cd /path/to/your/project
```

### Step 2: Start AIPIM Session

```bash
aipim start
```

**What happens:**
- Reads your `.project/context.md` (project state)
- Reads your `.project/current-task.md` (what you're working on)
- Gets last 3 git commits
- Gets most recent architectural decision (ADR)
- Generates a complete prompt
- **Copies it to your clipboard automatically**

### Step 3: Open Chat

Open your preferred AI chat in a browser:
- **Claude:** https://claude.ai/new
- **Gemini:** https://gemini.google.com
- **ChatGPT:** https://chat.openai.com

### Step 4: Paste

Press `Ctrl+V` (or `Cmd+V` on Mac) in the chat.

The AI will receive:
- ✅ Your project's current state
- ✅ What task you're working on
- ✅ Recent work you've done
- ✅ Recent decisions you've made
- ✅ What to do next

### Step 5: Read AI Response

The AI will:
- ✅ Confirm it understands your project
- 🎯 Suggest the next immediate step
- 📋 Help you continue your task

### Step 6: Start Coding

Follow the AI's suggestion. As you work:
- Update checkboxes in `.project/current-task.md`
- Commit frequently
- Ask the AI for help when stuck

## When You're Done (Session End)

### Step 1: Update Task

Mark completed checkboxes and update `actual_hours` in `.project/current-task.md`

### Step 2: Update Context

Edit `.project/context.md`:
- Update `session` number
- Update `last_updated` timestamp
- Update `next_action` with what comes next
- Add summary to Session Summaries section

### Step 3: Commit & Push

```bash
git add .
git commit -m "your message"
git push
```

### Step 4: (Optional) Run Quality Check

```bash
.project/scripts/analyze-quality.sh  # If you created this script
```

## Alternative Modes

### Print to Terminal (no clipboard)

```bash
aipim start --print
```

Use this if clipboard doesn't work or you want to review before pasting.

### Save to File

```bash
aipim start --file session-prompt.md
```

Saves the prompt to a file instead of clipboard.

### Extended Context (for complex resumes)

```bash
aipim start --full
```

Includes:
- Last **10** commits (instead of 3)
- **All** recent ADRs (instead of just the last one)

## Common Mistakes

### ❌ "I forgot what I was doing"

**Solution:** Run `aipim start` - it tells you exactly where you left off.

### ❌ "I have 5 tasks in progress"

**Problem:** You should have ONLY 1 task in `.project/current-task.md`

**Solution:** Move the active task to `current-task.md` and keep others in `backlog/`

### ❌ "AI doesn't understand my project"

**Problem:** Missing business context in documentation

**Solution:** Update `.project/docs/features/` with business logic and domain knowledge

### ❌ "Session prompt is too long"

**Problem:** Your `context.md` has too many old sessions (>200 lines)

**Solution:** Archive old context:

```bash
.project/scripts/archive-context.sh  # If you created this script
# OR manually move old sessions to .project/context-archive/
```

### ❌ "AI keeps forgetting previous conversations"

**Remember:** Each AIPIM session is a **new chat conversation**. AIs don't remember previous chats.

**Solution:** Update `context.md` with important discoveries from previous sessions.

## Troubleshooting

### Clipboard not working?

**Symptoms:** Command runs but nothing copies to clipboard

**Solutions:**

1. **Use print mode:**
   ```bash
   aipim start --print
   ```
   Then copy manually.

2. **Install clipboard tool (Linux):**
   ```bash
   # Debian/Ubuntu
   sudo apt install xclip

   # Or
   sudo apt install xsel
   ```

3. **Check permissions:**
   Some Linux environments require display access for clipboard.

### Browser didn't open automatically?

Currently, `aipim start` doesn't auto-open browsers (coming in future version).

**Workaround:** Bookmark your preferred chat URL for quick access.

### AI confused about context?

**Diagnostic:**
```bash
aipim validate  # Checks for issues in .project/ files
```

**Common issues:**
- `context.md` has conflicting information
- `current-task.md` status is outdated
- Task file has no clear next action

### No .project directory?

**Error:** `No .project directory found`

**Solution:**
```bash
aipim install
```

### Command not found: aipim

**Problem:** AIPIM not installed globally

**Solution:**
```bash
npm install -g aipim
# or
pnpm add -g aipim
```

## Pro Tips

### 1. Bookmark Your Chat

Create browser bookmarks for faster access:
- Claude: https://claude.ai/new
- Gemini: https://gemini.google.com
- ChatGPT: https://chat.openai.com

### 2. Use Terminal Shortcuts

Create an alias in your `.bashrc` or `.zshrc`:

```bash
alias start="aipim start"
```

Now just type `start` instead of `aipim start`.

### 3. End Sessions Properly

Always update `context.md` when you finish. Future you (and future AIs) will thank you.

### 4. Commit Often

Make small, atomic commits. The AI sees your recent commits in the session prompt.

### 5. Keep Context Concise

`context.md` should be a **summary**, not a novel. Max 200 lines. Archive old sessions regularly.

## What the AI Sees

When you run `aipim start`, the AI receives a prompt like this:

```markdown
# AIPIM Development Session - 2026-01-19

## Project: your-project-name

**Session:** 4
**Branch:** main
**Next Action:** Continue implementing feature X

## Current State

Brief summary of where the project is and what's happening.

## Active Task

**Task Title** (6h estimated)

Status: In Progress (2h actual)
Current Phase: Phase 2 - Implementation

## Recent Commits

1. `abc1234` feat: add user authentication
2. `def5678` fix: resolve login bug
3. `ghi9012` docs: update README

## Recent Decisions

**ADR-001:** Architecture decision summary

---

I'm ready to continue development. Please:
1. Confirm you understand the project state
2. Suggest the next immediate step
```

## Security Note

The generated prompt may contain:
- Project name
- File paths
- Commit messages
- Task descriptions

**Don't paste in:**
- Public chats
- Shared screenshots
- Untrusted AI services

**Safe to paste in:**
- Your private Claude.ai account
- Your private Gemini account
- Your private ChatGPT account

## Need More Help?

- **Full documentation:** `.project/docs/basic-usage.md`
- **Task management:** `.project/docs/task-management.md`
- **Troubleshooting:** `.project/docs/troubleshooting.md`
- **Report issues:** https://github.com/rmarsigli/aipim/issues

## Summary: The 3-Command Workflow

**Start session:**
```bash
aipim start
```

**Paste in chat:**
```
Ctrl+V (or Cmd+V)
```

**Done!** Now the AI knows everything and you can start coding.

---

**Remember:** AIPIM exists so you don't have to remember. Use `aipim start` every time, even if you think you remember. The AI needs context, not your assumptions.
