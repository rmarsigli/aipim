import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { openDb, applyEvent, getTask, queryTasks } from '../../src/core/db.js'
import { writeTools } from '../../src/mcp/tools/write.js'
import type { ToolContext } from '../../src/mcp/tools/index.js'
import type { TaskCreatedEvent } from '../../src/types/index.js'
import Database from 'better-sqlite3'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/write-tools-test')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, task_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'backlog', priority TEXT NOT NULL, assignee TEXT, file_path TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), actor TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, title TEXT NOT NULL, rationale TEXT NOT NULL, task_id TEXT, file_path TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events_log (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
`

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
    db = openDb(TEST_ROOT)
    db.exec(SCHEMA)
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
