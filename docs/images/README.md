# Documentation Images

This directory contains screenshots and images for AIPIM documentation.

## Required Screenshots

### Cursor Integration

#### 1. `cursor-detection.png`
**What to capture:**
- Cursor IDE with `.cursorrules` being detected
- Show the Settings panel with "Rules" section
- Highlight that `.cursorrules` is listed as "Active"

**Steps to create:**
1. Open a project with AIPIM installed (`aipim install --ai cursor`)
2. Open Cursor IDE
3. Go to: Settings → Cursor → Rules
4. Take screenshot showing `.cursorrules` in the active rules list
5. Save as `cursor-detection.png` in this directory

**Expected view:**
```
Settings
  └─ Cursor
      └─ Rules
          ✓ .cursorrules (Active)
            - CRITICAL: Always Read First
            - Task Workflow (MANDATORY)
            - Quality Gates
            - ...
```

#### 2. `cursor-composer.png` (Optional)
**What to capture:**
- Cursor Composer window
- Multi-file editing with AIPIM task context
- Show task checklist being referenced

**Steps to create:**
1. Open Cursor Composer (Cmd/Ctrl + K)
2. Type a command like: "Complete phase 2 of current-task.md"
3. Show Cursor reading the task file and generating code
4. Capture the composer window with context visible

#### 3. `cursor-inline-suggestion.png` (Optional)
**What to capture:**
- Inline AI suggestion being filtered by `.cursorrules`
- Example: Cursor suggesting proper error handling instead of `.unwrap()`

**Steps to create:**
1. Start typing Rust code with potential `.unwrap()` usage
2. Show Cursor's suggestion using `Result<T, E>` instead
3. Highlight how `.cursorrules` influenced the suggestion

---

## Image Guidelines

**Format:** PNG (preferred) or JPG
**Resolution:** At least 1920x1080 for desktop screenshots
**File size:** Keep under 500KB (use compression if needed)
**Naming:** Use kebab-case (e.g., `cursor-detection.png`)

**Tools for screenshots:**
- macOS: Cmd + Shift + 4
- Windows: Windows + Shift + S
- Linux: Flameshot, gnome-screenshot

**Editing (optional):**
- Add arrows/highlights to important areas
- Blur sensitive information (project names, tokens)
- Crop to relevant area
- Keep high contrast for readability

---

## Current Status

- [ ] `cursor-detection.png` - **NEEDED**
- [ ] `cursor-composer.png` - Optional
- [ ] `cursor-inline-suggestion.png` - Optional

---

## Contributing Screenshots

If you create these screenshots:

1. Place them in this directory (`docs/images/`)
2. Follow the naming convention above
3. Update the checklist above
4. Create a PR with title: "docs: add Cursor integration screenshots"

Thank you! 🙏
