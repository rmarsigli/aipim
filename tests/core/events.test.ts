import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, existsSync, readFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { appendEvent, appendEvents, readEvents, readEventsForTask } from '../../src/core/events.js'

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

describe('appendEvents', () => {
    function created(taskId: string) {
        return {
            type: 'task.created' as const,
            taskId,
            title: taskId,
            taskType: 'feat',
            priority: 'P2-M',
            filePath: `.project/backlog/${taskId}.md`,
        }
    }

    it('writes the whole batch', async () => {
        const events = await appendEvents(TEST_ROOT, [created('TASK-001'), created('TASK-002'), created('TASK-003')])

        expect(events).toHaveLength(3)
        expect(readEvents(TEST_ROOT)).toHaveLength(3)
    })

    it('gives every event in a batch a distinct id', async () => {
        const events = await appendEvents(TEST_ROOT, Array.from({ length: 25 }, (_, i) => created(`TASK-${i}`)))
        expect(new Set(events.map((e) => e.id)).size).toBe(25)
    })

    it('preserves batch order on read back, so dependencies replay after their tasks', async () => {
        await appendEvents(TEST_ROOT, [
            created('TASK-001'),
            created('TASK-002'),
            { type: 'task.dependency_added' as const, taskId: 'TASK-002', dependsOn: 'TASK-001' },
        ])

        expect(readEvents(TEST_ROOT).map((e) => e.type)).toEqual([
            'task.created',
            'task.created',
            'task.dependency_added',
        ])
    })

    it('does not serve a stale parse after the file is replaced', async () => {
        await appendEvent(TEST_ROOT, created('TASK-001'))
        expect(readEvents(TEST_ROOT)).toHaveLength(1)

        // A file deleted and recreated can land on the same mtime, which is why
        // the cache keys on inode and size too.
        rmSync(EVENTS_FILE)
        await appendEvents(TEST_ROOT, [created('TASK-002'), created('TASK-003')])

        const events = readEvents(TEST_ROOT)
        expect(events).toHaveLength(2)
        expect(events.map((e) => ('taskId' in e ? e.taskId : null))).toEqual(['TASK-002', 'TASK-003'])
    })

    it('writes nothing for an empty batch', async () => {
        expect(await appendEvents(TEST_ROOT, [])).toEqual([])
        expect(existsSync(EVENTS_FILE)).toBe(false)
    })

    it('does not interleave with a concurrent single append', async () => {
        await Promise.all([
            appendEvents(TEST_ROOT, [created('TASK-001'), created('TASK-002'), created('TASK-003')]),
            appendEvent(TEST_ROOT, created('TASK-999')),
        ])

        const lines = readFileSync(EVENTS_FILE, 'utf8').trim().split('\n')
        const ids = lines.map((line) => JSON.parse(line).taskId)
        const batchPositions = ['TASK-001', 'TASK-002', 'TASK-003'].map((id) => ids.indexOf(id))

        expect(lines).toHaveLength(4)
        expect(batchPositions[1]).toBe(batchPositions[0] + 1)
        expect(batchPositions[2]).toBe(batchPositions[1] + 1)
    })
})
