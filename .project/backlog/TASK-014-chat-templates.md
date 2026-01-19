---
title: "Implement Chat Message Templates"
created: 2026-01-18T20:15:00-03:00
last_updated: 2026-01-18T20:15:00-03:00
priority: P2-M  # High impact, complements TASK-009
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [cli, ux, chat-integration, templates]
related_files: [src/commands/, src/prompts/]
---

# Task: Implement Chat Message Templates

## Objective

Create `aipim template <name>` command that generates ready-to-paste prompts for common dev situations (stuck, review, summary, etc.). Eliminates "how do I ask this?" friction.

**Success:**
- [ ] `aipim template stuck` generates debugging prompt
- [ ] `aipim template review` generates code review prompt
- [ ] `aipim template summary` generates session summary prompt
- [ ] Auto-copies to clipboard
- [ ] Extensible (users can add custom templates)

## Context

**Why:** Developers waste time crafting prompts for routine situations. Pre-made templates save 2-5min per ask and ensure consistent, effective prompts.

**Common Scenarios:**

1. **Stuck/Blocked:**
   ```
   "I'm stuck on this code, how do I explain the problem clearly?"
   → Wastes 3min writing vague description
   → AI gives vague answer
   → Multiple back-and-forth rounds
   ```

2. **Code Review:**
   ```
   "Please review this... uh... should I paste the whole file?"
   → Pastes 500 lines
   → AI can't focus, generic feedback
   ```

3. **Session Summary:**
   ```
   "How do I summarize what I did for context.md?"
   → Forgets half the things done
   → Summary too verbose or too vague
   ```

**With Templates:**

```bash
# Stuck template
$ aipim template stuck

✔ Copied to clipboard!

Paste this, then add your error/code:
───────────────────────────────
I'm stuck on {current_task} phase {X}.

Current file: {git_status}
Last successful step: {last_checkbox ✅}

The issue:
[PASTE YOUR ERROR OR PROBLEM HERE]

What I've tried:
- Attempt 1
- Attempt 2

What approaches should I try?
───────────────────────────────
```

**Dependencies:**
- [ ] TASK-009 (Session Starter) - uses similar clipboard logic
- [ ] current-task.md for context injection

**Related:** TASK-009 (start), TASK-010 (resume)

## Implementation

### Phase 1: Core Templates (1.5h)
- [ ] Create template system in `src/prompts/`
- [ ] Implement 5 core templates:

**1. stuck.md** - Debugging help
```markdown
I'm stuck on {{task_name}} phase {{current_phase}}.

**Context:**
- Current file: {{current_file}}
- Last successful step: {{last_completed_checkbox}}
- Task objective: {{task_objective_excerpt}}

**The Issue:**
[DESCRIBE YOUR PROBLEM HERE]

**Error/Output:**
[PASTE ERROR OR UNEXPECTED OUTPUT]

**What I've Tried:**
1. [Attempt 1]
2. [Attempt 2]

**Question:**
What approaches should I try to solve this?
```

**2. review.md** - Code review
```markdown
Please review this code for {{task_name}} phase {{current_phase}}:

**File:** {{file_name}}
**Changes:** {{git_diff_stat}}

[PASTE YOUR CODE HERE]

**Check for:**
- Logic errors
- Edge cases not handled
- Performance issues
- Security vulnerabilities
- Code style/readability

**Context:**
This code {{task_objective_excerpt}}

Be honest but constructive.
```

**3. summary.md** - Session summary
```markdown
Session complete. Help me update context.md:

**Today I:**
{{git_log_today}}

**Task:** {{task_name}}
**Time:** {{actual_hours}}h / {{estimated_hours}}h estimated
**Progress:** {{completed_checkboxes}}/{{total_checkboxes}} checkboxes

**Completed:**
{{list_completed_checkboxes}}

**Blockers Encountered:**
[LIST ANY ISSUES]

**Next Session Should:**
{{next_uncompleted_checkbox}}

Generate a concise 2-3 sentence summary for context.md "Current State" section.
```

**4. explain.md** - Explain code/concept
```markdown
Please explain {{context_from_selection}}

**My current understanding:**
[DESCRIBE WHAT YOU THINK IT DOES]

**What I need clarified:**
- How does {{specific_part}} work?
- Why was {{approach}} chosen?
- What happens if {{edge_case}}?

**Context:**
I'm working on {{task_name}} and need to understand this to {{next_step}}.

Explain like I'm a {{skill_level}} developer.
```

**5. optimize.md** - Performance review
```markdown
This code works but feels slow:

[PASTE CODE]

**Performance issue:**
- Current: {{current_performance}} (e.g., "5s per request")
- Target: {{target_performance}} (e.g., "<500ms")

**Profile data (if available):**
[PASTE PROFILER OUTPUT]

**Constraints:**
- Can't change: {{constraints}}
- Open to: {{open_to_changes}}

Suggest optimizations with trade-offs explained.
```

### Phase 2: Template Engine (0.5h)
- [ ] Variable substitution system:
  ```typescript
  const variables = {
      task_name: parseCurrentTask().title,
      current_phase: getCurrentPhase(),
      last_completed_checkbox: getLastCompletedItem(),
      git_log_today: getTodayCommits(),
      // etc...
  }

  const rendered = renderTemplate('stuck', variables)
  ```
- [ ] Handle missing variables gracefully (use "N/A" or omit section)

### Phase 3: Custom Templates (0.5h)
- [ ] Allow user templates in `.project/prompts/`
- [ ] Format: markdown with {{variables}}
- [ ] `aipim template list` shows all available
- [ ] `aipim template add <name>` creates new template

### Phase 4: CLI Integration (0.5h)
- [ ] Add command: `aipim template <name>`
- [ ] Options:
  - `--list`: Show all templates
  - `--print`: Print instead of clipboard
  - `--edit`: Open template in editor
- [ ] Auto-copy to clipboard by default
- [ ] Show "fill these blanks" guidance

## Definition of Done

### Functionality
- [ ] 5 core templates working
- [ ] Variable substitution accurate
- [ ] Clipboard integration works
- [ ] Custom templates supported
- [ ] List command shows all templates

### Testing
- [ ] Test each core template
- [ ] Test with missing context (graceful)
- [ ] Test custom template creation
- [ ] Verify clipboard copy
- [ ] Test variable substitution

### Code Quality
- [ ] Template format documented
- [ ] Variable list documented
- [ ] Clear user guidance

### Documentation
- [ ] Time logged
- [ ] Template usage guide
- [ ] Variable reference

### Git
- [ ] Atomic commits
- [ ] Convention: feat(cli): add chat message templates
- [ ] No conflicts

## Testing

### Manual
- [ ] Run `aipim template stuck`
- [ ] Verify variables filled correctly
- [ ] Paste in AI chat, test effectiveness
- [ ] Create custom template
- [ ] Test with incomplete context

## Technical Notes

**Template Directory Structure:**

```
src/prompts/
├── stuck.md
├── review.md
├── summary.md
├── explain.md
├── optimize.md
└── variables.ts

.project/prompts/  (user custom)
├── my-template.md
└── another.md
```

**Variable Reference:**

```typescript
// Available template variables
interface TemplateVariables {
    // Task context
    task_name: string
    task_objective_excerpt: string
    current_phase: string
    estimated_hours: number
    actual_hours: number
    completed_checkboxes: number
    total_checkboxes: number
    last_completed_checkbox: string
    next_uncompleted_checkbox: string

    // Git context
    current_file: string
    current_branch: string
    git_log_today: string[]
    git_diff_stat: string

    // Session context
    session_number: number
    last_commit: { hash: string; message: string }

    // User preferences
    skill_level: 'beginner' | 'intermediate' | 'advanced'
}
```

**Usage Examples:**

```bash
# Stuck on bug
$ aipim template stuck
✔ Copied! Paste in chat, then describe your issue.

# Code review
$ aipim template review
✔ Copied! Paste in chat, then paste your code.

# Session summary
$ aipim template summary
✔ Copied! Paste in chat, add blockers, get summary.

# List all
$ aipim template list
Core templates:
  - stuck      Debug/troubleshoot issues
  - review     Code review request
  - summary    Generate session summary
  - explain    Explain code/concept
  - optimize   Performance optimization

Custom templates (.project/prompts/):
  - my-feature Request feature help

# Create custom
$ aipim template add my-template
Created: .project/prompts/my-template.md
Edit the file, use {{variables}} as needed.

# Print instead of copy
$ aipim template stuck --print
[Shows template content]
```

**Benefits:**

1. **Faster Iteration:**
   - 2-5min saved per AI interaction
   - Consistent, effective prompts

2. **Better Responses:**
   - AI gets right context immediately
   - Fewer back-and-forth rounds

3. **Learning Tool:**
   - Templates show how to ask good questions
   - Users learn effective prompting

4. **Customization:**
   - Team can share custom templates
   - Project-specific templates (.project/prompts/)

## Blockers & Risks

**Current:**
- [ ] None

**Potential:**
1. Risk: Templates might be too rigid
   - Mitigation: Use {{variables}} + placeholder text
2. Risk: Variable might be unavailable
   - Mitigation: Graceful fallback, show "N/A" or omit

## References

- Prompt engineering best practices
- ChatGPT/Claude effective prompting guides
- Related: TASK-009 (session start), TASK-010 (resume)

## Completion

- [ ] All DoD checked
- [ ] Time logged
- [ ] Context updated
- [ ] Documentation complete
