import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Hono } from 'hono'
import { openDb, rebuild, applyEvent, getTask } from '../../src/core/db.js'
import { registerApiRoutes } from '../../src/mcp/api.js'
import type { TaskCreatedEvent } from '../../src/types/index.js'
import { startDiscovery, recordDiscoveryState } from '../../src/core/discovery.js'
import { proposeChangeset } from '../../src/core/changeset.js'
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

// ─── PUT /api/tasks/:id/content ───────────────────────────────────────────────

describe('PUT /api/tasks/:id/content', () => {
    it('returns 404 for unknown task', async () => {
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks/TASK-999/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '# Updated' })
            })
        )
        expect(res.status).toBe(404)
    })

    it('returns 400 when content field is missing', async () => {
        seedTask(db, 'TASK-001')
        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks/TASK-001/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
        )
        expect(res.status).toBe(400)
    })

    it('writes content to disk and returns ok', async () => {
        const filePath = '.project/backlog/TASK-001.md'
        writeFileSync(join(TEST_ROOT, filePath), '# Original', 'utf8')
        seedTask(db, 'TASK-001', filePath)

        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks/TASK-001/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '# Updated content' })
            })
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as { ok: boolean }
        expect(body.ok).toBe(true)
    })

    it('rejects path traversal in file_path', async () => {
        // Seed a task whose file_path escapes the project root
        seedTask(db, 'TASK-001', '../../etc/passwd')

        const res = await buildApp(db).fetch(
            new Request('http://localhost/api/tasks/TASK-001/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'pwned' })
            })
        )
        expect(res.status).toBe(403)
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

describe('GET /api/graph', () => {
    it('returns an empty graph for a fresh project', async () => {
        const res = await buildApp(db).request('/api/graph')

        expect(res.status).toBe(200)
        const body = (await res.json()) as Record<string, unknown>
        expect(body.nodes).toEqual([])
        expect(body.ready).toEqual([])
    })

    it('returns the ready frontier and blocked set', async () => {
        seedTask(db, 'TASK-001')
        seedTask(db, 'TASK-002')
        applyEvent(db, {
            id: 'dep-1',
            type: 'task.dependency_added',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-002',
            dependsOn: 'TASK-001',
        })

        const res = await buildApp(db).request('/api/graph')
        const body = (await res.json()) as Record<string, unknown>

        expect(body.ready).toEqual(['TASK-001'])
        expect(body.blocked).toEqual(['TASK-002'])
    })
})

// ─── GET /api/discoveries ────────────────────────────────────────────────────

describe('GET /api/discoveries', () => {
    it('returns empty array when no session exists', async () => {
        const res = await buildApp(db).request('/api/discoveries')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([])
    })

    it('lists sessions most recently touched first', async () => {
        const first = await startDiscovery(TEST_ROOT, db, 'older')
        await startDiscovery(TEST_ROOT, db, 'newer')
        await recordDiscoveryState(TEST_ROOT, db, first.sessionId, { problem: 'touched last' })

        const res = await buildApp(db).request('/api/discoveries')
        const sessions = (await res.json()) as Array<{ id: string; topic: string }>

        expect(sessions.map((s) => s.id)).toEqual(['D001', 'D002'])
        expect(sessions[0].topic).toBe('older')
    })

    it('filters by status', async () => {
        await startDiscovery(TEST_ROOT, db, 'still open')

        const res = await buildApp(db).request('/api/discoveries?status=applied')
        expect(await res.json()).toEqual([])
    })
})

// ─── GET /api/discoveries/:id ────────────────────────────────────────────────

describe('GET /api/discoveries/:id', () => {
    it('returns 404 for an unknown session', async () => {
        const res = await buildApp(db).request('/api/discoveries/D999')
        expect(res.status).toBe(404)
    })

    it('returns the distilled state with its version history', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'the session')
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'v1' })
        await recordDiscoveryState(TEST_ROOT, db, sessionId, {
            problem: 'v2',
            alternatives: [{ option: 'granular events', rejectedBecause: 'no query needs them' }]
        })

        const res = await buildApp(db).request(`/api/discoveries/${sessionId}`)
        const body = (await res.json()) as Record<string, any>

        expect(body.topic).toBe('the session')
        expect(body.version).toBe(2)
        expect(body.state.problem).toBe('v2')
        expect(body.state.alternatives).toHaveLength(1)
        expect(body.history.map((h: { version: number }) => h.version)).toEqual([1, 2])
    })

    it('includes the proposed changeset', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'with a proposal')
        await proposeChangeset(TEST_ROOT, db, sessionId, {
            tasks: [{ localId: '#1', title: 'Build', taskType: 'feat', priority: 'P2-M', estimatedHours: 4 }]
        })

        const res = await buildApp(db).request(`/api/discoveries/${sessionId}`)
        const body = (await res.json()) as Record<string, any>

        expect(body.changesets).toHaveLength(1)
        expect(body.changesets[0].status).toBe('proposed')
        expect(body.changesets[0].changeset.tasks[0].title).toBe('Build')
    })
})
