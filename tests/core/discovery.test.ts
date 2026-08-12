import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDb, rebuild, applyEvent, getDiscoveryStates } from '../../src/core/db.js'
import {
    currentDiscovery,
    emptyDiscoveryState,
    findRelated,
    loadDiscovery,
    nextDiscoveryId,
    normaliseDiscoveryState,
    openDiscoveries,
    recordDiscoveryState,
    startDiscovery
} from '../../src/core/discovery.js'
import type { DecisionLoggedEvent, TaskCreatedEvent } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/discovery-test')

let db: Database.Database

function taskEvent(taskId: string, title: string): TaskCreatedEvent {
    return {
        id: `evt-${taskId}`,
        type: 'task.created',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        title,
        taskType: 'feat',
        priority: 'P2-M',
        filePath: `.project/backlog/${taskId}.md`
    }
}

function decisionEvent(id: string, title: string, rationale: string): DecisionLoggedEvent {
    return {
        id,
        type: 'decision.logged',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        title,
        rationale
    }
}

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
    rebuild(TEST_ROOT, [])
    db = openDb(TEST_ROOT)
})

afterEach(() => {
    db.close()
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('nextDiscoveryId', () => {
    it('should start at D001 in a project with no sessions', () => {
        expect(nextDiscoveryId(db)).toBe('D001')
    })

    it('should increment past the highest existing session', async () => {
        await startDiscovery(TEST_ROOT, db, 'first')
        await startDiscovery(TEST_ROOT, db, 'second')
        expect(nextDiscoveryId(db)).toBe('D003')
    })
})

describe('normaliseDiscoveryState', () => {
    it('should return an empty state for garbage input', () => {
        expect(normaliseDiscoveryState(null)).toEqual(emptyDiscoveryState())
        expect(normaliseDiscoveryState('nonsense')).toEqual(emptyDiscoveryState())
        expect(normaliseDiscoveryState({ agreements: 'not an array' }).agreements).toEqual([])
    })

    it('should coerce partial entries instead of dropping them', () => {
        const state = normaliseDiscoveryState({
            problem: 'discovery has no home',
            assumptions: [{ question: 'which database?' }]
        })
        expect(state.problem).toBe('discovery has no home')
        expect(state.assumptions).toEqual([{ question: 'which database?', assumed: '', critical: false }])
    })

    it('should treat critical as false unless explicitly true', () => {
        const state = normaliseDiscoveryState({
            assumptions: [
                { question: 'a', assumed: 'x', critical: 'yes' },
                { question: 'b', assumed: 'y', critical: true }
            ]
        })
        expect(state.assumptions[0].critical).toBe(false)
        expect(state.assumptions[1].critical).toBe(true)
    })

    it('should fall back to overlaps for an unknown grounding relation', () => {
        const state = normaliseDiscoveryState({
            grounding: [{ kind: 'task', id: 'TASK-001', relation: 'invents' }]
        })
        expect(state.grounding[0].relation).toBe('overlaps')
    })

    it('should drop empty open threads', () => {
        const state = normaliseDiscoveryState({ openThreads: ['real thread', '', null] })
        expect(state.openThreads).toEqual(['real thread'])
    })
})

describe('discovery sessions', () => {
    it('should open a session that reads back as open with an empty state', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'brainstorm as a phase')

        const loaded = loadDiscovery(db, sessionId)
        expect(loaded?.session.topic).toBe('brainstorm as a phase')
        expect(loaded?.session.status).toBe('open')
        expect(loaded?.version).toBe(0)
        expect(loaded?.state).toEqual(emptyDiscoveryState())
    })

    it('should return undefined for a session that does not exist', () => {
        expect(loadDiscovery(db, 'D999')).toBeUndefined()
    })

    it('should version every snapshot and return the newest', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'versioning')

        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'first' })
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'second' })
        const third = await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'third' })

        expect(third.version).toBe(3)
        expect(loadDiscovery(db, sessionId)?.state.problem).toBe('third')
        expect(getDiscoveryStates(db, sessionId).map((row) => row.version)).toEqual([1, 2, 3])
    })

    it('should keep every earlier version readable', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'history')
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'v1' })
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'v2' })

        const history = getDiscoveryStates(db, sessionId).map((row) => JSON.parse(row.state).problem)
        expect(history).toEqual(['v1', 'v2'])
    })

    it('should not append a duplicate version when the same event is applied twice', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'idempotency')
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'once' })

        const [row] = getDiscoveryStates(db, sessionId)
        applyEvent(db, {
            id: row.id,
            type: 'discovery.state_updated',
            timestamp: row.created_at,
            actor: 'test@example.com',
            sessionId,
            state: normaliseDiscoveryState({ problem: 'once' })
        })

        expect(getDiscoveryStates(db, sessionId)).toHaveLength(1)
    })

    it('should survive a rebuild with versions intact', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'rebuild')
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'v1' })
        await recordDiscoveryState(TEST_ROOT, db, sessionId, { problem: 'v2' })

        const events = db
            .prepare('SELECT payload FROM events_log ORDER BY created_at ASC')
            .all()
            .map((row) => JSON.parse((row as { payload: string }).payload))
        db.close()

        rebuild(TEST_ROOT, events)
        db = openDb(TEST_ROOT)

        expect(getDiscoveryStates(db, sessionId).map((row) => row.version)).toEqual([1, 2])
        expect(loadDiscovery(db, sessionId)?.state.problem).toBe('v2')
    })
})

describe('currentDiscovery', () => {
    it('should return undefined when nothing is open', () => {
        expect(currentDiscovery(db)).toBeUndefined()
    })

    it('should return the most recently touched open session', async () => {
        const first = await startDiscovery(TEST_ROOT, db, 'older')
        const second = await startDiscovery(TEST_ROOT, db, 'newer')
        await recordDiscoveryState(TEST_ROOT, db, first.sessionId, { problem: 'touched last' })

        expect(currentDiscovery(db)?.session.id).toBe(first.sessionId)
        expect(second.sessionId).toBe('D002')
    })
})

describe('openDiscoveries', () => {
    it('should count assumptions, flagging the critical ones', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'assumptions')
        await recordDiscoveryState(TEST_ROOT, db, sessionId, {
            assumptions: [
                { question: 'which db?', assumed: 'postgres', critical: true },
                { question: 'which port?', assumed: '3141', critical: false }
            ]
        })

        expect(openDiscoveries(db)).toEqual([
            expect.objectContaining({ id: sessionId, openAssumptions: 2, criticalAssumptions: 1 })
        ])
    })
})

describe('findRelated', () => {
    beforeEach(() => {
        applyEvent(db, taskEvent('TASK-001', 'Add a dependency graph view to the Svelte UI'))
        applyEvent(db, taskEvent('TASK-002', 'Derive productivity metrics from the event log'))
        applyEvent(db, decisionEvent('ADR010', 'Loop and graph engineering', 'Model execution as a graph, not a list'))
    })

    it('should match tasks on title', () => {
        const matches = findRelated(db, 'dependency graph')
        expect(matches.map((m) => m.id)).toContain('TASK-001')
    })

    it('should match decisions on title and rationale', () => {
        expect(findRelated(db, 'execution model').map((m) => m.id)).toContain('ADR010')
    })

    it('should rank by how many terms matched', () => {
        const matches = findRelated(db, 'graph')
        expect(matches.length).toBeGreaterThan(1)
        expect(findRelated(db, 'dependency graph svelte')[0].id).toBe('TASK-001')
    })

    it('should return nothing when the query has no usable terms', () => {
        expect(findRelated(db, 'a of')).toEqual([])
        expect(findRelated(db, '')).toEqual([])
    })

    it('should return nothing in an empty project, which is what makes greenfield discovery work', () => {
        rebuild(TEST_ROOT, [])
        const fresh = openDb(TEST_ROOT)
        expect(findRelated(fresh, 'dependency graph')).toEqual([])
        fresh.close()
    })

    it('should respect the limit', () => {
        expect(findRelated(db, 'graph event log view', 1)).toHaveLength(1)
    })
})
