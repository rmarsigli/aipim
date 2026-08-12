import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { openDb, rebuild, applyEvent, queryTasks, getNextTask, getTask, getBlockers, getCommentsForTask, getStats, getChecksForTask } from '../../src/core/db.js'
import type { AipimEvent, TaskCreatedEvent, TaskStatusChangedEvent, TaskAssignedEvent, TaskCommentAddedEvent, TaskCompletedEvent, CheckRunEvent } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/db-test')

function makeTask(overrides: Partial<TaskCreatedEvent> = {}): TaskCreatedEvent {
    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'task.created',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId: 'TASK-001',
        title: 'Test Task',
        taskType: 'feat',
        priority: 'P1-S',
        filePath: '.project/backlog/test.md',
        ...overrides,
    }
}

function makeStatusChange(overrides: Partial<TaskStatusChangedEvent> = {}): TaskStatusChangedEvent {
    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'task.status_changed',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId: 'TASK-001',
        from: 'backlog',
        to: 'in-progress',
        ...overrides,
    }
}

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('openDb', () => {
    it('creates the database file', () => {
        const db = openDb(TEST_ROOT)
        expect(db).toBeDefined()
        db.close()
    })
})

describe('rebuild', () => {
    it('creates all tables from scratch', () => {
        rebuild(TEST_ROOT, [])

        const db = openDb(TEST_ROOT)
        const tables = db
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
            .all() as Array<{ name: string }>
        const names = tables.map((t) => t.name)

        expect(names).toContain('tasks')
        expect(names).toContain('comments')
        expect(names).toContain('decisions')
        expect(names).toContain('events_log')
        db.close()
    })

    it('applies task.created events', () => {
        const events: AipimEvent[] = [makeTask()]
        rebuild(TEST_ROOT, events)

        const db = openDb(TEST_ROOT)
        const task = getTask(db, 'TASK-001')
        expect(task).toBeDefined()
        expect(task?.title).toBe('Test Task')
        expect(task?.status).toBe('backlog')
        expect(task?.priority).toBe('P1-S')
        db.close()
    })

    it('is idempotent — running twice produces same result', () => {
        const events: AipimEvent[] = [makeTask(), makeStatusChange()]
        rebuild(TEST_ROOT, events)
        rebuild(TEST_ROOT, events) // second rebuild

        const db = openDb(TEST_ROOT)
        const task = getTask(db, 'TASK-001')
        expect(task?.status).toBe('in-progress')
        const allTasks = queryTasks(db)
        expect(allTasks).toHaveLength(1)
        db.close()
    })
})

describe('applyEvent', () => {
    it('task.status_changed updates status', () => {
        rebuild(TEST_ROOT, [makeTask()])
        const db = openDb(TEST_ROOT)

        applyEvent(db, makeStatusChange({ to: 'review' }))

        const task = getTask(db, 'TASK-001')
        expect(task?.status).toBe('review')
        db.close()
    })

    it('task.assigned sets assignee', () => {
        rebuild(TEST_ROOT, [makeTask()])
        const db = openDb(TEST_ROOT)

        const event: TaskAssignedEvent = {
            id: 'evt-assign',
            type: 'task.assigned',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-001',
            assignee: 'joao',
        }
        applyEvent(db, event)

        const task = getTask(db, 'TASK-001')
        expect(task?.assignee).toBe('joao')
        db.close()
    })

    it('task.comment_added inserts comment', () => {
        rebuild(TEST_ROOT, [makeTask()])
        const db = openDb(TEST_ROOT)

        const event: TaskCommentAddedEvent = {
            id: 'evt-cmt',
            type: 'task.comment_added',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-001',
            text: 'This is a comment.',
        }
        applyEvent(db, event)

        const comments = getCommentsForTask(db, 'TASK-001')
        expect(comments).toHaveLength(1)
        expect(comments[0].text).toBe('This is a comment.')
        db.close()
    })

    it('task.completed sets status to done', () => {
        rebuild(TEST_ROOT, [makeTask()])
        const db = openDb(TEST_ROOT)

        const event: TaskCompletedEvent = {
            id: 'evt-done',
            type: 'task.completed',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-001',
        }
        applyEvent(db, event)

        const task = getTask(db, 'TASK-001')
        expect(task?.status).toBe('done')
        db.close()
    })

    it('logs every event in events_log', () => {
        rebuild(TEST_ROOT, [makeTask(), makeStatusChange()])
        const db = openDb(TEST_ROOT)

        const log = db.prepare('SELECT * FROM events_log').all()
        expect(log).toHaveLength(2)
        db.close()
    })
})

describe('queryTasks', () => {
    it('returns all tasks with no filter', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', title: 'One', id: 'e1' }),
            makeTask({ taskId: 'TASK-002', title: 'Two', id: 'e2', priority: 'P2-M' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const tasks = queryTasks(db)
        expect(tasks).toHaveLength(2)
        db.close()
    })

    it('filters by status', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P2-M' }),
            makeStatusChange({ taskId: 'TASK-001', to: 'in-progress', id: 'e3' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const backlog = queryTasks(db, { status: 'backlog' })
        expect(backlog).toHaveLength(1)
        expect(backlog[0].id).toBe('TASK-002')
        db.close()
    })

    it('orders by real priority (P1-S before P2-M)', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1', priority: 'P2-M', title: 'Low priority' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P1-S', title: 'High priority' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const tasks = queryTasks(db)
        expect(tasks[0].id).toBe('TASK-002') // P1-S comes first
        expect(tasks[1].id).toBe('TASK-001') // P2-M comes second
        db.close()
    })
})

describe('getNextTask', () => {
    it('returns highest priority backlog task', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1', priority: 'P3', title: 'Nice to have' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P1-S', title: 'Critical' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const next = getNextTask(db)
        expect(next?.id).toBe('TASK-002')
        expect(next?.priority).toBe('P1-S')
        db.close()
    })

    it('returns undefined when backlog is empty', () => {
        rebuild(TEST_ROOT, [])
        const db = openDb(TEST_ROOT)

        const next = getNextTask(db)
        expect(next).toBeUndefined()
        db.close()
    })

    it('skips in-progress and done tasks', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1', priority: 'P1-S', title: 'In progress' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P2-M', title: 'Backlog' }),
            makeStatusChange({ taskId: 'TASK-001', to: 'in-progress', id: 'e3' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const next = getNextTask(db)
        expect(next?.id).toBe('TASK-002')
        db.close()
    })
})

describe('getBlockers', () => {
    it('returns only blocked tasks', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1', priority: 'P1-S' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P2-M' }),
            makeStatusChange({ taskId: 'TASK-001', to: 'blocked', id: 'e3' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const blockers = getBlockers(db)
        expect(blockers).toHaveLength(1)
        expect(blockers[0].id).toBe('TASK-001')
        db.close()
    })
})

describe('getStats', () => {
    it('returns counts by status', () => {
        const events: AipimEvent[] = [
            makeTask({ taskId: 'TASK-001', id: 'e1', priority: 'P1-S' }),
            makeTask({ taskId: 'TASK-002', id: 'e2', priority: 'P2-M' }),
            makeStatusChange({ taskId: 'TASK-001', to: 'in-progress', id: 'e3' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const stats = getStats(db)
        expect(stats['backlog']).toBe(1)
        expect(stats['in-progress']).toBe(1)
        db.close()
    })
})

describe('check.run events', () => {
    function makeCheck(overrides: Partial<CheckRunEvent> = {}): CheckRunEvent {
        return {
            id: `chk-${Math.random().toString(36).slice(2, 8)}`,
            type: 'check.run',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-001',
            command: 'pnpm test',
            exitCode: 0,
            passed: true,
            ...overrides,
        }
    }

    it('creates a checks table on rebuild', () => {
        rebuild(TEST_ROOT, [])
        const db = openDb(TEST_ROOT)

        const tables = db
            .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
            .all() as Array<{ name: string }>

        expect(tables.map((t) => t.name)).toContain('checks')
        db.close()
    })

    it('stores a recorded check for the task', () => {
        const events: AipimEvent[] = [makeTask(), makeCheck({ id: 'c1', command: 'pnpm lint' })]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const checks = getChecksForTask(db, 'TASK-001')
        expect(checks).toHaveLength(1)
        expect(checks[0].command).toBe('pnpm lint')
        expect(checks[0].passed).toBe(true)
        db.close()
    })

    it('stores a failed check with passed false', () => {
        const events: AipimEvent[] = [makeTask(), makeCheck({ id: 'c1', exitCode: 1, passed: false })]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const checks = getChecksForTask(db, 'TASK-001')
        expect(checks[0].passed).toBe(false)
        expect(checks[0].exit_code).toBe(1)
        db.close()
    })

    it('returns checks ordered oldest first', () => {
        const events: AipimEvent[] = [
            makeTask(),
            makeCheck({ id: 'c2', timestamp: '2026-01-02T00:00:00.000Z', command: 'second' }),
            makeCheck({ id: 'c1', timestamp: '2026-01-01T00:00:00.000Z', command: 'first' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        const checks = getChecksForTask(db, 'TASK-001')
        expect(checks.map((c) => c.command)).toEqual(['first', 'second'])
        db.close()
    })

    it('does not return checks belonging to another task', () => {
        const events: AipimEvent[] = [
            makeTask(),
            makeTask({ taskId: 'TASK-002', id: 'e2' }),
            makeCheck({ id: 'c1', taskId: 'TASK-002' }),
        ]
        rebuild(TEST_ROOT, events)
        const db = openDb(TEST_ROOT)

        expect(getChecksForTask(db, 'TASK-001')).toHaveLength(0)
        db.close()
    })
})
