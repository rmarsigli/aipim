import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { openDb, rebuild, applyEvent } from '../../src/core/db.js'
import { readTools } from '../../src/mcp/tools/read.js'
import type { ToolContext } from '../../src/mcp/tools/index.js'
import type { AipimEvent, TaskCreatedEvent, TaskStatusChangedEvent, TaskCommentAddedEvent, TaskDependencyAddedEvent } from '../../src/types/index.js'
import Database from 'better-sqlite3'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/read-tools-test')

function makeTool(name: string) {
    const tool = readTools.find((t) => t.schema.name === name)
    if (!tool) throw new Error(`Tool ${name} not found`)
    return tool
}

function baseEvent(overrides: Partial<TaskCreatedEvent> = {}): TaskCreatedEvent {
    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'task.created',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId: 'TASK-001',
        title: 'Fix critical bug',
        taskType: 'fix',
        priority: 'P1-S',
        filePath: null,
        ...overrides,
    }
}

function makeStatusChange(taskId: string, to: string, ts?: string): TaskStatusChangedEvent {
    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'task.status_changed',
        timestamp: ts ?? new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        from: 'backlog',
        to,
    }
}

let db: Database.Database
let ctx: ToolContext

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
    // Use the real schema so these tests never drift from src/core/db.ts
    rebuild(TEST_ROOT, [])
    db = openDb(TEST_ROOT)
    ctx = { db, projectRoot: TEST_ROOT, events: [] }
})

afterEach(() => {
    db.close()
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('get_project_context', () => {
    const tool = makeTool('get_project_context')

    it('returns empty state for a fresh project', async () => {
        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect(result.stats).toBeDefined()
        expect((result.stats as Record<string, unknown>).total).toBe(0)
        expect(result.currentTask).toBeNull()
        expect(result.nextTask).toBeNull()
        expect(Array.isArray(result.blockers)).toBe(true)
    })

    it('includes currentTask when a task is in-progress', async () => {
        const evt1 = baseEvent({ taskId: 'TASK-001' })
        const evt2 = makeStatusChange('TASK-001', 'in-progress')
        applyEvent(db, evt1)
        applyEvent(db, evt2)
        ctx.events = [evt1, evt2]

        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect((result.currentTask as Record<string, unknown>)?.id).toBe('TASK-001')
    })

    it('includes nextTask from backlog', async () => {
        const evt = baseEvent({ taskId: 'TASK-002', title: 'Next task', priority: 'P2-M' })
        applyEvent(db, evt)
        ctx.events = [evt]

        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect((result.nextTask as Record<string, unknown>)?.id).toBe('TASK-002')
    })

    it('reads context.md session info when present', async () => {
        writeFileSync(
            join(TEST_ROOT, '.project/context.md'),
            '---\nsession: 5\nnext_action: "Write tests"\n---\n'
        )
        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        const session = result.session as Record<string, unknown>
        expect(session.number).toBe(5)
        expect(session.nextAction).toBe('Write tests')
    })
})

describe('get_next_task', () => {
    const tool = makeTool('get_next_task')

    it('returns message when backlog is empty', async () => {
        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect(result.message).toMatch(/no tasks/i)
    })

    it('returns highest priority task', async () => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001', priority: 'P2-M', title: 'Low priority' }))
        applyEvent(db, baseEvent({ taskId: 'TASK-002', priority: 'P1-S', title: 'Critical' }))

        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect(result.id).toBe('TASK-002')
        expect(result.title).toBe('Critical')
    })

    it('includes file content when file_path exists', async () => {
        const filePath = '.project/backlog/2026-02-20-TASK-001.md'
        mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
        writeFileSync(join(TEST_ROOT, filePath), '# Task content')
        applyEvent(db, baseEvent({ taskId: 'TASK-001', filePath }))

        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect(result.content).toBe('# Task content')
    })

    it('returns null content when file does not exist', async () => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001', filePath: '.project/backlog/missing.md' }))
        const result = await tool.handler(ctx, {}) as Record<string, unknown>
        expect(result.content).toBeNull()
    })
})

describe('list_tasks', () => {
    const tool = makeTool('list_tasks')

    beforeEach(() => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001', priority: 'P1-S', title: 'A' }))
        applyEvent(db, baseEvent({ taskId: 'TASK-002', priority: 'P2-M', title: 'B' }))
        applyEvent(db, baseEvent({ taskId: 'TASK-003', priority: 'P1-M', title: 'C' }))
    })

    it('returns all tasks when no filter', async () => {
        const result = await tool.handler(ctx, {}) as unknown[]
        expect(result.length).toBe(3)
    })

    it('respects limit', async () => {
        const result = await tool.handler(ctx, { limit: 2 }) as unknown[]
        expect(result.length).toBe(2)
    })

    it('filters by status', async () => {
        applyEvent(db, makeStatusChange('TASK-001', 'in-progress'))
        const result = await tool.handler(ctx, { status: 'in-progress' }) as unknown[]
        expect(result.length).toBe(1)
        expect((result[0] as Record<string, unknown>).id).toBe('TASK-001')
    })

    it('returns tasks ordered by priority', async () => {
        const result = await tool.handler(ctx, {}) as Array<Record<string, unknown>>
        expect(result[0].id).toBe('TASK-001') // P1-S
        expect(result[1].id).toBe('TASK-003') // P1-M
        expect(result[2].id).toBe('TASK-002') // P2-M
    })
})

describe('get_task', () => {
    const tool = makeTool('get_task')

    it('returns error for unknown task', async () => {
        const result = await tool.handler(ctx, { taskId: 'TASK-999' }) as Record<string, unknown>
        expect(result.error).toContain('TASK-999')
    })

    it('returns task with comments', async () => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001' }))
        const comment: TaskCommentAddedEvent = {
            id: 'comment-1',
            type: 'task.comment_added',
            timestamp: new Date().toISOString(),
            actor: 'dev@example.com',
            taskId: 'TASK-001',
            text: 'Great progress!',
        }
        applyEvent(db, comment)

        const result = await tool.handler(ctx, { taskId: 'TASK-001' }) as Record<string, unknown>
        expect(result.id).toBe('TASK-001')
        expect(Array.isArray(result.comments)).toBe(true)
        expect((result.comments as unknown[]).length).toBe(1)
    })

    it('includes file content when available', async () => {
        const filePath = '.project/backlog/task.md'
        mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
        writeFileSync(join(TEST_ROOT, filePath), '# My Task')
        applyEvent(db, baseEvent({ taskId: 'TASK-001', filePath }))

        const result = await tool.handler(ctx, { taskId: 'TASK-001' }) as Record<string, unknown>
        expect(result.content).toBe('# My Task')
    })

    it('includes events array', async () => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001' }))
        // write a synthetic events.jsonl so readEventsForTask has something
        mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
        writeFileSync(
            join(TEST_ROOT, '.project/events.jsonl'),
            JSON.stringify({ id: 'e1', type: 'task.created', timestamp: new Date().toISOString(), actor: 'test', taskId: 'TASK-001', title: 'x', taskType: 'feat', priority: 'P1-S', filePath: null }) + '\n'
        )
        const result = await tool.handler(ctx, { taskId: 'TASK-001' }) as Record<string, unknown>
        expect(Array.isArray(result.events)).toBe(true)
    })
})

describe('get_blockers', () => {
    const tool = makeTool('get_blockers')

    it('returns empty array when no blocked tasks', async () => {
        const result = await tool.handler(ctx, {}) as unknown[]
        expect(result).toEqual([])
    })

    it('returns blocked tasks with blockedForDays', async () => {
        applyEvent(db, baseEvent({ taskId: 'TASK-001' }))
        applyEvent(db, makeStatusChange('TASK-001', 'blocked'))

        const result = await tool.handler(ctx, {}) as Array<Record<string, unknown>>
        expect(result.length).toBe(1)
        expect(result[0].id).toBe('TASK-001')
        expect(typeof result[0].blockedForDays).toBe('number')
        expect(result[0].blockedForDays).toBeGreaterThanOrEqual(0)
    })
})

function makeDep(taskId: string, dependsOn: string): TaskDependencyAddedEvent {
    return {
        id: `dep-${Math.random().toString(36).slice(2, 8)}`,
        type: 'task.dependency_added',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        dependsOn,
    }
}

describe('get_task_graph', () => {
    const tool = makeTool('get_task_graph')

    it('returns an empty graph for a project with no tasks', () => {
        rebuild(TEST_ROOT, [])
        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.nodes).toEqual([])
        expect(result.ready).toEqual([])
    })

    it('returns the ready frontier and the blocked set', () => {
        const events: AipimEvent[] = [
            baseEvent({ taskId: 'TASK-001', id: 'e1' }),
            baseEvent({ taskId: 'TASK-002', id: 'e2' }),
            makeDep('TASK-002', 'TASK-001'),
        ]
        rebuild(TEST_ROOT, events)

        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.ready).toEqual(['TASK-001'])
        expect(result.blocked).toEqual(['TASK-002'])
    })

    it('reports cycles so a broken graph is visible', () => {
        const events: AipimEvent[] = [
            baseEvent({ taskId: 'TASK-001', id: 'e1' }),
            baseEvent({ taskId: 'TASK-002', id: 'e2' }),
            makeDep('TASK-001', 'TASK-002'),
            makeDep('TASK-002', 'TASK-001'),
        ]
        rebuild(TEST_ROOT, events)

        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.cycles).toEqual([['TASK-001', 'TASK-002']])
    })
})

describe('get_next_task with dependencies', () => {
    const tool = makeTool('get_next_task')

    it('skips a higher-priority task that is still blocked', () => {
        const events: AipimEvent[] = [
            baseEvent({ taskId: 'TASK-001', id: 'e1', priority: 'P2-M' }),
            baseEvent({ taskId: 'TASK-002', id: 'e2', priority: 'P1-S' }),
            makeDep('TASK-002', 'TASK-003'),
            baseEvent({ taskId: 'TASK-003', id: 'e3', priority: 'P3' }),
        ]
        rebuild(TEST_ROOT, events)

        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.id).toBe('TASK-001')
    })

    it('returns the blocked task once its dependency is done', () => {
        const events: AipimEvent[] = [
            baseEvent({ taskId: 'TASK-002', id: 'e2', priority: 'P1-S' }),
            baseEvent({ taskId: 'TASK-003', id: 'e3', priority: 'P3' }),
            makeDep('TASK-002', 'TASK-003'),
            makeStatusChange('TASK-003', 'done'),
        ]
        rebuild(TEST_ROOT, events)

        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.id).toBe('TASK-002')
    })

    it('reports that everything left is blocked when nothing is ready', () => {
        const events: AipimEvent[] = [
            baseEvent({ taskId: 'TASK-001', id: 'e1' }),
            makeDep('TASK-001', 'TASK-999'),
        ]
        rebuild(TEST_ROOT, events)

        const result = tool.handler(ctx, {}) as Record<string, unknown>

        expect(result.blockedTasks).toEqual(['TASK-001'])
        expect(typeof result.message).toBe('string')
    })
})
