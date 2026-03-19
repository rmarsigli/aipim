import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, existsSync, readFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { appendEvent, readEvents, readEventsForTask } from '../../src/core/events.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/events-test')
const EVENTS_FILE = join(TEST_ROOT, '.project/events.jsonl')

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('appendEvent', () => {
    it('creates events.jsonl on first write', async () => {
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'Test Task',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/test.md',
        })

        expect(existsSync(EVENTS_FILE)).toBe(true)
    })

    it('assigns id, timestamp and actor to each event', async () => {
        const event = await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'Test Task',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/test.md',
        })

        expect(event.id).toBeTruthy()
        expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(event.actor).toBeTruthy()
    })

    it('appends multiple events without overwriting', async () => {
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'First',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/first.md',
        })
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-002',
            title: 'Second',
            taskType: 'fix',
            priority: 'P2-M',
            filePath: '.project/backlog/second.md',
        })

        const lines = readFileSync(EVENTS_FILE, 'utf8').trim().split('\n')
        expect(lines).toHaveLength(2)
    })

    it('each line is valid JSON', async () => {
        await appendEvent(TEST_ROOT, {
            type: 'task.status_changed',
            taskId: 'TASK-001',
            from: 'backlog',
            to: 'in-progress',
        })

        const lines = readFileSync(EVENTS_FILE, 'utf8').trim().split('\n')
        expect(() => JSON.parse(lines[0])).not.toThrow()
    })

    it('uses AIPIM_USER env var as actor when set', async () => {
        const originalUser = process.env.AIPIM_USER
        process.env.AIPIM_USER = 'test-user@example.com'

        try {
            const event = await appendEvent(TEST_ROOT, {
                type: 'task.completed',
                taskId: 'TASK-001',
            })
            expect(event.actor).toBe('test-user@example.com')
        } finally {
            if (originalUser === undefined) {
                delete process.env.AIPIM_USER
            } else {
                process.env.AIPIM_USER = originalUser
            }
        }
    })

    it('serialises concurrent writes (no interleaving)', async () => {
        // Fire 10 appends concurrently — each should land as a complete JSON line
        await Promise.all(
            Array.from({ length: 10 }, (_, i) =>
                appendEvent(TEST_ROOT, {
                    type: 'task.created',
                    taskId: `TASK-${String(i).padStart(3, '0')}`,
                    title: `Task ${i}`,
                    taskType: 'feat',
                    priority: 'P1-S',
                    filePath: `.project/backlog/task${i}.md`,
                })
            )
        )

        const lines = readFileSync(EVENTS_FILE, 'utf8').trim().split('\n')
        expect(lines).toHaveLength(10)
        // Every line must be parseable JSON
        lines.forEach((line) => expect(() => JSON.parse(line)).not.toThrow())
    })
})

describe('readEvents', () => {
    it('returns empty array when events.jsonl does not exist', () => {
        const events = readEvents(TEST_ROOT)
        expect(events).toEqual([])
    })

    it('returns all events in chronological order', async () => {
        // Write events with different timestamps manually to test ordering
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'First',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/first.md',
        })
        await appendEvent(TEST_ROOT, {
            type: 'task.status_changed',
            taskId: 'TASK-001',
            from: 'backlog',
            to: 'in-progress',
        })

        const events = readEvents(TEST_ROOT)
        expect(events).toHaveLength(2)
        expect(events[0].type).toBe('task.created')
        expect(events[1].type).toBe('task.status_changed')
    })

    it('orders events by timestamp even if file order differs', () => {
        // Write second event first (older timestamp via manipulation)
        const later = new Date(Date.now() + 1000).toISOString()
        const earlier = new Date(Date.now() - 1000).toISOString()

        const evtLater = { id: '2', type: 'task.status_changed', taskId: 'TASK-001', from: 'backlog', to: 'in-progress', timestamp: later, actor: 'test' }
        const evtEarlier = { id: '1', type: 'task.created', taskId: 'TASK-001', title: 'T', taskType: 'feat', priority: 'P1-S', filePath: 'x.md', timestamp: earlier, actor: 'test' }

        appendFileSync(join(TEST_ROOT, '.project/events.jsonl'), JSON.stringify(evtLater) + '\n')
        appendFileSync(join(TEST_ROOT, '.project/events.jsonl'), JSON.stringify(evtEarlier) + '\n')

        const events = readEvents(TEST_ROOT)
        expect(events[0].timestamp).toBe(earlier)
        expect(events[1].timestamp).toBe(later)
    })
})

describe('readEventsForTask', () => {
    it('returns only events for the specified task', async () => {
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'Task One',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/task1.md',
        })
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-002',
            title: 'Task Two',
            taskType: 'fix',
            priority: 'P2-M',
            filePath: '.project/backlog/task2.md',
        })
        await appendEvent(TEST_ROOT, {
            type: 'task.status_changed',
            taskId: 'TASK-001',
            from: 'backlog',
            to: 'in-progress',
        })

        const task1Events = readEventsForTask(TEST_ROOT, 'TASK-001')
        expect(task1Events).toHaveLength(2)
        expect(task1Events.every((e) => 'taskId' in e && e.taskId === 'TASK-001')).toBe(true)
    })

    it('returns empty array when task has no events', async () => {
        await appendEvent(TEST_ROOT, {
            type: 'task.created',
            taskId: 'TASK-001',
            title: 'Task One',
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '.project/backlog/task1.md',
        })

        const events = readEventsForTask(TEST_ROOT, 'TASK-999')
        expect(events).toEqual([])
    })
})
