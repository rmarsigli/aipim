---
title: "Implement Session Starter (aipim start)"
created: 2026-01-18T19:20:00-03:00
last_updated: 2026-01-18T19:20:00-03:00
priority: P1-M  # CRITICAL - Core UX improvement
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: []
tags: [cli, ux, automation, chat-integration]
related_files: [cli/commands/, docs/quick-start.md]
---

# Task: Implement Session Starter (aipim start)

## Objective

Create `aipim start` command that generates a complete, copy-paste-ready prompt for starting AI chat sessions. Eliminates manual context gathering and "what do I tell the AI?" friction.

**Success:**
- [ ] `aipim start` generates complete prompt
- [ ] Prompt includes: context.md + current-task.md + recent decisions
- [ ] Auto-copies to clipboard
- [ ] Optional: Opens browser to chat URL
- [ ] "Quick Start Guide for Forgetful Humans" documentation

## Context

**Why:** Users waste 5-10 minutes at session start gathering context manually. Brain-dead automation > remembering what to paste.

**User Pain:**
> "da pra criar uma documentacao que ensina o humano (o dev, vamos supor que ele seja um cara esquecido e desligado, como eu) a conversar com a maquina (o llm), quando ele abre o chat, as mensagens que ele precisa mandar (sem precisar enrolar e escrever demais, pq o aipim serve pra isso), entende?"

**Current Workflow (Broken):**
1. Read context.md manually
2. Read current-task.md manually
3. Try to remember what to tell AI
4. Write long message in chat
5. Realize you forgot something
6. Write more...

**Target Workflow:**
1. `aipim start`
2. Ctrl+V in chat
3. Done.

**Dependencies:**
- [ ] CLI infrastructure
- [ ] Clipboard library (xclip, pbcopy, or cross-platform)
- [ ] Optional: Browser automation

**Related:** Complements all workflow improvements - this is the **entry point**

## Implementation

### Phase 1: Generate Session Prompt (2h)
- [ ] Create `cli/commands/start.js` (or .py)
- [ ] Read `.project/context.md`
- [ ] Read `.project/current-task.md`
- [ ] Read last 3 commits from git log
- [ ] Read last ADR from `.project/decisions/`
- [ ] Generate structured prompt:
  ```markdown
  # AIPIM Session Start

  ## Project Context
  {context.md frontmatter + Current State section}

  ## Active Task
  {current-task.md with current phase highlighted}

  ## Recent Work
  {Last 3 commits}

  ## Recent Decisions
  {Last ADR summary}

  ## Next Action
  {next_action from context.md}

  ---

  I'm ready to continue. Please confirm you understand the context
  and suggest the next immediate step for {next_action}.
  ```

### Phase 2: Clipboard Integration (1.5h)
- [ ] Detect OS (Linux, macOS, Windows)
- [ ] Use appropriate clipboard tool:
  - Linux: xclip or xsel
  - macOS: pbcopy
  - Windows: clip.exe
  - Fallback: print to stdout with instructions
- [ ] Options:
  - `aipim start`: Copy to clipboard
  - `aipim start --print`: Print to terminal
  - `aipim start --file`: Save to `.aipim-session.md`

### Phase 3: Browser Automation (Optional, 1h)
- [ ] Config: `.project/.aipim-config.json`
  ```json
  {
    "chat_provider": "claude",  // or "gemini", "chatgpt"
    "auto_open_browser": true,
    "chat_urls": {
      "claude": "https://claude.ai/new",
      "gemini": "https://gemini.google.com",
      "chatgpt": "https://chat.openai.com"
    }
  }
  ```
- [ ] Open browser if configured
- [ ] Show instruction: "Prompt copied! Paste with Ctrl+V"

### Phase 4: Quick Start Guide (1.5h)
- [ ] Create `docs/quick-start-for-humans.md`
- [ ] Assume reader is "forgetful and distracted"
- [ ] Step-by-step with screenshots
- [ ] Include "Session Start Checklist"
- [ ] Common mistakes section
- [ ] Troubleshooting

## Definition of Done

### Functionality
- [ ] `aipim start` generates complete prompt
- [ ] Clipboard integration works on Linux/macOS/Windows
- [ ] Prompt is concise but complete (<2000 tokens)
- [ ] Browser auto-open works (optional)
- [ ] Config file support

### Testing
- [ ] Test on Linux, macOS, Windows
- [ ] Test with empty current-task.md (graceful)
- [ ] Test with no git history (graceful)
- [ ] Verify prompt makes sense to AI
- [ ] Test clipboard on all OS

### Performance
- [ ] Command executes in <1s
- [ ] Prompt generation <500ms
- [ ] No external API calls

### Security
- [ ] No secrets in generated prompt
- [ ] Safe file reading (handle missing files)
- [ ] Validate config.json

### Code Quality
- [ ] Cross-platform code
- [ ] Clear error messages
- [ ] Graceful degradation (clipboard fails → print)

### Documentation
- [ ] Time logged
- [ ] Quick Start Guide complete
- [ ] Config examples
- [ ] Troubleshooting section

### Git
- [ ] Atomic commits
- [ ] Convention: feat(cli): add session starter command
- [ ] No conflicts

## Testing

### Manual
- [ ] Run `aipim start` on AIPIM project
- [ ] Paste in Claude.ai, verify understanding
- [ ] Test with Gemini
- [ ] Test with no current task
- [ ] Test clipboard on 3 different machines

## Technical Notes

**Generated Prompt Example:**

```markdown
# AIPIM Development Session - 2026-01-18

## Project: AIPIM (AI Project Instruction Manager)

**Session:** 4
**Branch:** main
**Next Action:** Start TASK-003 (ADR Auto-Detection) - 5h P2-M

## Current State

TASK-002 (Large Task Auto-Breakdown) completed in 2h (4h estimated, 50%
efficiency!). System now prevents task stalling by enforcing clear
checkpoints for >12h tasks. Ready for TASK-003.

## Active Task

**None** - Session 3 complete

**Available Tasks:**
- TASK-003: ADR Automation (5h) - P2-M ⭐ Recommended
- TASK-005: Backlog Health (4h) - P3
- TASK-006: Feature-First Docs (3h) - P2-M (NEW)
- TASK-007: Code Quality Analyzer (8h) - P2-M (NEW)

## Recent Commits

1. `2f28c97` chore: update context after TASK-002 completion
2. `385eabd` chore: complete TASK-002 - large task auto-breakdown
3. `709587f` feat(scripts): add large task breakdown validation

## Recent Decisions

**ADR-001 (2026-01-18):** Dogfooding AIPIM for AIPIM development
- Validates product, identifies gaps, creates authentic examples

## Metrics

- Tasks completed this month: 3
- Estimate accuracy: 0.77 (good!)
- Velocity: ↗️ Improving

---

**I'm ready to continue development. Please:**
1. Confirm you understand the project state
2. Recommend: Start TASK-003 or review new tasks (006-008)?
3. If starting task, help me move it to current-task.md
```

**Command Options:**

```bash
# Default: Copy to clipboard + open browser
aipim start

# Just print to terminal
aipim start --print

# Save to file
aipim start --file session-prompt.md

# Specify chat provider
aipim start --chat=gemini

# No browser auto-open
aipim start --no-browser

# Verbose (show what's being included)
aipim start --verbose

# Include extra context (for complex resumes)
aipim start --full  # Includes last 10 commits, all ADRs
```

**Config File (.project/.aipim-config.json):**

```json
{
  "session_start": {
    "chat_provider": "claude",
    "auto_open_browser": true,
    "auto_copy_clipboard": true,
    "include_git_log": 3,
    "include_recent_adrs": 1,
    "max_prompt_tokens": 2000
  },
  "chat_urls": {
    "claude": "https://claude.ai/new",
    "gemini": "https://gemini.google.com",
    "chatgpt": "https://chat.openai.com"
  }
}
```

## Quick Start Guide Structure

**docs/quick-start-for-humans.md:**

```markdown
# Quick Start Guide (For Forgetful Humans)

> Assume you forgot everything. This guide gets you coding in 2 minutes.

## Every Session Starts The Same Way

### Step 1: Open Terminal
cd /your/project

### Step 2: Start AIPIM Session
aipim start

### Step 3: Open Chat
[Browser should auto-open to Claude.ai/Gemini/ChatGPT]
If not: Click your chat bookmark

### Step 4: Paste
Ctrl+V (or Cmd+V on Mac)

### Step 5: Read AI Response
AI will tell you:
- ✅ What it understood
- 🎯 What to do next
- 📋 Which task to work on

### Step 6: Start Coding
Follow AI's suggestion. Update checkboxes as you go.

## When You're Done (Session End)

### Step 1: Update Task
- Mark completed checkboxes
- Update actual_hours

### Step 2: Update Context
aipim context update
[Or manually edit .project/context.md]

### Step 3: Commit
git add . && git commit -m "your message"

### Step 4: (Optional) Run Quality Check
.project/scripts/analyze-quality.sh

## Common Mistakes

❌ **"I forgot what I was doing"**
→ Run `aipim start` - it tells you

❌ **"I have 5 tasks in progress"**
→ You should have ONLY 1 in current-task.md

❌ **"AI doesn't understand my project"**
→ Update .project/docs/features/ with business logic

❌ **"Session prompt is too long"**
→ Archive old context: `aipim context archive`

## Troubleshooting

**Clipboard not working?**
Use `aipim start --print` and copy manually

**Browser didn't open?**
Check .project/.aipim-config.json or use bookmark

**AI confused about context?**
Run `aipim validate` to check for issues
```

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Clipboard doesn't work on some systems
   - Mitigation: Fallback to --print mode
2. Risk: Prompt might be too verbose
   - Mitigation: Config option for max_tokens
3. Risk: Users on multiple machines (different configs)
   - Mitigation: Config per-project, not global

## References

- User feedback: "como eu vou integrar isso com um chat?"
- UX principle: Zero-friction startup
- Clipboard libraries: clipboardy (Node), pyperclip (Python)

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Quick Start Guide published
