import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { migrate, extractTaskId, extractTaskType } from '../../src/core/migrator.js'
import { readEvents } from '../../src/core/events.js'
import { openDb, getTask, queryTasks, getDependencies } from '../../src/core/db.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/migrator-test')

const BACKLOG_TASK = `---
title: "Implement auth system"
created: 2026-01-10T10:00:00-03:00
priority: P1-M
status: backlog
assignee: rmarsigli
estimated_hours: 8
actual_hours: 0
tags: [backend, auth]
---

# Task content here
`

const COMPLETED_TASK = `---
title: "Setup CI"
created: 2026-01-05T10:00:00-03:00
priority: P2-S
status: completed
estimated_hours: 2
actual_hours: 1.5
tags: [devops]
---

# Setup CI task
`

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
    mkdirSync(join(TEST_ROOT, '.project/completed'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('migrate', () => {
    it('generates events from backlog tasks', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-003-feat-auth.md'), BACKLOG_TASK)

        const result = await migrate(TEST_ROOT)

        expect(result.tasksFound).toBe(1)
        expect(result.eventsGenerated).toBeGreaterThanOrEqual(1) // at least task.created
        expect(result.skipped).toBe(0)
    })

    it('generates task.created event with correct fields', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-003-feat-auth.md'), BACKLOG_TASK)

        await migrate(TEST_ROOT)
        const events = readEvents(TEST_ROOT)

        const created = events.find((e) => e.type === 'task.created')
        expect(created).toBeDefined()
        if (created?.type === 'task.created') {
            expect(created.taskId).toBe('TASK-003')
            expect(created.title).toBe('Implement auth system')
            expect(created.priority).toBe('P1-M')
        }
    })

    it('generates task.assigned event when assignee is set', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-003-feat-auth.md'), BACKLOG_TASK)

        await migrate(TEST_ROOT)
        const events = readEvents(TEST_ROOT)

        const assigned = events.find((e) => e.type === 'task.assigned')
        expect(assigned).toBeDefined()
        if (assigned?.type === 'task.assigned') {
            expect(assigned.assignee).toBe('rmarsigli')
        }
    })

    it('generates task.created + task.completed for completed tasks', async () => {
        writeFileSync(join(TEST_ROOT, '.project/completed/2026-01-05-TASK-001-chore-ci.md'), COMPLETED_TASK)

        await migrate(TEST_ROOT)
        const events = readEvents(TEST_ROOT)

        expect(events.find((e) => e.type === 'task.created')).toBeDefined()
        expect(events.find((e) => e.type === 'task.completed')).toBeDefined()
    })

    it('rebuilds SQLite — completed task shows as done', async () => {
        writeFileSync(join(TEST_ROOT, '.project/completed/2026-01-05-TASK-001-chore-ci.md'), COMPLETED_TASK)

        await migrate(TEST_ROOT)
        const db = openDb(TEST_ROOT)

        const task = getTask(db, 'TASK-001')
        expect(task?.status).toBe('done')
        db.close()
    })

    it('backlog tasks appear in SQLite with correct priority', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-003-feat-auth.md'), BACKLOG_TASK)

        await migrate(TEST_ROOT)
        const db = openDb(TEST_ROOT)

        const tasks = queryTasks(db, { status: 'backlog' })
        expect(tasks).toHaveLength(1)
        expect(tasks[0].priority).toBe('P1-M')
        db.close()
    })

    it('is idempotent — second run skips if events exist', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-003-feat-auth.md'), BACKLOG_TASK)

        await migrate(TEST_ROOT)
        const first = readEvents(TEST_ROOT).length

        const result2 = await migrate(TEST_ROOT)
        const second = readEvents(TEST_ROOT).length

        expect(result2.skipped).toBe(first)
        expect(second).toBe(first) // no new events appended
    })

    it('handles empty backlog and completed directories', async () => {
        const result = await migrate(TEST_ROOT)
        expect(result.tasksFound).toBe(0)
        expect(result.eventsGenerated).toBe(0)
    })

    it('skips files without recognizable task IDs', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/README.md'), '# Not a task')

        const result = await migrate(TEST_ROOT)
        expect(result.tasksFound).toBe(0)
    })
})

describe('extractTaskId', () => {
    it('extracts from TASK-NNN pattern', () => {
        expect(extractTaskId('2026-01-10-TASK-001-feat-auth.md')).toBe('TASK-001')
    })

    it('extracts from T-NNN pattern', () => {
        expect(extractTaskId('2026-01-10-T007-fix-bug.md')).toBe('TASK-007')
    })

    it('pads short numbers to 3 digits', () => {
        expect(extractTaskId('2026-01-10-TASK-5-name.md')).toBe('TASK-005')
    })

    it('returns null when no task ID found', () => {
        expect(extractTaskId('README.md')).toBeNull()
        expect(extractTaskId('context.md')).toBeNull()
    })
})

describe('extractTaskType', () => {
    it('detects feat', () => expect(extractTaskType('TASK-001-feat-auth.md')).toBe('feat'))
    it('detects fix', () => expect(extractTaskType('TASK-002-fix-bug.md')).toBe('fix'))
    it('detects chore', () => expect(extractTaskType('TASK-003-chore-ci.md')).toBe('chore'))
    it('detects docs', () => expect(extractTaskType('TASK-004-docs-readme.md')).toBe('docs'))
    it('defaults to feat when unknown', () => expect(extractTaskType('TASK-005-setup.md')).toBe('feat'))
})

describe('migrate dependencies from frontmatter', () => {
    const DEPENDENT = `---
title: "Depends on the other one"
priority: P2-M
status: backlog
depends_on: [TASK-001]
---

# Content
`

    it('turns depends_on frontmatter into dependency events', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-001-base.md'), BACKLOG_TASK)
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-11-TASK-002-dependent.md'), DEPENDENT)

        await migrate(TEST_ROOT)

        const events = readEvents(TEST_ROOT)
        const dep = events.find((e) => e.type === 'task.dependency_added')
        expect(dep).toBeDefined()
        expect((dep as { taskId: string }).taskId).toBe('TASK-002')
        expect((dep as { dependsOn: string }).dependsOn).toBe('TASK-001')
    })

    it('normalises a short T001 reference to TASK-001', async () => {
        const shortRef = DEPENDENT.replace('[TASK-001]', '[T001]')
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-001-base.md'), BACKLOG_TASK)
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-11-TASK-002-dependent.md'), shortRef)

        await migrate(TEST_ROOT)

        const dep = readEvents(TEST_ROOT).find((e) => e.type === 'task.dependency_added')
        expect((dep as { dependsOn: string }).dependsOn).toBe('TASK-001')
    })

    it('skips a dependency pointing at a task that was not migrated', async () => {
        const dangling = DEPENDENT.replace('[TASK-001]', '[TASK-404]')
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-11-TASK-002-dependent.md'), dangling)

        await migrate(TEST_ROOT)

        expect(readEvents(TEST_ROOT).some((e) => e.type === 'task.dependency_added')).toBe(false)
    })

    it('records the edge in the rebuilt database', async () => {
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-10-TASK-001-base.md'), BACKLOG_TASK)
        writeFileSync(join(TEST_ROOT, '.project/backlog/2026-01-11-TASK-002-dependent.md'), DEPENDENT)

        await migrate(TEST_ROOT)

        const db = openDb(TEST_ROOT)
        expect(getDependencies(db, 'TASK-002')).toEqual(['TASK-001'])
        db.close()
    })
})
