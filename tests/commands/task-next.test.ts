import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { resolveNextTask } from '../../src/commands/task.js'
import type { AipimEvent } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/task-next-test')

let clock = 0

function append(event: Partial<AipimEvent> & { type: AipimEvent['type'] }): void {
    clock++
    const full = {
        id: `evt-${clock}`,
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
        actor: 'test@example.com',
        ...event
    }
    appendFileSync(join(TEST_ROOT, '.project/events.jsonl'), JSON.stringify(full) + '\n', 'utf8')
}

function createTask(taskId: string, priority = 'P2-M', title = `Task ${taskId}`): void {
    append({
        type: 'task.created',
        taskId,
        title,
        taskType: 'feat',
        priority,
        filePath: `.project/backlog/${taskId}.md`
    } as Partial<AipimEvent> & { type: 'task.created' })
}

function dependency(taskId: string, dependsOn: string): void {
    append({ type: 'task.dependency_added', taskId, dependsOn } as Partial<AipimEvent> & {
        type: 'task.dependency_added'
    })
}

function complete(taskId: string): void {
    append({ type: 'task.completed', taskId } as Partial<AipimEvent> & { type: 'task.completed' })
}

beforeEach(() => {
    clock = 0
    mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
    writeFileSync(join(TEST_ROOT, '.project/events.jsonl'), '', 'utf8')
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('resolveNextTask', () => {
    it('returns no task for an empty backlog', () => {
        const result = resolveNextTask(TEST_ROOT)

        expect(result.task).toBeNull()
        expect(result.blocked).toEqual([])
    })

    it('returns the only task in the backlog', () => {
        createTask('TASK-001', 'P2-M', 'Only Task')

        const result = resolveNextTask(TEST_ROOT)

        expect(result.task?.id).toBe('TASK-001')
        expect(result.task?.title).toBe('Only Task')
    })

    it('prefers P1-S over P3', () => {
        createTask('TASK-001', 'P3')
        createTask('TASK-002', 'P1-S')

        expect(resolveNextTask(TEST_ROOT).task?.id).toBe('TASK-002')
    })

    it('orders every priority level correctly', () => {
        for (const [i, priority] of ['P3', 'P2-L', 'P2-M', 'P2-S', 'P1-L', 'P1-M', 'P1-S'].entries()) {
            createTask(`TASK-00${i + 1}`, priority)
        }

        expect(resolveNextTask(TEST_ROOT).task?.priority).toBe('P1-S')
    })

    it('picks the oldest task on a priority tie', () => {
        createTask('TASK-001', 'P1-S', 'Older')
        createTask('TASK-002', 'P1-S', 'Newer')

        expect(resolveNextTask(TEST_ROOT).task?.title).toBe('Older')
    })

    it('never returns a task blocked by an unfinished dependency', () => {
        createTask('TASK-001', 'P2-M')
        createTask('TASK-002', 'P1-S')
        createTask('TASK-003', 'P3')
        dependency('TASK-002', 'TASK-003')

        expect(resolveNextTask(TEST_ROOT).task?.id).toBe('TASK-001')
    })

    it('returns the blocked task once its dependency is done', () => {
        createTask('TASK-002', 'P1-S')
        createTask('TASK-003', 'P3')
        dependency('TASK-002', 'TASK-003')
        complete('TASK-003')

        expect(resolveNextTask(TEST_ROOT).task?.id).toBe('TASK-002')
    })

    it('reports what is blocking when nothing is ready', () => {
        createTask('TASK-001', 'P1-S')
        dependency('TASK-001', 'TASK-999')

        const result = resolveNextTask(TEST_ROOT)

        expect(result.task).toBeNull()
        expect(result.blocked).toEqual(['TASK-001'])
    })

    it('counts the other tasks that are also ready', () => {
        createTask('TASK-001', 'P1-S')
        createTask('TASK-002', 'P2-M')
        createTask('TASK-003', 'P3')

        expect(resolveNextTask(TEST_ROOT).remainingReady).toBe(2)
    })

    it('surfaces dependency cycles', () => {
        createTask('TASK-001', 'P1-S')
        createTask('TASK-002', 'P2-M')
        dependency('TASK-001', 'TASK-002')
        dependency('TASK-002', 'TASK-001')

        expect(resolveNextTask(TEST_ROOT).cycles).toEqual([['TASK-001', 'TASK-002']])
    })

    it('agrees with the MCP tool: a completed task is never returned', () => {
        createTask('TASK-001', 'P1-S')
        complete('TASK-001')

        expect(resolveNextTask(TEST_ROOT).task).toBeNull()
    })
})
