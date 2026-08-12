import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDb, rebuild, applyEvent } from '../../src/core/db.js'
import { discoveryTools } from '../../src/mcp/tools/discovery.js'
import type { McpTool, ToolContext } from '../../src/mcp/tools/index.js'
import type { TaskCreatedEvent } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/discovery-tools-test')

let db: Database.Database
let ctx: ToolContext

function tool(name: string): McpTool {
    const found = discoveryTools.find((t) => t.schema.name === name)
    if (!found) throw new Error(`Tool ${name} not found`)
    return found
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return (await tool(name).handler(ctx, args)) as Record<string, unknown>
}

async function openSession(topic = 'discovery as a phase'): Promise<string> {
    return (await call('start_discovery', { topic })).sessionId as string
}

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
    rebuild(TEST_ROOT, [])
    db = openDb(TEST_ROOT)
    ctx = { db, projectRoot: TEST_ROOT, events: [] }
})

afterEach(() => {
    db.close()
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('start_discovery', () => {
    it('should open a session and hand back its ID', async () => {
        const result = await call('start_discovery', { topic: 'brainstorm' })
        expect(result.sessionId).toBe('D001')
        expect(result.otherOpenSessions).toEqual([])
    })

    it('should report already-open sessions so the caller can offer to resume', async () => {
        await call('start_discovery', { topic: 'first' })
        const second = await call('start_discovery', { topic: 'second' })

        expect(second.sessionId).toBe('D002')
        expect(second.otherOpenSessions).toEqual([expect.objectContaining({ id: 'D001', topic: 'first' })])
    })
})

describe('update_discovery_state', () => {
    it('should store a snapshot and return its version', async () => {
        const sessionId = await openSession()

        const first = await call('update_discovery_state', { sessionId, state: { problem: 'no home for ideas' } })
        const second = await call('update_discovery_state', { sessionId, state: { problem: 'sharper now' } })

        expect(first.version).toBe(1)
        expect(second.version).toBe(2)
    })

    it('should reject an unknown session', async () => {
        const result = await call('update_discovery_state', { sessionId: 'D999', state: {} })
        expect(result.error).toContain('D999')
        expect(result.success).toBeUndefined()
    })

    it('should normalise a malformed state rather than fail the turn', async () => {
        const sessionId = await openSession()
        const result = await call('update_discovery_state', { sessionId, state: { agreements: 'not an array' } })

        expect(result.success).toBe(true)
        const state = (await call('get_discovery_state', { sessionId })).state as Record<string, unknown>
        expect(state.agreements).toEqual([])
    })
})

describe('get_discovery_state', () => {
    it('should return enough to resume with no chat history', async () => {
        const sessionId = await openSession('discovery as a phase')
        await call('update_discovery_state', {
            sessionId,
            state: {
                problem: 'AIPIM starts at the task',
                agreements: [{ statement: 'changeset, not spec', rationale: 'greenfield degenerates for free' }],
                alternatives: [{ option: 'granular note events', rejectedBecause: 'buys no query anyone makes' }],
                assumptions: [{ question: 'which harness first?', assumed: 'claude-code', critical: false }],
                openThreads: ['how does the UI render a diff?']
            }
        })

        const result = await call('get_discovery_state', { sessionId })
        const state = result.state as Record<string, unknown>

        expect(result.topic).toBe('discovery as a phase')
        expect(result.status).toBe('open')
        expect(result.version).toBe(1)
        expect(state.problem).toBe('AIPIM starts at the task')
        expect(state.agreements).toHaveLength(1)
        expect(state.alternatives).toHaveLength(1)
        expect(state.assumptions).toHaveLength(1)
        expect(state.openThreads).toEqual(['how does the UI render a diff?'])
    })

    it('should fall back to the most recently touched open session', async () => {
        const first = await openSession('older')
        await openSession('newer')
        await call('update_discovery_state', { sessionId: first, state: { problem: 'touched last' } })

        expect((await call('get_discovery_state')).sessionId).toBe(first)
    })

    it('should report plainly when nothing is open', async () => {
        const result = await call('get_discovery_state')
        expect(result.message).toContain('No open discovery session')
    })

    it('should error on an unknown session', async () => {
        expect((await call('get_discovery_state', { sessionId: 'D999' })).error).toContain('D999')
    })
})

describe('propose_changeset', () => {
    it('should record a proposal and report validation', async () => {
        const sessionId = await openSession()
        const result = await call('propose_changeset', {
            sessionId,
            changeset: { tasks: [{ localId: '#1', title: 'Build it', taskType: 'feat', priority: 'P2-M' }] }
        })

        expect(result.success).toBe(true)
        expect(result.changesetId).toBe(`${sessionId}-CS1`)
        expect(result.validation).toEqual({ valid: true, errors: [] })
    })

    it('should refuse a proposal outside a session, which is what keeps discovery from self-starting', async () => {
        const result = await call('propose_changeset', { sessionId: 'D999', changeset: {} })
        expect(result.error).toContain('D999')
        expect(result.success).toBeUndefined()
    })

    it('should refuse a proposal on a session already resolved', async () => {
        const sessionId = await openSession()
        await call('propose_changeset', { sessionId, changeset: {} })
        await call('resolve_changeset', { sessionId, resolution: 'abandoned' })

        const result = await call('propose_changeset', { sessionId, changeset: {} })
        expect(result.error).toContain('already abandoned')
    })

    it('should report validation problems without refusing to record them', async () => {
        const sessionId = await openSession()
        const result = await call('propose_changeset', {
            sessionId,
            changeset: { dependencies: [{ taskRef: '#1', dependsOnRef: '#2' }] }
        })

        expect(result.success).toBe(true)
        expect((result.validation as { valid: boolean }).valid).toBe(false)
    })
})

describe('resolve_changeset', () => {
    async function proposeSimple(sessionId: string): Promise<string> {
        const result = await call('propose_changeset', {
            sessionId,
            changeset: {
                tasks: [
                    { localId: '#1', title: 'Schema', taskType: 'feat', priority: 'P1-M', estimatedHours: 3 },
                    { localId: '#2', title: 'Core logic', taskType: 'feat', priority: 'P1-M', estimatedHours: 6 }
                ],
                dependencies: [{ taskRef: '#2', dependsOnRef: '#1' }],
                decisions: [{ title: 'Event sourced', rationale: 'history for free' }]
            }
        })
        return result.changesetId as string
    }

    it('should apply the whole changeset atomically', async () => {
        const sessionId = await openSession()
        await proposeSimple(sessionId)

        const result = await call('resolve_changeset', { sessionId, resolution: 'applied' })
        const applied = result.applied as Record<string, unknown>

        expect(result.success).toBe(true)
        expect(applied.eventCount).toBe(5)
        expect((applied.tasks as Array<{ taskId: string }>).map((t) => t.taskId)).toEqual(['TASK-001', 'TASK-002'])
    })

    it('should refuse to apply an invalid changeset', async () => {
        const sessionId = await openSession()
        await call('propose_changeset', {
            sessionId,
            changeset: { dependencies: [{ taskRef: 'TASK-404', dependsOnRef: 'TASK-405' }] }
        })

        const result = await call('resolve_changeset', { sessionId, resolution: 'applied' })
        expect(result.error).toContain('cannot be applied')
        expect((result.errors as string[]).length).toBeGreaterThan(0)
    })

    it('should leave nothing behind when it refuses', async () => {
        const sessionId = await openSession()
        await call('propose_changeset', {
            sessionId,
            changeset: {
                tasks: [{ localId: '#1', title: 'Would be created', taskType: 'feat', priority: 'P2-M' }],
                dependencies: [{ taskRef: '#1', dependsOnRef: '#404' }]
            }
        })
        await call('resolve_changeset', { sessionId, resolution: 'applied' })

        expect(db.prepare('SELECT COUNT(*) AS count FROM tasks').get()).toEqual({ count: 0 })
    })

    it('should reopen the session for revision and accept a new proposal', async () => {
        const sessionId = await openSession()
        const first = await proposeSimple(sessionId)

        await call('resolve_changeset', { sessionId, resolution: 'revision_requested' })
        const second = await call('propose_changeset', {
            sessionId,
            changeset: { tasks: [{ localId: '#1', title: 'Reworked', taskType: 'feat', priority: 'P2-M' }] }
        })

        expect(second.changesetId).not.toBe(first)
        expect((await call('get_discovery_state', { sessionId })).status).toBe('proposed')
    })

    it('should surface the current proposal when resuming', async () => {
        const sessionId = await openSession()
        const changesetId = await proposeSimple(sessionId)

        const resumed = await call('get_discovery_state', { sessionId })
        const proposed = resumed.proposedChangeset as Record<string, unknown>

        expect(proposed.changesetId).toBe(changesetId)
        expect((proposed.changeset as { tasks: unknown[] }).tasks).toHaveLength(2)
    })

    it('should error when there is nothing proposed to apply', async () => {
        const sessionId = await openSession()
        expect((await call('resolve_changeset', { sessionId, resolution: 'applied' })).error).toContain(
            'No proposed changeset'
        )
    })

    it('should refuse a changeset belonging to another session', async () => {
        const first = await openSession('first')
        const changesetId = await proposeSimple(first)
        const second = await openSession('second')

        const result = await call('resolve_changeset', { sessionId: second, changesetId, resolution: 'applied' })
        expect(result.error).toContain('does not belong')
    })
})

describe('find_related', () => {
    beforeEach(() => {
        const event: TaskCreatedEvent = {
            id: 'evt-1',
            type: 'task.created',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-035',
            title: 'Derive productivity metrics from the event log',
            taskType: 'feat',
            priority: 'P2-M',
            filePath: '.project/backlog/TASK-035.md'
        }
        applyEvent(db, event)
    })

    it('should surface an existing task that overlaps the idea', async () => {
        const result = await call('find_related', { query: 'productivity metrics from events' })
        expect((result.matches as Array<{ id: string }>).map((m) => m.id)).toContain('TASK-035')
    })

    it('should return no matches in a project with nothing related', async () => {
        expect(await call('find_related', { query: 'kubernetes autoscaling' })).toEqual({ matches: [] })
    })
})
