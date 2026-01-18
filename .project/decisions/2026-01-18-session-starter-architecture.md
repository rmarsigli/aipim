---
status: Proposed
date: 2026-01-18
decision-makers: [rmarsigli, claude-sonnet-4.5]
consulted: []
informed: [aipim-users]
---

# ADR-002: Session Starter Architecture (Terminal-to-Chat Integration)

## Context and Problem Statement

AIPIM lives in the terminal (files, git, scripts) but development happens in browser-based AI chats (Claude.ai, Gemini, ChatGPT). Users waste 5-10 minutes every session manually gathering context, remembering what to tell the AI, and writing long prompts.

**User pain point:**
> "como eu vou integrar isso com um chat? [...] da pra criar uma documentacao que ensina o humano (o dev, vamos supor que ele seja um cara esquecido e desligado, como eu) a conversar com a maquina (o llm), quando ele abre o chat, as mensagens que ele precisa mandar (sem precisar enrolar e escrever demais)?"

**Current broken workflow:**
1. Terminal: `cat .project/context.md`
2. Terminal: `cat .project/current-task.md`
3. Brain: "What should I tell the AI?"
4. Browser: Opens chat
5. Types long manual message
6. Realizes forgot something
7. Types more...
8. Exhaustion sets in

**Goal:** One-command session startup that eliminates manual context gathering.

## Decision Drivers

- **Zero friction**: Users shouldn't think about what to include
- **Brain-dead simple**: Works for "forgetful and distracted" developers
- **Cross-platform**: Linux, macOS, Windows
- **No dependencies**: Works without API keys, internet, etc.
- **Fail gracefully**: If clipboard fails, fallback to print
- **Extensible**: Support future chat providers

## Considered Options

### Option 1: CLI Command with Clipboard (`aipim start`)
Generate complete prompt and copy to clipboard automatically.

**Pros:**
- ✅ One command: `aipim start` → Ctrl+V → done
- ✅ Works offline (no API calls)
- ✅ User controls when/where to paste
- ✅ Cross-platform clipboard libraries exist
- ✅ Graceful fallback (print if clipboard fails)

**Cons:**
- ⚠️ Requires clipboard access (permissions)
- ⚠️ Different clipboard tools per OS (xclip/pbcopy/clip.exe)

### Option 2: Web UI Dashboard
Create local web server that displays context with "Copy Prompt" button.

**Pros:**
- ✅ Visual interface
- ✅ Could show graphs, metrics
- ✅ No clipboard permission issues

**Cons:**
- ❌ Requires running server (port conflicts?)
- ❌ Heavier implementation (HTML/CSS/JS)
- ❌ Breaks "terminal-first" philosophy
- ❌ More dependencies

### Option 3: IDE/Editor Plugin
Integrate with VSCode, Vim, etc. with keyboard shortcut.

**Pros:**
- ✅ One keystroke in editor
- ✅ Could highlight current task in sidebar

**Cons:**
- ❌ Requires plugin per editor (massive scope)
- ❌ Not all users use same editor
- ❌ Tight coupling with editor APIs
- ❌ Distribution/update nightmare

### Option 4: Config File Only (Manual Copy-Paste)
Generate `.aipim-session.md` file, user copies manually.

**Pros:**
- ✅ Simplest implementation
- ✅ No clipboard dependencies
- ✅ User sees full prompt before pasting

**Cons:**
- ❌ Still requires manual copy (friction)
- ❌ Extra step (open file, select all, copy)
- ❌ Not "brain-dead simple"

### Option 5: Direct API Integration
Call Claude/Gemini API directly from terminal, start conversation.

**Pros:**
- ✅ Fully automated
- ✅ Terminal-only workflow

**Cons:**
- ❌ Requires API keys (setup friction)
- ❌ Costs money per session
- ❌ Not all users have API access
- ❌ Breaks when offline
- ❌ Users want browser UI (copy-paste code, etc.)

## Decision Outcome

**Chosen option: Option 1 (CLI Command with Clipboard)**

`aipim start` generates complete prompt and copies to clipboard, with graceful fallback to print mode.

**Rationale:**
- Minimal friction (one command)
- Works offline
- No API costs
- Cross-platform achievable
- Fails gracefully (clipboard → print → file)
- Aligns with "terminal-first" philosophy
- Extensible (can add web UI later if needed)

### Implementation Strategy

**Core command:**
```bash
aipim start [OPTIONS]

Options:
  --print         Print to stdout instead of clipboard
  --file=PATH     Save to file instead of clipboard
  --chat=PROVIDER Open browser to chat URL (claude|gemini|chatgpt)
  --no-browser    Don't auto-open browser
  --full          Include extended context (10 commits, all ADRs)
  --verbose       Show what's being included
```

**Clipboard Strategy (cross-platform):**
```javascript
// Detect OS and use appropriate tool
if (platform === 'linux') {
  // Try xclip, then xsel, then fallback
  exec('xclip -selection clipboard')
} else if (platform === 'darwin') {
  exec('pbcopy')
} else if (platform === 'win32') {
  exec('clip.exe')
} else {
  // Fallback: print with instructions
  console.log('📋 Copy this prompt:\n\n' + prompt)
}
```

**Generated Prompt Structure:**
```markdown
# AIPIM Session Start - {PROJECT_NAME}

## Project Context
{context.md: frontmatter + Current State}

## Active Task
{current-task.md OR "No active task - choose from backlog"}

## Recent Work
{Last 3 git commits}

## Recent Decisions
{Last ADR summary}

## Next Action
{next_action from context.md}

---

I'm ready to continue. Please confirm understanding and suggest next step.
```

**Config File (`.project/.aipim-config.json`):**
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

### Positive Consequences

- ✅ Session startup: 5-10min → 10 seconds (98% time reduction)
- ✅ Zero cognitive load ("what do I tell the AI?")
- ✅ Consistent prompts (no forgetting to mention things)
- ✅ Works for "forgetful and distracted" developers
- ✅ Extensible (can add web UI, API integration later)
- ✅ Dogfood opportunity: Use `aipim start` for AIPIM development

### Negative Consequences

- ⚠️ Clipboard permissions might fail on locked-down systems
  - Mitigation: Fallback to `--print` mode
- ⚠️ Different behavior per OS (clipboard tools vary)
  - Mitigation: Test on all 3 platforms, document quirks
- ⚠️ Users might paste in wrong chat window
  - Mitigation: Add header with project name

## Validation

**Success criteria:**
1. Command executes in <1 second
2. Generated prompt is <2000 tokens
3. Works on Linux, macOS, Windows
4. Clipboard works 95% of the time
5. Users report "this is magic" reactions

**Testing:**
- Manual testing on 3 platforms
- Paste generated prompt into Claude, verify understanding
- Test with missing files (graceful degradation)
- Test with no git history, no ADRs (graceful)

## Pros and Cons of the Options

| Option | Friction | Platform | Offline | Complexity | Score |
|--------|----------|----------|---------|------------|-------|
| CLI + Clipboard | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆ | ✅ | Low | 🏆 **Best** |
| Web UI | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐⭐ | ✅ | High | Good |
| IDE Plugin | ⭐⭐⭐⭐⭐ | ⭐☆☆☆☆ | ✅ | Very High | Poor |
| Config File | ⭐⭐☆☆☆ | ⭐⭐⭐⭐⭐ | ✅ | Very Low | OK |
| Direct API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | Medium | Poor |

## Links

- **Related Tasks:** TASK-009 (Implementation), TASK-010 (Session Resume)
- **User Feedback:** Chat integration pain point discussion
- **Alternatives:** Could revisit Web UI if clipboard proves problematic
- **Future:** Browser extension that auto-detects clipboard content?

## Notes

**Why not both CLI + Web UI?**
We can add Web UI later (TASK-XXX) without changing architecture. Start simple, add complexity only if needed.

**Why not require API keys?**
Not all users have API access. AIPIM should work for free-tier users who use browser-based chats.

**What about security?**
Generated prompt might contain sensitive project info. Users should review before pasting in shared/public chats. Add warning in Quick Start Guide.

---

**Status:** Proposed (will be Accepted after TASK-009 implementation validates approach)
