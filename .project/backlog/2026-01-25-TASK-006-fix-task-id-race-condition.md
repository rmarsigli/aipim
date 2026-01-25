---
title: "Fix race condition in task ID generation"
created: 2026-01-25T19:00:00-03:00
last_updated: 2026-01-25T19:00:00-03:00
priority: P1-M
estimated_hours: 2
actual_hours: 0
status: backlog
blockers: []
tags: [bug, concurrency, data-integrity, technical-debt]
related_files:
  - src/core/task-manager.ts
  - tests/task-manager.test.ts
---

# Task: Fix Race Condition in Task ID Generation

## Objective

Fix Time-Of-Check-Time-Of-Use (TOCTOU) vulnerability in task ID generation that could cause ID collisions when multiple tasks are created simultaneously.

**Success:**
- [ ] Atomic task ID generation (no race condition)
- [ ] Two concurrent task creations get unique IDs
- [ ] File creation uses exclusive flags (wx)
- [ ] Tests verify concurrency safety

## Context

**Why:**
Current implementation in `src/core/task-manager.ts:77-88` has a classic TOCTOU bug:

```typescript
private async getNextTaskId(): Promise<string> {
    const backlogDir = join(this.projectRoot, '.project/backlog')
    await ensureDir(backlogDir)

    // 1. Read directory (TIME OF CHECK)
    const files = await fs.readdir(backlogDir)
    const ids = files.map(f => {
        const match = f.match(/^TASK-(\d+)-/)
        return match ? parseInt(match[1], 10) : 0
    }).sort((a, b) => b - a)

    // 2. Generate next ID
    const next = (ids[0] || 0) + 1
    return next.toString().padStart(3, '0')
}

public async initTask(config: TaskConfig): Promise<string> {
    const id = await this.getNextTaskId()  // Get ID
    const filename = `TASK-${id}-${slug}.md`
    const taskPath = join(backlogDir, filename)

    // 3. Create file (TIME OF USE)
    await fs.writeFile(taskPath, content)  // ❌ Not atomic!
}
```

**Attack Scenario:**
```bash
# Terminal 1
aipim task init "Feature A"  # Reads dir, sees TASK-001, generates TASK-002

# Terminal 2 (at same time)
aipim task init "Feature B"  # Reads dir, sees TASK-001, generates TASK-002 (COLLISION!)

# Result: Both write to TASK-002, one overwrites the other 💥
```

**Why This Happens:**
1. Check (read directory) and use (create file) are separate operations
2. No locking mechanism between processes
3. No atomic "create if not exists" guarantee
4. Common in concurrent systems

**Impact:**
- **Data Loss:** One task file overwrites another
- **Silent Failure:** No error thrown, data just vanishes
- **Rare But Serious:** Only occurs on concurrent creation (uncommon but devastating)

**Related:**
- Quality Report: .project/reports/code-quality-analysis-2026-01-25.md (Issue #6)
- OWASP: Time-of-check Time-of-use (TOCTOU) vulnerability

## Implementation

### Phase 1: Atomic File Creation (Est: 0.5h)
- [ ] Update `initTask()` to use exclusive write flag
- [ ] Add retry logic for ID collisions

**Before (vulnerable):**
```typescript
public async initTask(config: TaskConfig): Promise<string> {
    const id = await this.getNextTaskId()
    const taskPath = join(backlogDir, `TASK-${id}-${slug}.md`)

    await fs.writeFile(taskPath, content)  // ❌ Overwrites if exists

    return id
}
```

**After (safe):**
```typescript
public async initTask(config: TaskConfig): Promise<string> {
    const slug = config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const backlogDir = join(this.projectRoot, '.project/backlog')
    await ensureDir(backlogDir)

    // Try up to 10 times to get unique ID
    const maxRetries = 10
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const id = await this.getNextTaskId()
        const filename = `TASK-${id}-${slug}.md`
        const taskPath = join(backlogDir, filename)

        try {
            // Atomic: create ONLY if doesn't exist
            await fs.writeFile(taskPath, content, { flag: 'wx' })

            // Success! ID is unique
            logger.debug(`Created task ${id} on attempt ${attempt + 1}`)
            return id
        } catch (error) {
            if (error.code === 'EEXIST') {
                // File exists - ID collision, retry with next ID
                logger.debug(`Task ${id} already exists, retrying...`)
                continue
            }
            // Other error - propagate
            throw error
        }
    }

    throw new Error(`Failed to generate unique task ID after ${maxRetries} attempts`)
}
```

### Phase 2: Improve ID Generation (Est: 0.5h)
- [ ] Add timestamp to reduce collision probability
- [ ] Cache last seen ID to reduce directory reads

**Enhanced getNextTaskId():**
```typescript
private lastGeneratedId: number = 0

private async getNextTaskId(): Promise<string> {
    const backlogDir = join(this.projectRoot, '.project/backlog')
    await ensureDir(backlogDir)

    const files = await fs.readdir(backlogDir)
    const ids = files.map(f => {
        const match = f.match(/^TASK-(\d+)-/)
        return match ? parseInt(match[1], 10) : 0
    }).sort((a, b) => b - a)

    // Use maximum of: highest file ID, last generated ID + 1
    // This reduces collisions when generating multiple IDs in quick succession
    const highestFileId = ids[0] || 0
    const nextId = Math.max(highestFileId, this.lastGeneratedId) + 1

    this.lastGeneratedId = nextId
    return nextId.toString().padStart(3, '0')
}
```

### Phase 3: Add File Locking (Est: 0.5h) - OPTIONAL BUT RECOMMENDED
- [ ] Install `proper-lockfile` package: `npm install proper-lockfile`
- [ ] Add lock around critical section

```typescript
import lockfile from 'proper-lockfile'

public async initTask(config: TaskConfig): Promise<string> {
    const backlogDir = join(this.projectRoot, '.project/backlog')
    await ensureDir(backlogDir)

    // Lock the backlog directory during task creation
    const release = await lockfile.lock(backlogDir, {
        retries: {
            retries: 5,
            minTimeout: 100,
            maxTimeout: 1000
        }
    })

    try {
        const id = await this.getNextTaskId()
        const filename = `TASK-${id}-${slug}.md`
        const taskPath = join(backlogDir, filename)

        // Now safe - lock ensures single process at a time
        await fs.writeFile(taskPath, content, { flag: 'wx' })

        return id
    } finally {
        await release()  // Always release lock
    }
}
```

### Phase 4: Add Concurrency Tests (Est: 0.5h)
- [ ] Add tests to verify race condition fixed

```typescript
import { taskManager } from '@/core/task-manager.js'
import fs from 'fs-extra'

describe('task ID generation - concurrency', () => {
    test('generates unique IDs when creating multiple tasks concurrently', async () => {
        const projectRoot = '/test/project'
        await fs.ensureDir(`${projectRoot}/.project/backlog`)

        // Create 10 tasks simultaneously
        const promises = Array.from({ length: 10 }, (_, i) =>
            taskManager.initTask({
                name: `Task ${i}`,
                priority: 'P2-M'
            })
        )

        const ids = await Promise.all(promises)

        // All IDs should be unique (no collisions)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(10)

        // All files should exist
        for (const id of ids) {
            const files = await fs.readdir(`${projectRoot}/.project/backlog`)
            const hasFile = files.some(f => f.startsWith(`TASK-${id}-`))
            expect(hasFile).toBe(true)
        }
    })

    test('retry logic handles EEXIST errors', async () => {
        // Simulate collision: file created between check and create
        const originalWriteFile = fs.writeFile
        let callCount = 0

        fs.writeFile = jest.fn().mockImplementation(async (path, content, options) => {
            callCount++
            if (callCount === 1) {
                // First call fails (file exists)
                const error = new Error('File exists')
                error.code = 'EEXIST'
                throw error
            }
            // Second call succeeds
            return originalWriteFile(path, content, options)
        })

        const id = await taskManager.initTask({ name: 'Test' })

        expect(id).toBeDefined()
        expect(callCount).toBe(2)  // Retried once

        fs.writeFile = originalWriteFile
    })

    test('fails gracefully after max retries', async () => {
        // Simulate persistent collisions
        fs.writeFile = jest.fn().mockRejectedValue({
            code: 'EEXIST',
            message: 'File exists'
        })

        await expect(
            taskManager.initTask({ name: 'Test' })
        ).rejects.toThrow(/Failed to generate unique task ID after/)
    })
})
```

## Definition of Done

### Functionality
- [ ] No ID collisions even with concurrent task creation
- [ ] Atomic file creation (flag: 'wx')
- [ ] Retry logic handles collisions
- [ ] Error message helpful if max retries exceeded
- [ ] Edge case: Works with existing task IDs (002, 005, 010)

### Testing
- [ ] Concurrency test: 10 parallel creates, all unique IDs
- [ ] Collision test: Retry logic works
- [ ] Max retries test: Fails gracefully after 10 attempts
- [ ] All existing tests still pass

### Performance
- [ ] No performance regression (<50ms per task creation)
- [ ] Lock timeout reasonable (1s max)
- [ ] Retry backoff prevents busy-waiting

### Security
- [ ] No race condition (TOCTOU fixed)
- [ ] File permissions preserved (644)
- [ ] Lock file cleaned up properly
- [ ] No denial of service (max retries prevents infinite loop)

### Code Quality
- [ ] Retry logic clear and maintainable
- [ ] Error handling includes helpful context
- [ ] Lock acquisition/release in finally block
- [ ] No magic numbers (use constants)

### Documentation
- [ ] Comment explaining why 'wx' flag needed
- [ ] JSDoc for getNextTaskId() updated
- [ ] Time logged

### Git
- [ ] Single atomic commit
- [ ] Format: `fix(task-manager): fix race condition in task ID generation`
- [ ] Body explains TOCTOU vulnerability and fix
- [ ] Reference quality report issue

## Testing

### Concurrency Test Script
```bash
# Create test script: test-concurrency.sh
#!/bin/bash

# Create 20 tasks in parallel
for i in {1..20}; do
    aipim task init "Task $i" &
done

wait

# Check for duplicates
cd .project/backlog
ls TASK-*.md | cut -d'-' -f2 | sort | uniq -d

# Should output nothing (no duplicates)
```

### Manual Verification
```bash
# Terminal 1
for i in {1..5}; do aipim task init "Test $i"; done

# Terminal 2 (at same time)
for i in {6..10}; do aipim task init "Test $i"; done

# Check: ls .project/backlog/
# Should see TASK-001 through TASK-010, all unique
```

## Blockers & Risks

**Current:**
- [ ] None - can implement immediately

**Potential:**
1. **Risk:** `proper-lockfile` adds dependency
   - **Mitigation:** Lockfile is optional (retry logic alone is sufficient)
   - **Decision:** Use atomic writes + retry first, add lockfile if needed

2. **Risk:** Cross-platform lock behavior
   - **Mitigation:** `proper-lockfile` handles Windows/Linux/Mac
   - **Testing:** Test on multiple OSes

3. **Risk:** Lock never released (process crash)
   - **Mitigation:** `proper-lockfile` has stale lock detection
   - **Config:** Set reasonable stale timeout (60s)

## Technical Notes

**Atomic File Operations:**
```typescript
// ❌ BAD: Not atomic
if (!fs.existsSync(path)) {  // CHECK
    fs.writeFile(path, data)   // USE - can be interrupted here!
}

// ✅ GOOD: Atomic with wx flag
try {
    await fs.writeFile(path, data, { flag: 'wx' })  // Atomic!
} catch (error) {
    if (error.code === 'EEXIST') {
        // Handle collision
    }
}
```

**File Flags:**
- `w` - Write (overwrites if exists) ❌
- `wx` - Write exclusive (fails if exists) ✅
- `a` - Append (not relevant here)

**Lock vs Retry:**
- **Retry:** Simpler, no dependencies, good enough for most cases
- **Lock:** Stronger guarantee, requires dependency
- **Recommendation:** Start with retry, add lock if issues persist

**Package.json (if using lockfile):**
```json
{
  "dependencies": {
    "proper-lockfile": "^4.1.2"
  }
}
```

## References

- OWASP TOCTOU: https://owasp.org/www-community/vulnerabilities/Time_of_check_time_of_use
- proper-lockfile: https://www.npmjs.com/package/proper-lockfile
- Node.js fs flags: https://nodejs.org/api/fs.html#file-system-flags
- Quality Report: `.project/reports/code-quality-analysis-2026-01-25.md` (Issue #6)

## Instructions for Gemini

**You are fixing a concurrency bug (race condition). Be careful!**

1. **Understand the Bug:**
   - Read `src/core/task-manager.ts:77-88` (getNextTaskId)
   - Understand TOCTOU: check (readdir) and use (writeFile) are separate
   - Two processes can generate same ID and overwrite each other

2. **Implementation Order:**
   - Step 1: Add `{ flag: 'wx' }` to writeFile in initTask()
   - Step 2: Wrap in try/catch to handle EEXIST
   - Step 3: Add retry loop (up to 10 attempts)
   - Step 4: Improve getNextTaskId() with caching
   - Step 5: Add concurrency tests

3. **Key Changes:**
   ```typescript
   // initTask() needs retry loop:
   for (let attempt = 0; attempt < 10; attempt++) {
       try {
           await fs.writeFile(path, content, { flag: 'wx' })
           return id
       } catch (error) {
           if (error.code === 'EEXIST') continue
           throw error
       }
   }

   // getNextTaskId() needs caching:
   private lastGeneratedId: number = 0
   const nextId = Math.max(highestFileId, this.lastGeneratedId) + 1
   this.lastGeneratedId = nextId
   ```

4. **Testing:**
   - Add concurrency test (Phase 4)
   - Run: `npm test -- task-manager.test.ts`
   - Manually test: Create tasks in parallel

5. **Optional Lockfile:**
   - If basic retry not enough, add `proper-lockfile`
   - Only if you see collisions in testing

6. **Commit:**
   ```
   fix(task-manager): fix race condition in task ID generation

   Fixed TOCTOU vulnerability where concurrent task creation could
   generate duplicate IDs and overwrite files.

   Changes:
   - Use atomic file creation with 'wx' flag
   - Add retry logic to handle EEXIST errors
   - Cache last generated ID to reduce collisions
   - Added concurrency tests

   Race condition scenario (fixed):
   - Process A: reads dir, sees TASK-001, generates TASK-002
   - Process B: reads dir, sees TASK-001, generates TASK-002
   - Both write to TASK-002 (collision!)

   Now:
   - Use exclusive write flag (wx) - fails if file exists
   - Retry with next ID on collision
   - Tested with 10 parallel task creations

   Fixes: Technical Debt Issue #6 from quality report
   ```

**Quality Checklist:**
- [ ] writeFile uses `{ flag: 'wx' }` (atomic)
- [ ] Retry loop handles EEXIST
- [ ] Max retries prevents infinite loop
- [ ] Concurrency test added
- [ ] All tests pass

**DO NOT:**
- ❌ Use fs.existsSync() before writeFile (still has race condition)
- ❌ Forget error handling for non-EEXIST errors
- ❌ Make retry loop infinite (use maxRetries)
- ❌ Skip concurrency tests

This is a **CONCURRENCY BUG** - test with parallel operations!
