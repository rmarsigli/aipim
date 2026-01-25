---
title: "Refactor resume.ts to reduce complexity"
created: 2026-01-25T19:05:00-03:00
last_updated: 2026-01-25T19:05:00-03:00
priority: P2-L
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: []
tags: [refactor, code-quality, maintainability, complexity]
related_files:
  - src/commands/resume.ts
  - src/utils/resume-helpers.ts (new)
  - tests/commands/resume.test.ts
---

# Task: Refactor resume.ts to Reduce Complexity

## Objective

Break down the overly complex `resume.ts` command (377 lines) into smaller, testable modules by extracting helper functions and separating concerns.

**Success:**
- [ ] Main file <200 lines
- [ ] Helper functions in separate module
- [ ] Each function <50 lines
- [ ] Cyclomatic complexity <10
- [ ] Easier to test and maintain

## Context

**Why:**
Current `src/commands/resume.ts` violates Single Responsibility Principle:

**File Stats:**
- **377 lines** (too large for single command)
- **generateResumeSummary()**: ~70 lines (complex)
- **Mixes concerns:** File I/O, parsing, git ops, formatting, display

**Problems:**
1. **Hard to Test:** Monolithic functions hard to unit test
2. **Hard to Understand:** Too much logic in one place
3. **Hard to Maintain:** Changes affect unrelated functionality
4. **Hard to Reuse:** Logic buried in command, can't reuse elsewhere

**Complexity Breakdown:**
```typescript
src/commands/resume.ts (377 lines)
├── resume() - Main command function (50 lines)
│   ├── Load snapshot (15 lines)
│   ├── Restore git state (10 lines)
│   ├── Display summary (25 lines)
│
├── generateResumeSummary() - Gather data (70 lines)
│   ├── Parse context.md (12 lines)
│   ├── Parse task file (15 lines)
│   ├── Git operations (10 lines)
│   ├── Calculate status (8 lines)
│   └── Build summary object (25 lines)
│
└── Display helpers (200+ lines)
    ├── displayContextSection()
    ├── displayTaskSection()
    ├── displayGitSection()
    └── displayMetricsSection()
```

**Related:**
- Quality Report: .project/reports/code-quality-analysis-2026-01-25.md (Issue #7)

## Implementation

### Phase 1: Extract Data Gathering (Est: 1h)
- [ ] Create `src/utils/resume-helpers.ts`
- [ ] Extract context parsing
- [ ] Extract task parsing
- [ ] Extract git info gathering

**New file: src/utils/resume-helpers.ts**

```typescript
import fs from 'fs-extra'
import path from 'path'
import { parseFrontmatter } from '@/utils/context.js'
import { git, gitSafe } from '@/utils/git.js'

export interface SessionContext {
    session: number
    lastUpdated: string
    activeBranches: string[]
    nextAction: string
    blockers: string[]
}

export interface TaskInfo {
    title: string
    status: string
    priority: string
    estimatedHours: number
    actualHours: number
    progress: number
}

export interface GitInfo {
    branch: string
    ahead: number
    behind: number
    lastCommit: string
    hasUncommitted: boolean
}

export interface ResumeSummary {
    context: SessionContext | null
    task: TaskInfo | null
    git: GitInfo
    sessionStatus: 'active' | 'stale' | 'unknown'
    pausedAt?: string
    pauseDuration?: string
}

/**
 * Parses context.md file and extracts session information.
 */
export async function getContextInfo(projectRoot: string): Promise<SessionContext | null> {
    const contextPath = path.join(projectRoot, '.project/context.md')

    if (!fs.existsSync(contextPath)) {
        return null
    }

    try {
        const content = await fs.readFile(contextPath, 'utf-8')
        const frontmatter = parseFrontmatter(content)

        return {
            session: frontmatter.session || 0,
            lastUpdated: frontmatter.last_updated || '',
            activeBranches: frontmatter.active_branches || [],
            nextAction: frontmatter.next_action || '',
            blockers: frontmatter.blockers || []
        }
    } catch (error) {
        logger.warn(`Failed to parse context.md: ${error.message}`)
        return null
    }
}

/**
 * Parses current task file and extracts task information.
 */
export async function getTaskInfo(projectRoot: string): Promise<TaskInfo | null> {
    const taskPath = path.join(projectRoot, '.project/current-task.md')

    if (!fs.existsSync(taskPath)) {
        return null
    }

    try {
        const content = await fs.readFile(taskPath, 'utf-8')
        const frontmatter = parseFrontmatter(content)

        // Count checked checkboxes for progress
        const checkboxes = content.match(/- \[[ x]\]/g) || []
        const checkedBoxes = content.match(/- \[x\]/g) || []
        const progress = checkboxes.length > 0
            ? Math.round((checkedBoxes.length / checkboxes.length) * 100)
            : 0

        return {
            title: frontmatter.title || 'Untitled Task',
            status: frontmatter.status || 'unknown',
            priority: frontmatter.priority || 'P2-M',
            estimatedHours: frontmatter.estimated_hours || 0,
            actualHours: frontmatter.actual_hours || 0,
            progress
        }
    } catch (error) {
        logger.warn(`Failed to parse task file: ${error.message}`)
        return null
    }
}

/**
 * Gathers git repository information.
 */
export async function getGitInfo(projectRoot: string): Promise<GitInfo> {
    const cwd = projectRoot

    try {
        // Current branch
        const branch = (await gitSafe(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })).trim()

        // Commits ahead/behind
        const upstreamBranch = await gitSafe(['rev-parse', '--abbrev-ref', '@{upstream}'], { cwd })
        let ahead = 0
        let behind = 0

        if (upstreamBranch) {
            const counts = await gitSafe(['rev-list', '--left-right', '--count', `${upstreamBranch}...HEAD`], { cwd })
            const parts = counts.trim().split('\t')
            behind = parseInt(parts[0], 10) || 0
            ahead = parseInt(parts[1], 10) || 0
        }

        // Last commit
        const lastCommit = (await gitSafe(['log', '-1', '--oneline'], { cwd })).trim()

        // Uncommitted changes
        const status = await gitSafe(['status', '--porcelain'], { cwd })
        const hasUncommitted = status.length > 0

        return {
            branch,
            ahead,
            behind,
            lastCommit,
            hasUncommitted
        }
    } catch (error) {
        logger.debug(`Git info gathering failed: ${error.message}`)
        return {
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            lastCommit: 'unknown',
            hasUncommitted: false
        }
    }
}

/**
 * Calculates session status based on context last updated time.
 */
export function calculateSessionStatus(lastUpdated: string): 'active' | 'stale' | 'unknown' {
    if (!lastUpdated) return 'unknown'

    try {
        const lastUpdate = new Date(lastUpdated)
        const now = new Date()
        const hoursSince = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

        if (hoursSince < 4) return 'active'
        if (hoursSince < 24) return 'stale'
        return 'unknown'
    } catch {
        return 'unknown'
    }
}

/**
 * Generates complete resume summary by gathering all data.
 */
export async function generateResumeSummary(
    projectRoot: string,
    pausedAt?: string
): Promise<ResumeSummary> {
    const [context, task, git] = await Promise.all([
        getContextInfo(projectRoot),
        getTaskInfo(projectRoot),
        getGitInfo(projectRoot)
    ])

    const sessionStatus = context
        ? calculateSessionStatus(context.lastUpdated)
        : 'unknown'

    let pauseDuration: string | undefined
    if (pausedAt) {
        const paused = new Date(pausedAt)
        const now = new Date()
        const minutes = Math.round((now.getTime() - paused.getTime()) / (1000 * 60))
        pauseDuration = minutes < 60
            ? `${minutes}m`
            : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    }

    return {
        context,
        task,
        git,
        sessionStatus,
        pausedAt,
        pauseDuration
    }
}
```

### Phase 2: Simplify Main Command (Est: 0.5h)
- [ ] Update `src/commands/resume.ts` to use helpers
- [ ] Remove redundant parsing code
- [ ] Keep only command orchestration

**Simplified resume.ts:**

```typescript
import { generateResumeSummary } from '@/utils/resume-helpers.js'
import { displayResumeSummary } from '@/utils/resume-display.js'
import fs from 'fs-extra'
import path from 'path'

export async function resume(options: ResumeOptions = {}): Promise<void> {
    const projectRoot = process.cwd()

    // 1. Load snapshot if resuming from pause
    let snapshot: Snapshot | null = null
    if (options.fromPause) {
        snapshot = await loadLatestSnapshot(projectRoot)
        if (!snapshot) {
            logger.error('No pause snapshot found')
            process.exit(1)
        }
    }

    // 2. Generate summary (uses helpers)
    const summary = await generateResumeSummary(
        projectRoot,
        snapshot?.timestamp
    )

    // 3. Display summary (uses display helpers)
    displayResumeSummary(summary)

    // 4. Restore git state if from pause
    if (snapshot && snapshot.gitStashed) {
        await restoreGitState()
    }

    // 5. Copy to clipboard if requested
    if (options.copy) {
        await copyToClipboard(formatSummaryText(summary))
    }
}

// Helper: Load most recent snapshot
async function loadLatestSnapshot(projectRoot: string): Promise<Snapshot | null> {
    const snapshotsDir = path.join(projectRoot, '.project/.snapshots')
    if (!fs.existsSync(snapshotsDir)) return null

    const files = await fs.readdir(snapshotsDir)
    const snapshots = files
        .filter(f => f.startsWith('pause-') && f.endsWith('.json'))
        .sort()
        .reverse()

    if (snapshots.length === 0) return null

    const latestPath = path.join(snapshotsDir, snapshots[0])
    return JSON.parse(await fs.readFile(latestPath, 'utf-8'))
}

// Helper: Restore git stashed changes
async function restoreGitState(): Promise<void> {
    try {
        await git(['stash', 'pop'])
        logger.info('Restored stashed changes')
    } catch (error) {
        logger.warn('Could not restore stashed changes - may need manual intervention')
    }
}
```

### Phase 3: Extract Display Logic (Est: 1h)
- [ ] Create `src/utils/resume-display.ts`
- [ ] Move all display functions
- [ ] Separate data from presentation

**New file: src/utils/resume-display.ts**

```typescript
import chalk from 'chalk'
import { ResumeSummary } from './resume-helpers.js'

export function displayResumeSummary(summary: ResumeSummary): void {
    console.log('')
    console.log(chalk.bold.cyan('=== Session Resume ==='))
    console.log('')

    displayContextSection(summary.context)
    displayTaskSection(summary.task)
    displayGitSection(summary.git)

    if (summary.pauseDuration) {
        console.log(chalk.gray(`Paused for: ${summary.pauseDuration}`))
    }

    displayNextSteps(summary)
    console.log('')
}

function displayContextSection(context: SessionContext | null): void {
    if (!context) {
        console.log(chalk.yellow('⚠️ No context.md found'))
        return
    }

    console.log(chalk.bold('Session:'), `#${context.session}`)
    console.log(chalk.bold('Last Updated:'), context.lastUpdated)

    if (context.activeBranches.length > 0) {
        console.log(chalk.bold('Active Branches:'), context.activeBranches.join(', '))
    }

    if (context.blockers.length > 0) {
        console.log(chalk.red('🚫 Blockers:'))
        context.blockers.forEach(b => console.log(`  - ${b}`))
    }
}

function displayTaskSection(task: TaskInfo | null): void {
    if (!task) {
        console.log(chalk.yellow('⚠️ No current task'))
        return
    }

    console.log('')
    console.log(chalk.bold('Current Task:'), task.title)
    console.log(chalk.bold('Status:'), task.status)
    console.log(chalk.bold('Priority:'), task.priority)
    console.log(chalk.bold('Progress:'), `${task.progress}%`)
    console.log(chalk.bold('Time:'), `${task.actualHours}h / ${task.estimatedHours}h`)
}

function displayGitSection(git: GitInfo): void {
    console.log('')
    console.log(chalk.bold('Git:'))
    console.log(`  Branch: ${git.branch}`)

    if (git.ahead > 0 || git.behind > 0) {
        console.log(`  Status: ↑${git.ahead} ↓${git.behind}`)
    }

    console.log(`  Last commit: ${git.lastCommit}`)

    if (git.hasUncommitted) {
        console.log(chalk.yellow('  ⚠️ Uncommitted changes'))
    }
}

function displayNextSteps(summary: ResumeSummary): void {
    console.log('')
    console.log(chalk.bold.green('Next Steps:'))

    if (summary.context?.nextAction) {
        console.log(`  1. ${summary.context.nextAction}`)
    }

    if (summary.git.hasUncommitted) {
        console.log(`  2. Commit or stash changes`)
    }

    if (summary.git.ahead > 0) {
        console.log(`  3. Push ${summary.git.ahead} commits`)
    }

    if (!summary.task) {
        console.log(`  1. Start a task: aipim task start`)
    }
}
```

### Phase 4: Update Tests (Est: 0.5h)
- [ ] Update `tests/commands/resume.test.ts` to test smaller units
- [ ] Add tests for resume-helpers.ts
- [ ] Add tests for resume-display.ts (optional - mostly formatting)

```typescript
import {
    getContextInfo,
    getTaskInfo,
    getGitInfo,
    calculateSessionStatus,
    generateResumeSummary
} from '@/utils/resume-helpers.js'

describe('resume helpers', () => {
    describe('getContextInfo', () => {
        test('parses context.md correctly', async () => {
            // Mock fs.readFile
            const context = await getContextInfo('/test/project')

            expect(context).toHaveProperty('session')
            expect(context).toHaveProperty('lastUpdated')
        })

        test('returns null if context.md not found', async () => {
            const context = await getContextInfo('/no/context')
            expect(context).toBeNull()
        })
    })

    describe('calculateSessionStatus', () => {
        test('returns active for recent updates (<4h)', () => {
            const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            expect(calculateSessionStatus(recent)).toBe('active')
        })

        test('returns stale for old updates (4-24h)', () => {
            const old = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            expect(calculateSessionStatus(old)).toBe('stale')
        })

        test('returns unknown for very old updates (>24h)', () => {
            const veryOld = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
            expect(calculateSessionStatus(veryOld)).toBe('unknown')
        })
    })

    // More tests...
})
```

## Definition of Done

### Functionality
- [ ] All resume command features work identically
- [ ] No behavior changes - pure refactor
- [ ] Edge cases handled (missing files, parse errors)
- [ ] Display output unchanged

### Testing
- [ ] All existing resume tests pass
- [ ] New tests added for helpers
- [ ] Coverage maintained or improved (79.87% → 85%+)
- [ ] Each helper function tested independently

### Performance
- [ ] No performance regression
- [ ] Async operations remain concurrent (Promise.all)
- [ ] No extra file reads

### Code Quality
- [ ] Main file <200 lines (was 377)
- [ ] Each function <50 lines
- [ ] Cyclomatic complexity <10
- [ ] Clear separation of concerns:
  - Data gathering (helpers.ts)
  - Display logic (display.ts)
  - Orchestration (resume.ts)

### Documentation
- [ ] JSDoc for all exported functions
- [ ] Type interfaces documented
- [ ] Comments explain non-obvious logic

### Git
- [ ] Single atomic commit (or logical commits if phased)
- [ ] Format: `refactor(resume): break down into smaller modules`
- [ ] Body explains separation of concerns

## References

- Quality Report: `.project/reports/code-quality-analysis-2026-01-25.md` (Issue #7)
- Current file: `src/commands/resume.ts` (377 lines)
- Existing tests: `tests/commands/resume.test.ts` (79.87% coverage)

## Instructions for Gemini

**You are refactoring for maintainability. NO behavior changes!**

1. **Create Helper Modules First:**
   - Create `src/utils/resume-helpers.ts` with data gathering functions
   - Create `src/utils/resume-display.ts` with display functions
   - Export clear interfaces and functions

2. **Update Main File:**
   - Simplify `src/commands/resume.ts` to use helpers
   - Keep only orchestration logic
   - Remove inline parsing/display code

3. **Verify No Behavior Change:**
   ```bash
   # Before refactor
   aipim resume > output-before.txt

   # After refactor
   aipim resume > output-after.txt

   # Should be identical
   diff output-before.txt output-after.txt
   ```

4. **Update Tests:**
   - Tests should still pass without changes
   - Add new tests for helper functions
   - Run: `npm test -- resume.test.ts`

5. **Commit:**
   ```
   refactor(resume): break down into smaller, testable modules

   Extracted complex resume command into three modules:
   - resume-helpers.ts: Data gathering (context, task, git info)
   - resume-display.ts: Display formatting
   - resume.ts: Command orchestration (now <200 lines)

   Before: 377 lines, complex monolithic function
   After: 3 focused modules, <50 lines each

   Benefits:
   - Easier to test (pure functions)
   - Easier to understand (single responsibility)
   - Easier to maintain (concerns separated)
   - Easier to reuse (helpers exportable)

   No behavior changes - pure refactor.

   Fixes: Code Quality Issue #7 from quality report
   ```

**Quality Checklist:**
- [ ] New files created (helpers.ts, display.ts)
- [ ] Main file simplified (<200 lines)
- [ ] All functions <50 lines
- [ ] All tests pass
- [ ] No behavior changes

**DO NOT:**
- ❌ Change any functionality
- ❌ Change output format
- ❌ Break existing tests
- ❌ Add new features (pure refactor only)

This is a **REFACTOR** - output must stay identical!
