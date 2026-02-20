import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Hono } from 'hono'
import { openDb, rebuild, applyEvent, getTask } from '../../src/core/db.js'
import { registerApiRoutes } from '../../src/mcp/api.js'
import type { TaskCreatedEvent } from '../../src/types/index.js'
import Database from 'better-sqlite3'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/api-test')

function seedTask(db: Database.Database, taskId: string, filePath?: string): void {
    const evt: TaskCreatedEvent = {
        id: `evt-${taskId}`,
        type: 'task.created',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        title: `Task ${taskId}`,
        taskType: 'feat',
        priority: 'P1-S',
        filePath: filePath ?? `.project/backlog/${taskId}.md`
    }
    applyEvent(db, evt)
}

function buildApp(db: Database.Database): Hono {
    const app = new Hono()
    registerApiRoutes(app, db, TEST_ROOT)
    return app
}

let db: Database.Database

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project/backlog'), { recursive: true })
    writeFileSync(join(TEST_ROOT, '.project/events.jsonl'), '', 'utf8')
    rebuild(TEST_ROOT, [])
    db = openDb(TEST_ROOT)
})

afterEach(() => {
    db.close()
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

// ─── GET /api/tasks ──────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
    it('returns empty array when no tasks exist', async () => {
        const res = await buildApp(db).fetch(new Request('http://localhost/api/tasks'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as unknown[]
        expect(Array.isArray(body)).toBe(true)
        expect(body.length).toBe(0)
    })

    it('returns seeded tasks', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')
        const res = await buildApp(db).fetch(new Request('http://localhost/api/tasks'))
        const body = (await res.json()) as unknown[]
        expect(body.length).toBe(2)
    })

    it('filters by status query param', async () => {
        seedTask(db, 'TASK-001')
        db.prepare("UPDATE tasks SET status = 'in-progress' WHERE id = 'TASK-001'").run()
        seedTask(db, 'TASK-002')

        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks?status=in-progress')
        )
        const body = (await res.json()) as Array<{ id: string }>
        expect(body.length).toBe(1)
        expect(body[0].id).toBe('TASK-001')
    })
})

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────

describe('GET /api/tasks/:id', () => {
    it('returns 404 for unknown task', async () => {
        const res = await buildApp(db).fetch(new Request('http://localhost/api/tasks/TASK-999'))
        expect(res.status).toBe(404)
        const body = (await res.json()) as { error: string }
        expect(body.error).toBe('Not found')
    })

    it('returns task with comments and null content when no file', async () => {
        seedTask(db, 'TASK-001')
        const res = await buildApp(db).fetch(new Request('http://localhost/api/tasks/TASK-001'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as { id: string; comments: unknown[]; content: unknown }
        expect(body.id).toBe('TASK-001')
        expect(Array.isArray(body.comments)).toBe(true)
        expect(body.content).toBeNull()
    })

    it('returns markdown content when file exists', async () => {
        const filePath = `.project/backlog/TASK-001.md`
        const fullPath = join(TEST_ROOT, filePath)
        writeFileSync(fullPath, '# Task content', 'utf8')
        seedTask(db, 'TASK-001', filePath)

        const res = await buildApp(db).fetch(new Request('http://localhost/api/tasks/TASK-001'))
        const body = (await res.json()) as { content: string }
        expect(body.content).toBe('# Task content')
    })
})

// ─── POST /api/events ─────────────────────────────────────────────────────────

describe('POST /api/events', () => {
    it('returns 400 for invalid JSON', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-json'
            })
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when type field is missing', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: 'TASK-001' })
            })
        )
        expect(res.status).toBe(400)
        const body = (await res.json()) as { error: string }
        expect(body.error).toContain('type')
    })

    it('persists a task.created event and returns 201', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'task.created',
                    taskId: 'TASK-001',
                    title: 'New task',
                    taskType: 'feat',
                    priority: 'P1-S',
                    filePath: '.project/backlog/TASK-001.md'
                })
            })
        )
        expect(res.status).toBe(201)
        const event = (await res.json()) as { id: string; type: string }
        expect(event.type).toBe('task.created')
        expect(typeof event.id).toBe('string')
        // SQLite should reflect the new task
        expect(getTask(db, 'TASK-001')).not.toBeUndefined()
    })
})

// ─── GET /api/events ──────────────────────────────────────────────────────────

describe('GET /api/events', () => {
    it('returns events with pagination metadata', async () => {
        const res = await buildApp(db).fetch(new Request('http://localhost/api/events'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as { events: unknown[]; total: number; limit: number; offset: number }
        expect(Array.isArray(body.events)).toBe(true)
        expect(typeof body.total).toBe('number')
        expect(body.limit).toBe(50)
        expect(body.offset).toBe(0)
    })

    it('respects limit and offset query params', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/events?limit=10&offset=5')
        )
        const body = (await res.json()) as { limit: number; offset: number }
        expect(body.limit).toBe(10)
        expect(body.offset).toBe(5)
    })

    it('caps limit at 500', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/events?limit=9999')
        )
        const body = (await res.json()) as { limit: number }
        expect(body.limit).toBe(500)
    })
})

// ─── GET /api/stats ───────────────────────────────────────────────────────────

describe('GET /api/stats', () => {
    it('returns object with task counts by status', async () => {
        seedTask(db, 'TASK-001')
        const res = await buildApp(db).fetch(new Request('http://localhost/api/stats'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as Record<string, number>
        expect(typeof body).toBe('object')
        expect(body.backlog).toBe(1)
    })
})

// ─── GET /api/team ────────────────────────────────────────────────────────────

describe('GET /api/team', () => {
    it('returns empty array when no config.toml', async () => {
        const res = await buildApp(db).fetch(new Request('http://localhost/api/team'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as unknown[]
        expect(Array.isArray(body)).toBe(true)
        expect(body.length).toBe(0)
    })

    it('returns team members from config.toml', async () => {
        writeFileSync(
            join(TEST_ROOT, '.project/config.toml'),
            `[project]\nname="Test"\n\n[[team]]\nid="alice"\nname="Alice"\nemail="alice@test.com"\n`,
            'utf8'
        )
        const res = await buildApp(db).fetch(new Request('http://localhost/api/team'))
        const body = (await res.json()) as Array<{ id: string }>
        expect(body.length).toBe(1)
        expect(body[0].id).toBe('alice')
    })
})

// ─── GET /api/decisions ───────────────────────────────────────────────────────

describe('GET /api/decisions', () => {
    it('returns empty array when no decisions', async () => {
        const res = await buildApp(db).fetch(new Request('http://localhost/api/decisions'))
        expect(res.status).toBe(200)
        const body = (await res.json()) as unknown[]
        expect(Array.isArray(body)).toBe(true)
    })
})

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('CORS headers', () => {
    it('allows localhost origin', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks', {
                headers: { Origin: 'http://localhost:5173' }
            })
        )
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    })

    it('blocks non-localhost origin', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks', {
                headers: { Origin: 'https://evil.com' }
            })
        )
        const corsHeader = res.headers.get('access-control-allow-origin')
        expect(corsHeader).toBeNull()
    })
})
