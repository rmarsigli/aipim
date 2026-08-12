import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { EventEmitter } from 'events'
import { writeFileSync } from 'fs'
import { existsSync } from 'fs'
import Database from 'better-sqlite3'
import {
    queryTasks,
    getTask,
    getCommentsForTask,
    getDecisions,
    getStats,
    applyEvent,
    queryDiscoverySessions,
    getDiscoveryStates,
    getChangesetsForSession
} from '../core/db.js'
import { appendEvent, readEvents, readEventsForTask } from '../core/events.js'
import { loadTaskGraph } from '../core/graph.js'
import { loadDiscovery } from '../core/discovery.js'
import { parseChangeset } from '../core/changeset.js'
import { loadConfig } from '../core/team.js'
import { validatePath, SecurityError } from '../utils/path-validator.js'
import { AipimEvent, EVENT_TYPES } from '../types/index.js'
import { readFileSafe } from './tools/read.js'

// Module-level emitter shared between POST /api/events and GET /api/events/stream
export const apiEventEmitter = new EventEmitter()
// Prevent memory-leak warnings when many SSE clients connect
apiEventEmitter.setMaxListeners(100)

const VALID_EVENT_TYPES = new Set<string>(EVENT_TYPES)

export function registerApiRoutes(app: Hono, db: Database.Database, projectRoot: string): void {
    // CORS for local UI development
    app.use(
        '/api/*',
        cors({
            origin: (origin) => {
                if (!origin) return '*'
                try {
                    const { hostname } = new URL(origin)
                    if (hostname === 'localhost' || hostname === '127.0.0.1') return origin
                } catch {
                    // ignore malformed origin
                }
                return null
            },
            allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
            allowHeaders: ['Content-Type']
        })
    )

    // GET /api/tasks
    app.get('/api/tasks', (c) => {
        const { status, assignee, priority } = c.req.query()
        const tasks = queryTasks(db, {
            status: status || undefined,
            assignee: assignee || undefined,
            priority: priority || undefined
        })
        return c.json(tasks)
    })

    // GET /api/tasks/:id
    app.get('/api/tasks/:id', (c) => {
        const task = getTask(db, c.req.param('id'))
        if (!task) return c.json({ error: 'Not found' }, 404)
        const content = readFileSafe(projectRoot, task.file_path)
        const comments = getCommentsForTask(db, task.id)
        return c.json({ ...task, content, comments })
    })

    // POST /api/events
    app.post('/api/events', async (c) => {
        let partial: Omit<AipimEvent, 'id' | 'timestamp' | 'actor'>
        try {
            partial = await c.req.json()
        } catch {
            return c.json({ error: 'Invalid JSON body' }, 400)
        }

        if (!partial || typeof partial.type !== 'string') {
            return c.json({ error: 'Missing required field: type' }, 400)
        }

        if (!VALID_EVENT_TYPES.has(partial.type)) {
            return c.json({ error: `Invalid event type: ${partial.type}` }, 400)
        }

        const event = await appendEvent(projectRoot, partial)
        applyEvent(db, event)
        apiEventEmitter.emit('event', event)

        return c.json(event, 201)
    })

    // GET /api/events — paginated history
    app.get('/api/events', (c) => {
        const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 500)
        const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0)

        const all = readEvents(projectRoot)
        const total = all.length
        const page = all.slice(offset, offset + limit)

        return c.json({ events: page, total, limit, offset })
    })

    // GET /api/events/stream — SSE real-time feed
    app.get('/api/events/stream', (c) => {
        return streamSSE(c, async (stream) => {
            const handler = (event: AipimEvent): void => {
                void stream.writeSSE({ data: JSON.stringify(event), event: event.type })
            }

            apiEventEmitter.on('event', handler)

            c.req.raw.signal.addEventListener('abort', () => {
                apiEventEmitter.off('event', handler)
            })

            // Keep-alive ping every 30 seconds
            while (!c.req.raw.signal.aborted) {
                await stream.sleep(30000)
                if (!c.req.raw.signal.aborted) {
                    void stream.writeSSE({ data: '', event: 'ping' })
                }
            }

            apiEventEmitter.off('event', handler)
        })
    })

    // GET /api/stats
    app.get('/api/stats', (c) => {
        return c.json(getStats(db))
    })

    // GET /api/graph — dependency graph with the ready frontier and cycles
    app.get('/api/graph', (c) => {
        return c.json(loadTaskGraph(db))
    })

    // GET /api/team
    app.get('/api/team', (c) => {
        const config = loadConfig(projectRoot)
        return c.json(config?.team ?? [])
    })

    // GET /api/decisions
    app.get('/api/decisions', (c) => {
        return c.json(getDecisions(db))
    })

    // GET /api/decisions/:id
    app.get('/api/decisions/:id', (c) => {
        const all = getDecisions(db)
        const decision = all.find((d) => d.id === c.req.param('id'))
        if (!decision) return c.json({ error: 'Not found' }, 404)
        const content = readFileSafe(projectRoot, decision.file_path)
        return c.json({ ...decision, content })
    })

    // GET /api/discoveries — brainstorm sessions, most recently touched first
    app.get('/api/discoveries', (c) => {
        const status = c.req.query('status')
        return c.json(queryDiscoverySessions(db, status ? { status } : undefined))
    })

    // GET /api/discoveries/:id — session with its distilled state and proposals
    app.get('/api/discoveries/:id', (c) => {
        const sessionId = c.req.param('id')
        const loaded = loadDiscovery(db, sessionId)
        if (!loaded) return c.json({ error: 'Not found' }, 404)

        const changesets = getChangesetsForSession(db, sessionId).map((row) => ({
            id: row.id,
            status: row.status,
            proposedAt: row.proposed_at,
            resolvedAt: row.resolved_at,
            changeset: parseChangeset(row)
        }))

        return c.json({
            ...loaded.session,
            version: loaded.version,
            state: loaded.state,
            history: getDiscoveryStates(db, sessionId).map((row) => ({
                version: row.version,
                createdAt: row.created_at
            })),
            changesets
        })
    })

    // GET /api/tasks/:id/events — events related to a specific task
    app.get('/api/tasks/:id/events', (c) => {
        const taskId = c.req.param('id')
        const events = readEventsForTask(projectRoot, taskId)
        return c.json(events)
    })

    // PUT /api/tasks/:id/content — overwrite the task's .md file
    app.put('/api/tasks/:id/content', async (c) => {
        const taskId = c.req.param('id')
        const task = getTask(db, taskId)
        if (!task) return c.json({ error: 'Not found' }, 404)
        if (!task.file_path) return c.json({ error: 'Task has no associated file' }, 422)

        let body: { content?: unknown }
        try {
            body = await c.req.json()
        } catch {
            return c.json({ error: 'Invalid JSON body' }, 400)
        }

        if (typeof body.content !== 'string') {
            return c.json({ error: 'Missing required field: content (string)' }, 400)
        }

        let fullPath: string
        try {
            fullPath = validatePath(task.file_path, projectRoot)
        } catch (err) {
            if (err instanceof SecurityError) return c.json({ error: 'Invalid file path' }, 403)
            throw err
        }

        if (!existsSync(fullPath)) return c.json({ error: 'File not found on disk' }, 404)

        try {
            writeFileSync(fullPath, body.content, 'utf8')
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code
            if (code === 'EACCES') return c.json({ error: 'Permission denied' }, 403)
            return c.json({ error: 'Failed to write file' }, 500)
        }

        return c.json({ ok: true })
    })
}
