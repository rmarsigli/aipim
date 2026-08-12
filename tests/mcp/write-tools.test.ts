import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { openDb, rebuild, applyEvent, getTask, queryTasks, getChecksForTask, getDependencies } from '../../src/core/db.js'
import { writeTools } from '../../src/mcp/tools/write.js'
import type { ToolContext } from '../../src/mcp/tools/index.js'
import type { TaskCreatedEvent } from '../../src/types/index.js'
import Database from 'better-sqlite3'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/write-tools-test')

function makeTool(name: string) {
    const tool = writeTools.find((t) => t.schema.name === name)
    if (!tool) throw new Error(`Tool ${name} not found`)
    return tool
}

function seedTask(db: Database.Database, taskId: string, overrides: Partial<TaskCreatedEvent> = {}): void {
    const evt: TaskCreatedEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'task.created',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        title: `Task ${taskId}`,
        taskType: 'feat',
        priority: 'P1-S',
        filePath: `.project/backlog/${taskId}.md`,
        ...overrides,
    }
    applyEvent(db, evt)
}

let db: Database.Database
let ctx: ToolContext

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
    // Ensure events.jsonl directory exists
    writeFileSync(join(TEST_ROOT, '.project/events.jsonl'), '', 'utf8')
    // Use the real schema so these tests never drift from src/core/db.ts
    rebuild(TEST_ROOT, [])
    db = openDb(TEST_ROOT)
    ctx = { db, projectRoot: TEST_ROOT, events: [] }
})

afterEach(() => {
    db.close()
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('complete_task', () => {
    const tool = makeTool('complete_task')

    it('throws when task does not exist', async () => {
        await expect(tool.handler(ctx, { taskId: 'TASK-999' })).rejects.toThrow('TASK-999 not found')
    })

    it('marks task as done in SQLite', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001' })
        const updated = getTask(db, 'TASK-001')
        expect(updated?.status).toBe('done')
    })

    it('returns success with completedAt', async () => {
        seedTask(db, 'TASK-001')
        const result = (await tool.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>
        expect(result.success).toBe(true)
        expect(result.taskId).toBe('TASK-001')
        expect(typeof result.completedAt).toBe('string')
    })

    it('moves .md file to completed/ when it exists', async () => {
        const filePath = `.project/backlog/TASK-001.md`
        writeFileSync(join(TEST_ROOT, filePath), '# Task')
        seedTask(db, 'TASK-001', { filePath })

        const result = (await tool.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>
        expect(result.fileMoved).toBeTruthy()
        expect(existsSync(join(TEST_ROOT, filePath))).toBe(false)
        expect(existsSync(join(TEST_ROOT, result.fileMoved as string))).toBe(true)
    })

    it('returns fileMoved=null when task has no file', async () => {
        const evt: TaskCreatedEvent = {
            id: 'e1',
            type: 'task.created',
            timestamp: new Date().toISOString(),
            actor: 'test',
            taskId: 'TASK-002',
            title: 'No file task',
            taskType: 'chore',
            priority: 'P3',
            filePath: '',
        }
        applyEvent(db, evt)
        // Manually clear file_path in db
        db.prepare('UPDATE tasks SET file_path = NULL WHERE id = ?').run('TASK-002')

        const result = (await tool.handler(ctx, { taskId: 'TASK-002' })) as Record<string, unknown>
        expect(result.fileMoved).toBeNull()
    })

    it('appends event to events.jsonl', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', notes: 'All done', actualHours: 3 })
        const content = readFileSync(join(TEST_ROOT, '.project/events.jsonl'), 'utf8')
        const events = content.trim().split('\n').map(JSON.parse)
        const completedEvt = events.find((e: { type: string }) => e.type === 'task.completed')
        expect(completedEvt).toBeDefined()
        expect(completedEvt.notes).toBe('All done')
        expect(completedEvt.actualHours).toBe(3)
    })
})

describe('update_task_status', () => {
    const tool = makeTool('update_task_status')

    it('throws when task does not exist', async () => {
        await expect(tool.handler(ctx, { taskId: 'TASK-999', status: 'in-progress' })).rejects.toThrow(
            'TASK-999 not found'
        )
    })

    it('updates task status', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', status: 'in-progress' })
        expect(getTask(db, 'TASK-001')?.status).toBe('in-progress')
    })

    it('returns from/to', async () => {
        seedTask(db, 'TASK-001')
        const result = (await tool.handler(ctx, { taskId: 'TASK-001', status: 'blocked' })) as Record<string, unknown>
        expect(result.from).toBe('backlog')
        expect(result.to).toBe('blocked')
    })

    it('adds reason as comment when provided', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', status: 'blocked', reason: 'Waiting for API' })
        const rows = db.prepare('SELECT * FROM comments WHERE task_id = ?').all('TASK-001') as Array<{ text: string }>
        expect(rows.length).toBe(1)
        expect(rows[0].text).toContain('Waiting for API')
    })

    it('does not add comment when reason is absent', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', status: 'review' })
        const rows = db.prepare('SELECT * FROM comments WHERE task_id = ?').all('TASK-001')
        expect(rows.length).toBe(0)
    })
})

describe('add_comment', () => {
    const tool = makeTool('add_comment')

    it('throws when task does not exist', async () => {
        await expect(tool.handler(ctx, { taskId: 'TASK-999', text: 'hello' })).rejects.toThrow('TASK-999 not found')
    })

    it('inserts comment into SQLite', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', text: 'Looks good!' })
        const rows = db.prepare('SELECT * FROM comments WHERE task_id = ?').all('TASK-001') as Array<{ text: string }>
        expect(rows.length).toBe(1)
        expect(rows[0].text).toBe('Looks good!')
    })

    it('returns commentId and timestamp', async () => {
        seedTask(db, 'TASK-001')
        const result = (await tool.handler(ctx, { taskId: 'TASK-001', text: 'Done' })) as Record<string, unknown>
        expect(result.success).toBe(true)
        expect(typeof result.commentId).toBe('string')
        expect(typeof result.timestamp).toBe('string')
    })
})

describe('log_decision', () => {
    const tool = makeTool('log_decision')

    it('creates ADR file in decisions/', async () => {
        const result = (await tool.handler(ctx, {
            title: 'Use SQLite',
            rationale: 'Fast and local',
        })) as Record<string, unknown>
        expect(result.success).toBe(true)
        const filePath = result.filePath as string
        expect(existsSync(join(TEST_ROOT, filePath))).toBe(true)
        expect(filePath).toContain('decisions/')
        expect(filePath).toContain('use-sqlite')
    })

    it('creates decisions dir if missing', async () => {
        rmSync(join(TEST_ROOT, '.project/decisions'), { recursive: true, force: true })
        await tool.handler(ctx, { title: 'Pick DB', rationale: 'SQLite is great' })
        expect(existsSync(join(TEST_ROOT, '.project/decisions'))).toBe(true)
    })

    it('inserts decision in SQLite', async () => {
        await tool.handler(ctx, { title: 'Use Hono', rationale: 'Lightweight' })
        const rows = db.prepare('SELECT * FROM decisions').all() as Array<{ title: string; rationale: string }>
        expect(rows.length).toBe(1)
        expect(rows[0].title).toBe('Use Hono')
        expect(rows[0].rationale).toBe('Lightweight')
    })

    it('includes taskId in ADR file when provided', async () => {
        const result = (await tool.handler(ctx, {
            title: 'Use TypeScript',
            rationale: 'Type safety',
            taskId: 'TASK-001',
        })) as Record<string, unknown>
        const content = readFileSync(join(TEST_ROOT, result.filePath as string), 'utf8')
        expect(content).toContain('TASK-001')
    })
})

describe('create_task', () => {
    const tool = makeTool('create_task')

    it('creates task file and inserts into SQLite', async () => {
        const result = (await tool.handler(ctx, {
            title: 'Add dark mode',
            taskType: 'feat',
            priority: 'P2-M',
        })) as Record<string, unknown>

        expect(result.success).toBe(true)
        expect(typeof result.taskId).toBe('string')
        expect(result.taskId).toMatch(/^TASK-\d+$/)
        expect(existsSync(join(TEST_ROOT, result.filePath as string))).toBe(true)
        const task = getTask(db, result.taskId as string)
        expect(task?.title).toBe('Add dark mode')
        expect(task?.priority).toBe('P2-M')
        expect(task?.status).toBe('backlog')
    })

    it('increments task ID from existing tasks', async () => {
        seedTask(db, 'TASK-005')
        const result = (await tool.handler(ctx, {
            title: 'Next task',
            taskType: 'chore',
            priority: 'P3',
        })) as Record<string, unknown>
        expect(result.taskId).toBe('TASK-006')
    })

    it('starts from TASK-001 when no tasks exist', async () => {
        const result = (await tool.handler(ctx, {
            title: 'First task',
            taskType: 'feat',
            priority: 'P1-S',
        })) as Record<string, unknown>
        expect(result.taskId).toBe('TASK-001')
    })

    it('includes description in file when provided', async () => {
        const result = (await tool.handler(ctx, {
            title: 'My task',
            taskType: 'fix',
            priority: 'P2-S',
            description: 'Fix the broken button',
        })) as Record<string, unknown>
        const content = readFileSync(join(TEST_ROOT, result.filePath as string), 'utf8')
        expect(content).toContain('Fix the broken button')
    })

    it('all tasks appear in list_tasks', async () => {
        await tool.handler(ctx, { title: 'Task A', taskType: 'feat', priority: 'P1-S' })
        await tool.handler(ctx, { title: 'Task B', taskType: 'fix', priority: 'P2-M' })
        const tasks = queryTasks(db)
        expect(tasks.length).toBe(2)
    })
})

describe('assign_task', () => {
    const tool = makeTool('assign_task')

    beforeEach(() => {
        // Write a config.toml with one team member
        writeFileSync(
            join(TEST_ROOT, '.project/config.toml'),
            `[project]\nname = "Test"\n\n[[team]]\nid = "alice"\nname = "Alice Smith"\nemail = "alice@example.com"\n`,
            'utf8'
        )
    })

    it('assigns a task to a known team member', async () => {
        seedTask(db, 'TASK-001')
        const result = (await tool.handler(ctx, { taskId: 'TASK-001', assignee: 'alice' })) as Record<string, unknown>
        expect(result.success).toBe(true)
        expect(result.assignee).toBe('alice')
        expect(result.assigneeName).toBe('Alice Smith')
    })

    it('updates assignee column in SQLite', async () => {
        seedTask(db, 'TASK-001')
        await tool.handler(ctx, { taskId: 'TASK-001', assignee: 'alice' })
        const row = db.prepare('SELECT assignee FROM tasks WHERE id = ?').get('TASK-001') as { assignee: string }
        expect(row.assignee).toBe('alice')
    })

    it('throws when task does not exist', async () => {
        await expect(tool.handler(ctx, { taskId: 'TASK-999', assignee: 'alice' })).rejects.toThrow('TASK-999 not found')
    })

    it('throws when assignee is not in config.toml', async () => {
        seedTask(db, 'TASK-001')
        await expect(tool.handler(ctx, { taskId: 'TASK-001', assignee: 'unknown' })).rejects.toThrow(
            'not found in config.toml'
        )
    })
})

function writeChecksConfig(commands: string[]): void {
    const list = commands.map((c) => JSON.stringify(c)).join(', ')
    writeFileSync(
        join(TEST_ROOT, '.project/config.toml'),
        `[project]\nname = "Test"\n\n[checks]\ncommands = [${list}]\n`,
        'utf8'
    )
}

const PASSING = 'node -e "process.exit(0)"'
const FAILING = 'node -e "process.exit(1)"'

describe('verify_task', () => {
    const tool = makeTool('verify_task')

    it('throws when the task does not exist', async () => {
        await expect(tool.handler(ctx, { taskId: 'TASK-999' })).rejects.toThrow('TASK-999 not found')
    })

    it('reports nothing to run when no checks are configured', async () => {
        seedTask(db, 'TASK-001')

        const result = (await tool.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>

        expect(result.results).toEqual([])
        expect(result.allPassed).toBe(true)
    })

    it('records a passing check as evidence', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([PASSING])

        const result = (await tool.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>

        expect(result.allPassed).toBe(true)
        const checks = getChecksForTask(db, 'TASK-001')
        expect(checks).toHaveLength(1)
        expect(checks[0].passed).toBe(true)
        expect(checks[0].command).toBe(PASSING)
    })

    it('records a failing check with its exit code', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([FAILING])

        const result = (await tool.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>

        expect(result.allPassed).toBe(false)
        const checks = getChecksForTask(db, 'TASK-001')
        expect(checks[0].passed).toBe(false)
        expect(checks[0].exit_code).toBe(1)
    })

    it('appends a check.run event to the log', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([PASSING])

        await tool.handler(ctx, { taskId: 'TASK-001' })

        const content = readFileSync(join(TEST_ROOT, '.project/events.jsonl'), 'utf8')
        const events = content.trim().split('\n').map((l) => JSON.parse(l))
        const checkEvt = events.find((e: { type: string }) => e.type === 'check.run')
        expect(checkEvt).toBeDefined()
        expect(checkEvt.taskId).toBe('TASK-001')
        expect(checkEvt.passed).toBe(true)
    })

    it('runs an explicit command list instead of the configured one', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([FAILING])

        const result = (await tool.handler(ctx, { taskId: 'TASK-001', commands: [PASSING] })) as Record<string, unknown>

        expect(result.allPassed).toBe(true)
        expect(getChecksForTask(db, 'TASK-001').map((c) => c.command)).toEqual([PASSING])
    })

    it('runs every configured command even when an earlier one fails', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([FAILING, PASSING])

        await tool.handler(ctx, { taskId: 'TASK-001' })

        expect(getChecksForTask(db, 'TASK-001')).toHaveLength(2)
    })
})

describe('complete_task verification gate', () => {
    const complete = makeTool('complete_task')
    const verify = makeTool('verify_task')

    it('refuses to complete when a required check never ran', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([PASSING])

        await expect(complete.handler(ctx, { taskId: 'TASK-001' })).rejects.toThrow('verification gate')
        expect(getTask(db, 'TASK-001')?.status).not.toBe('done')
    })

    it('refuses to complete when a required check failed', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([FAILING])
        await verify.handler(ctx, { taskId: 'TASK-001' })

        await expect(complete.handler(ctx, { taskId: 'TASK-001' })).rejects.toThrow('verification gate')
    })

    it('completes when every required check passed', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([PASSING])
        ctx.events = [
            {
                id: 'seed',
                type: 'task.created',
                timestamp: '2020-01-01T00:00:00.000Z',
                actor: 'test',
                taskId: 'TASK-001',
                title: 'T',
                taskType: 'feat',
                priority: 'P1-S',
                filePath: '',
            },
        ]
        await verify.handler(ctx, { taskId: 'TASK-001' })

        const result = (await complete.handler(ctx, { taskId: 'TASK-001' })) as Record<string, unknown>

        expect(result.success).toBe(true)
        expect(getTask(db, 'TASK-001')?.status).toBe('done')
    })

    it('completes when force is set and records the bypass', async () => {
        seedTask(db, 'TASK-001')
        writeChecksConfig([PASSING])

        const result = (await complete.handler(ctx, { taskId: 'TASK-001', force: true })) as Record<string, unknown>

        expect(result.success).toBe(true)
        expect(result.checksBypassed).toBe(true)

        const content = readFileSync(join(TEST_ROOT, '.project/events.jsonl'), 'utf8')
        const events = content.trim().split('\n').map((l) => JSON.parse(l))
        const completedEvt = events.find((e: { type: string }) => e.type === 'task.completed')
        expect(completedEvt.checksBypassed).toBe(true)
    })
})

describe('add_dependency', () => {
    const tool = makeTool('add_dependency')

    it('throws when the task does not exist', async () => {
        seedTask(db, 'TASK-001')
        await expect(tool.handler(ctx, { taskId: 'TASK-999', dependsOn: 'TASK-001' })).rejects.toThrow('TASK-999 not found')
    })

    it('throws when the dependency does not exist', async () => {
        seedTask(db, 'TASK-001')
        await expect(tool.handler(ctx, { taskId: 'TASK-001', dependsOn: 'TASK-999' })).rejects.toThrow('TASK-999 not found')
    })

    it('records the edge in the read model', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')

        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        expect(getDependencies(db, 'TASK-002')).toEqual(['TASK-001'])
    })

    it('appends a task.dependency_added event', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')

        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        const content = readFileSync(join(TEST_ROOT, '.project/events.jsonl'), 'utf8')
        const events = content.trim().split('\n').map((l) => JSON.parse(l))
        const evt = events.find((e: { type: string }) => e.type === 'task.dependency_added')
        expect(evt.taskId).toBe('TASK-002')
        expect(evt.dependsOn).toBe('TASK-001')
    })

    it('refuses a self-dependency', async () => {
        seedTask(db, 'TASK-001')

        await expect(tool.handler(ctx, { taskId: 'TASK-001', dependsOn: 'TASK-001' })).rejects.toThrow('cycle')
    })

    it('refuses an edge that would create a cycle', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')
        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        await expect(tool.handler(ctx, { taskId: 'TASK-001', dependsOn: 'TASK-002' })).rejects.toThrow('cycle')
    })

    it('is idempotent when the edge already exists', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')

        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })
        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        expect(getDependencies(db, 'TASK-002')).toEqual(['TASK-001'])
    })
})

describe('remove_dependency', () => {
    const add = makeTool('add_dependency')
    const tool = makeTool('remove_dependency')

    it('drops the edge from the read model', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')
        await add.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        await tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })

        expect(getDependencies(db, 'TASK-002')).toEqual([])
    })

    it('throws when the edge does not exist', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')

        await expect(tool.handler(ctx, { taskId: 'TASK-002', dependsOn: 'TASK-001' })).rejects.toThrow('No dependency')
    })
})
