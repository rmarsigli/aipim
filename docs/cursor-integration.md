# Cursor IDE Integration Guide

Complete guide for using AIPIM with Cursor, the AI-powered code editor.

## Table of Contents
- [Why Cursor?](#why-cursor)
- [What You Get](#what-you-get)
- [Installation](#installation)
- [Files Generated](#files-generated)
- [How Cursor Uses .cursorrules](#how-cursor-uses-cursorrules)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Why Cursor?

Cursor is an AI-powered code editor built on VSCode that integrates AI assistance directly into your workflow. Unlike traditional AI coding assistants that work via chat, Cursor can:

- **Edit multiple files simultaneously** (Composer feature)
- **Understand entire codebases** with semantic search
- **Auto-detect project rules** via `.cursorrules`
- **Apply changes inline** with AI suggestions
- **Maintain context** across editing sessions

AIPIM's integration with Cursor brings structured project management and task tracking to this powerful editor.

---

## What You Get

When you install AIPIM with Cursor support, you get **TWO complementary files**:

### 1. `CURSOR.md` (1000+ lines)
- Full markdown documentation
- Detailed explanations and examples
- Compatible with Cursor's chat interface
- Can be copied/pasted when needed
- Includes Task Workflow Protocol
- Framework-specific guidelines

### 2. `.cursorrules` (500+ lines)
- **Automatically detected** by Cursor
- Condensed, imperative format
- Active rules enforced during editing
- DO/DON'T style guidelines
- Quality gates and anti-patterns
- No manual configuration needed

**Both files receive framework-specific guidelines injection** (React, Rust, Next.js, etc.)

---

## Installation

### Basic Installation

```bash
# Interactive mode
aipim install

? Which AI tools will you use?
  [x] Cursor (AI-powered code editor)

? Add framework-specific guidelines?
  [x] Rust (Production)
```

### CLI Installation

```bash
# Single command installation
aipim install --ai cursor --guidelines rust --yes

# Multiple AIs (Cursor + Gemini)
aipim install --ai cursor --ai gemini --guidelines nextjs

# Just Cursor, no frameworks
aipim install --ai cursor --yes
```

### Expected Output

```
✓ Installation complete!

Files created:
  • .project/ (directory structure)
  • CURSOR.md (~1,000 tokens + guidelines)
  • .cursorrules (native Cursor rules file)
```

---

## Files Generated

### Directory Structure After Installation

```
your-project/
├── .cursorrules              # Auto-detected by Cursor ⚡
├── CURSOR.md                 # Full documentation
├── .project/
│   ├── _templates/
│   │   ├── task.md
│   │   ├── adr.md
│   │   ├── context.md
│   │   └── backlog.md
│   ├── backlog/              # Future tasks
│   ├── completed/            # Finished tasks
│   ├── decisions/            # Architecture decisions
│   ├── context.md            # Session state
│   ├── current-task.md       # Active task
│   └── scripts/
│       ├── pre-session.sh
│       └── validate-dod.sh
└── [your source code]
```

---

## How Cursor Uses .cursorrules

### Automatic Detection

![Cursor detecting .cursorrules](images/cursor-detection.png)

When you open a project with `.cursorrules`, Cursor:

1. **Automatically loads** the rules (no configuration needed)
2. **Applies them** to all AI suggestions and code generation
3. **Enforces quality gates** during multi-file editing
4. **Shows active rules** in Cursor's settings panel

### Active Rules Display

Cursor displays active rules in:
- **Settings** → Cursor → Rules
- **Composer** (when doing multi-file edits)
- **Inline suggestions** (filters suggestions based on rules)

### Rule Priority

Rules in `.cursorrules` are **always active** and take precedence over:
- Global Cursor settings
- Default AI behavior
- Generic coding patterns

---

## Usage Examples

### Example 1: Starting a New Task

**Without AIPIM:**
```
You: "Add user authentication"
Cursor: [Generates code without context]
```

**With AIPIM:**
```bash
# 1. Create task
aipim task init feat "user authentication"

# 2. Move to current
cp .project/backlog/TASK-001-user-authentication.md .project/current-task.md

# 3. Open in Cursor
# Cursor automatically reads .cursorrules
# Knows: task checklist, quality gates, commit format, testing requirements
```

**Cursor now knows:**
- ✓ Current task checklist
- ✓ Definition of Done requirements
- ✓ Git commit convention
- ✓ Testing requirements (>80% coverage)
- ✓ Framework-specific patterns (Rust, React, etc.)

### Example 2: Multi-file Editing with Composer

**Task:** Refactor authentication module

```
You (in Cursor Composer):
"Refactor authentication following the current task checklist"

Cursor (with .cursorrules):
- Reads .project/current-task.md
- Follows Rust production guidelines (no .unwrap(), use Result<T,E>)
- Updates multiple files consistently
- Maintains import/export integrity
- Suggests tests automatically
```

**Quality gates enforced:**
- No `unwrap()` or `expect()` in production Rust code
- Proper error handling with `Result<T, E>`
- Type safety across file boundaries
- Atomic git commits with convention

### Example 3: Inline Suggestions

```rust
// You type:
let user = db.get_user(id).unwrap();

// Cursor (with .cursorrules) suggests:
let user = db.get_user(id)
    .map_err(|e| DatabaseError::UserNotFound(id))?;

// Why: .cursorrules contains:
// "NEVER use .unwrap() or .expect() in production code"
```

### Example 4: Code Review with Chat

```
You: "Review this code for production readiness"

Cursor (reads .cursorrules + CURSOR.md):
Checking against quality gates:
- ✓ Tests: Found unit tests
- ✗ Error handling: Using .unwrap() on line 42
- ✓ Documentation: Functions documented
- ✗ Performance: N+1 query detected on line 67

Suggestions:
1. Replace .unwrap() with proper error handling
2. Use eager loading to fix N+1 query
```

---

## Best Practices

### 1. Keep .cursorrules Updated

When you update AIPIM:
```bash
aipim update
```

This regenerates `.cursorrules` with latest rules while preserving your customizations.

### 2. Use Task Workflow

**Always work with tasks:**
```bash
# Start task
cp .project/_templates/task.md .project/current-task.md

# Edit task with your requirements

# Let Cursor know
# (Cursor automatically reads .project/current-task.md via .cursorrules)
```

### 3. Leverage Composer for Complex Changes

For tasks involving multiple files:

1. Open Cursor Composer (`Cmd/Ctrl + K`)
2. Reference your task: "Complete phase 2 of current-task.md"
3. Let Cursor edit multiple files maintaining consistency
4. Review changes against Definition of Done

### 4. Verify Quality Gates

Before completing a task:
```bash
# Run validation
.project/scripts/validate-dod.sh

# If all checks pass, mark task complete
mv .project/current-task.md .project/completed/$(date +%Y-%m-%d)-TASK-001.md
```

### 5. Custom Rules

You can add custom rules to `.cursorrules`:

```bash
# Open .cursorrules
cursor .cursorrules

# Add project-specific rules at the top:
# Custom rule: Always use our logging wrapper
- Use log_info(), log_error() from utils/logger
- Never use println! or eprintln! in production
```

**Note:** Custom rules will be preserved during `aipim update`.

---

## Framework-Specific Examples

### Rust Production

```bash
aipim install --ai cursor --guidelines rust
```

**Active rules:**
- No `.unwrap()` or `.expect()` in production
- Always use `Result<T, E>`
- Tokio for async runtime
- Proper error types with context

**Cursor behavior:**
```rust
// You ask: "Add database query"
// Cursor generates:
pub async fn fetch_user(id: UserId) -> Result<User, DatabaseError> {
    db.query_one("SELECT * FROM users WHERE id = $1", &[&id])
        .await
        .map_err(DatabaseError::Query)?  // ✓ Proper error handling
}

// NOT:
pub async fn fetch_user(id: UserId) -> User {
    db.query_one(...).await.unwrap()  // ✗ Blocked by rules
}
```

### Next.js (App Router)

```bash
aipim install --ai cursor --guidelines nextjs
```

**Active rules:**
- Server Components by default
- `'use client'` only for interactivity
- No semicolons (project convention)
- Tailwind CSS only

**Cursor behavior:**
```tsx
// You ask: "Create user profile component"
// Cursor generates Server Component by default:
export default async function UserProfile({ id }: Props) {
  const user = await fetchUser(id)  // ✓ Server-side data fetching
  return <div className="flex flex-col">...</div>  // ✓ Tailwind
}

// Only adds 'use client' if you need interactivity:
'use client'
export function Counter() {
  const [count, setCount] = useState(0)  // ✓ Client component
}
```

---

## Troubleshooting

### Issue: Cursor not detecting .cursorrules

**Solution:**
1. Restart Cursor IDE
2. Verify `.cursorrules` is in project root (not in subdirectory)
3. Check file isn't in `.gitignore`

```bash
# Verify location
ls -la .cursorrules

# Should show:
-rw-r--r-- 1 user user 14046 Jan 25 01:19 .cursorrules
```

### Issue: Rules not being applied

**Solution:**
1. Open Cursor Settings → Cursor → Rules
2. Verify `.cursorrules` is listed as "Active"
3. Check for syntax errors in custom rules

### Issue: Conflicting with global Cursor settings

**Behavior:** `.cursorrules` **overrides** global settings (this is intentional).

If you want to temporarily disable:
```bash
# Rename temporarily
mv .cursorrules .cursorrules.disabled

# Re-enable
mv .cursorrules.disabled .cursorrules
```

### Issue: Guidelines not injected

**Solution:**
```bash
# Reinstall with explicit guidelines
aipim install --ai cursor --guidelines rust --force
```

### Issue: Want to update rules

**Solution:**
```bash
# Safe update (preserves custom rules)
aipim update

# Force regeneration (overwrites everything)
aipim install --ai cursor --force
```

---

## Advanced: Multi-AI Setup

Use Cursor alongside other AI tools:

```bash
# Install for Cursor + Gemini
aipim install --ai cursor --ai gemini --guidelines rust

# Generated files:
# - CURSOR.md + .cursorrules (for Cursor)
# - GEMINI.md (for Gemini chat)
# - .project/ (shared task management)
```

**Workflow:**
1. **Cursor** for coding (inline, multi-file editing)
2. **Gemini/Claude** for planning and architecture discussions
3. **AIPIM** for task tracking and session management

All tools share the same:
- `.project/` structure
- Task files
- Context management
- Quality gates

---

## Comparison: CURSOR.md vs .cursorrules

| Feature | CURSOR.md | .cursorrules |
|---------|-----------|--------------|
| **Format** | Markdown | Plain text with comments |
| **Size** | ~1000 lines | ~500 lines |
| **Detection** | Manual (chat) | Automatic |
| **Usage** | Chat reference | Active rules |
| **Examples** | Yes, detailed | No (just rules) |
| **Explanations** | Verbose | Concise |
| **Tables** | Yes | No |
| **Code blocks** | Yes | Yes |
| **Guidelines injection** | ✓ | ✓ |
| **Best for** | Understanding | Enforcement |

**Recommendation:** Use both!
- `.cursorrules` for active enforcement
- `CURSOR.md` for reference and chat context

---

## Real-World Workflow Example

**Project:** Building a Rust API with authentication

### Setup (One-time)
```bash
aipim install --ai cursor --guidelines rust --yes
```

### Sprint Planning
```bash
# Create tasks for sprint
aipim task init feat "jwt-authentication"
aipim task init feat "password-hashing"
aipim task init test "auth-integration-tests"
```

### Development Session

**Day 1 - JWT Task:**
```bash
# 1. Start task
cp .project/backlog/TASK-001-jwt-authentication.md .project/current-task.md

# 2. Open in Cursor
cursor .

# 3. Ask Cursor (it reads .cursorrules + current-task.md):
"Implement JWT token generation following current task"

# Cursor generates code following:
# - No .unwrap()
# - Proper Result<T, E>
# - Tokio async
# - Tests included
# - Error types with context

# 4. Validate
cargo test
cargo clippy

# 5. Complete task
git add -A
git commit -m "feat(auth): implement JWT token generation"
mv .project/current-task.md .project/completed/$(date +%Y-%m-%d)-TASK-001.md
```

**Day 2 - Password Hashing:**
```bash
# Repeat workflow with TASK-002
# Cursor already knows:
# - Project patterns from TASK-001
# - Rust production guidelines
# - Quality requirements
# - Testing standards
```

### Result
- ✓ Consistent code quality
- ✓ All quality gates enforced
- ✓ Atomic commits
- ✓ Full task history
- ✓ Production-ready code

---

## Resources

**AIPIM Documentation:**
- [Quick Start](quick-start.md)
- [Basic Usage](basic-usage.md)
- [Advanced Usage](advanced-usage.md)
- [CLI Reference](cli-reference.md)

**Cursor Documentation:**
- [Cursor IDE Official Docs](https://cursor.sh/docs)
- [.cursorrules Reference](https://cursor.sh/docs/rules)
- [Cursor Composer Guide](https://cursor.sh/docs/composer)

**Framework Guidelines:**
- Rust Production (included)
- Next.js App Router (included)
- React Best Practices (included)
- Vue 3 Composition API (included)

---

## FAQ

**Q: Do I need both CURSOR.md and .cursorrules?**
A: `.cursorrules` is auto-detected and sufficient. `CURSOR.md` is optional reference material.

**Q: Can I customize .cursorrules?**
A: Yes! Add custom rules at the top. They're preserved during `aipim update`.

**Q: Does this work with Cursor's free tier?**
A: Yes! Both files work with free and pro tiers.

**Q: How do I disable AIPIM rules temporarily?**
A: Rename `.cursorrules` to `.cursorrules.disabled`

**Q: Can I use this with other editors?**
A: Yes! `CURSOR.md` works with any editor. `.cursorrules` is Cursor-specific.

**Q: What if my framework isn't supported?**
A: Use `--guidelines node` for generic TypeScript/JavaScript rules, or omit guidelines for just task management.

---

## Changelog

**v1.2.0 (2026-01-25)**
- ✨ Initial Cursor support
- ✨ Added .cursorrules generation
- ✨ Hybrid approach (CURSOR.md + .cursorrules)
- ✨ Framework guidelines injection
- ✨ Multi-file editing guidelines
- ✨ Cursor-specific best practices

---

## Contributing

Found an issue or have a suggestion for Cursor integration?

1. Open an issue: [github.com/rmarsigli/aipim/issues](https://github.com/rmarsigli/aipim/issues)
2. Include "Cursor" in the title
3. Describe your setup and expected behavior

---

**Happy coding with Cursor + AIPIM!** 🚀
