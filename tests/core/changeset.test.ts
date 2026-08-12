import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { openDb, rebuild, applyEvent, getDecisions, getTask, getAllDependencies, getChangeset } from '../../src/core/db.js'
import {
    applyChangeset,
    emptyChangeset,
    normaliseChangeset,
    proposeChangeset,
    resolveWithoutApplying,
    validateChangeset
} from '../../src/core/changeset.js'
import { startDiscovery } from '../../src/core/discovery.js'
import type { Changeset, DecisionLoggedEvent, TaskCreatedEvent, TaskDependencyAddedEvent } from '../../src/types/index.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/changeset-test')

let db: Database.Database

function changeset(overrides: Partial<Changeset> = {}): Changeset {
    return { ...emptyChangeset(), ...overrides }
}

function proposedTask(localId: string, title: string) {
    return { localId, title, taskType: 'feat', priority: 'P2-M' }
}

function seedTask(taskId: string, title = 'Existing work'): void {
    const event: TaskCreatedEvent = {
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
    applyEvent(db, event)
}

function seedDecision(id: string, title = 'Existing decision'): void {
    const event: DecisionLoggedEvent = {
        id,
        type: 'decision.logged',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        title,
        rationale: 'Because it was the best option at the time'
    }
    applyEvent(db, event)
}

function seedEdge(taskId: string, dependsOn: string): void {
    const event: TaskDependencyAddedEvent = {
        id: `evt-dep-${taskId}-${dependsOn}`,
        type: 'task.dependency_added',
        timestamp: new Date().toISOString(),
        actor: 'test@example.com',
        taskId,
        dependsOn
    }
    applyEvent(db, event)
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

describe('normaliseChangeset', () => {
    it('should return an empty changeset for garbage input', () => {
        expect(normaliseChangeset(null)).toEqual(emptyChangeset())
        expect(normaliseChangeset({ tasks: 'nope' })).toEqual(emptyChangeset())
    })

    it('should give a task a positional localId when one is missing', () => {
        const result = normaliseChangeset({ tasks: [{ title: 'No handle' }] })
        expect(result.tasks[0].localId).toBe('#1')
    })
})

describe('validateChangeset', () => {
    it('should accept a well-formed changeset', () => {
        const result = validateChangeset(db, changeset({ tasks: [proposedTask('#1', 'Build the thing')] }))
        expect(result).toEqual({ valid: true, errors: [] })
    })

    it('should reject a localId that cannot be referenced', () => {
        const result = validateChangeset(db, changeset({ tasks: [proposedTask('one', 'Bad handle')] }))
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('must start with #')
    })

    it('should reject duplicate localIds', () => {
        const result = validateChangeset(
            db,
            changeset({ tasks: [proposedTask('#1', 'First'), proposedTask('#1', 'Second')] })
        )
        expect(result.errors.some((e) => e.includes('Duplicate task localId'))).toBe(true)
    })

    it('should reject an invalid taskType or priority', () => {
        const result = validateChangeset(
            db,
            changeset({ tasks: [{ localId: '#1', title: 'x', taskType: 'invent', priority: 'P9' }] })
        )
        expect(result.errors.some((e) => e.includes('invalid taskType'))).toBe(true)
        expect(result.errors.some((e) => e.includes('invalid priority'))).toBe(true)
    })

    it('should reject a dependency on a task that does not exist', () => {
        const result = validateChangeset(
            db,
            changeset({
                tasks: [proposedTask('#1', 'Build')],
                dependencies: [{ taskRef: '#1', dependsOnRef: 'TASK-999' }]
            })
        )
        expect(result.errors.some((e) => e.includes('TASK-999'))).toBe(true)
    })

    it('should reject a local ref with no matching task', () => {
        const result = validateChangeset(
            db,
            changeset({ tasks: [proposedTask('#1', 'Build')], dependencies: [{ taskRef: '#1', dependsOnRef: '#9' }] })
        )
        expect(result.errors.some((e) => e.includes('#9'))).toBe(true)
    })

    it('should accept a dependency on an existing task', () => {
        seedTask('TASK-035')
        const result = validateChangeset(
            db,
            changeset({
                tasks: [proposedTask('#1', 'Build')],
                dependencies: [{ taskRef: '#1', dependsOnRef: 'TASK-035' }]
            })
        )
        expect(result.valid).toBe(true)
    })

    it('should reject a cycle among proposed tasks', () => {
        const result = validateChangeset(
            db,
            changeset({
                tasks: [proposedTask('#1', 'A'), proposedTask('#2', 'B')],
                dependencies: [
                    { taskRef: '#1', dependsOnRef: '#2' },
                    { taskRef: '#2', dependsOnRef: '#1' }
                ]
            })
        )
        expect(result.errors.some((e) => e.includes('cycle'))).toBe(true)
    })

    it('should reject a cycle closed against existing edges', () => {
        seedTask('TASK-001')
        seedTask('TASK-002')
        seedEdge('TASK-001', 'TASK-002')

        const result = validateChangeset(
            db,
            changeset({ dependencies: [{ taskRef: 'TASK-002', dependsOnRef: 'TASK-001' }] })
        )
        expect(result.errors.some((e) => e.includes('cycle'))).toBe(true)
    })

    it('should reject superseding a decision that does not exist', () => {
        const result = validateChangeset(
            db,
            changeset({ decisions: [{ title: 'New', rationale: 'why', supersedes: ['ADR-ghost'] }] })
        )
        expect(result.errors.some((e) => e.includes('ADR-ghost'))).toBe(true)
    })

    it('should accept superseding a decision that exists', () => {
        seedDecision('ADR-old')
        const result = validateChangeset(
            db,
            changeset({ decisions: [{ title: 'New', rationale: 'why', supersedes: ['ADR-old'] }] })
        )
        expect(result.valid).toBe(true)
    })

    it('should reject a doc path that escapes the project', () => {
        const result = validateChangeset(
            db,
            changeset({ docs: [{ path: '../../etc/passwd', content: 'nope' }] })
        )
        expect(result.errors.some((e) => e.includes('stay inside the project'))).toBe(true)
    })

    it('should reject an absolute doc path', () => {
        const result = validateChangeset(db, changeset({ docs: [{ path: '/etc/passwd', content: 'nope' }] }))
        expect(result.errors.some((e) => e.includes('stay inside the project'))).toBe(true)
    })
})

describe('proposeChangeset', () => {
    it('should record the proposal and report validation without blocking', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'proposals')
        const result = await proposeChangeset(TEST_ROOT, db, sessionId, {
            tasks: [{ localId: '#1', title: 'x', taskType: 'invent', priority: 'P2-M' }]
        })

        expect(result.changesetId).toBe(`${sessionId}-CS1`)
        expect(result.validation.valid).toBe(false)
        expect(getChangeset(db, result.changesetId)?.status).toBe('proposed')
    })

    it('should supersede the previous proposal in the same session', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'revisions')
        const first = await proposeChangeset(TEST_ROOT, db, sessionId, { tasks: [proposedTask('#1', 'v1')] })
        const second = await proposeChangeset(TEST_ROOT, db, sessionId, { tasks: [proposedTask('#1', 'v2')] })

        expect(getChangeset(db, first.changesetId)?.status).toBe('superseded')
        expect(getChangeset(db, second.changesetId)?.status).toBe('proposed')
    })
})

describe('applyChangeset', () => {
    it('should create tasks, edges and decisions in one batch, all carrying the session', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'application')
        const cs = changeset({
            tasks: [proposedTask('#1', 'First phase'), proposedTask('#2', 'Second phase')],
            dependencies: [{ taskRef: '#2', dependsOnRef: '#1' }],
            decisions: [{ title: 'Snapshot over granular events', rationale: 'history comes free' }]
        })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        const applied = await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)

        // 2 tasks + 1 edge + 1 decision + 1 resolution
        expect(applied.eventCount).toBe(5)
        expect(applied.tasks.map((t) => t.taskId)).toEqual(['TASK-001', 'TASK-002'])
        expect(getTask(db, 'TASK-001')?.session_id).toBe(sessionId)
        expect(getDecisions(db)[0].session_id).toBe(sessionId)
        expect(getAllDependencies(db)).toEqual([{ taskId: 'TASK-002', dependsOn: 'TASK-001' }])
    })

    it('should allocate sequential IDs past the existing highest', async () => {
        seedTask('TASK-007')
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'ids')
        const cs = changeset({ tasks: [proposedTask('#1', 'A'), proposedTask('#2', 'B')] })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        const applied = await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)
        expect(applied.tasks.map((t) => t.taskId)).toEqual(['TASK-008', 'TASK-009'])
    })

    it('should resolve local refs against existing tasks too', async () => {
        seedTask('TASK-035')
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'mixed refs')
        const cs = changeset({
            tasks: [proposedTask('#1', 'Depends on existing work')],
            dependencies: [{ taskRef: '#1', dependsOnRef: 'TASK-035' }]
        })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)
        expect(getAllDependencies(db)).toEqual([{ taskId: 'TASK-036', dependsOn: 'TASK-035' }])
    })

    it('should mark a superseded decision rather than delete it', async () => {
        seedDecision('ADR-old', 'The old way')
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'supersession')
        const cs = changeset({
            decisions: [{ title: 'The new way', rationale: 'better', supersedes: ['ADR-old'] }]
        })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        const applied = await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)
        const old = getDecisions(db).find((d) => d.id === 'ADR-old')

        expect(old).toBeDefined()
        expect(old?.superseded_by).toBe(applied.decisions[0].decisionId)
    })

    it('should write the markdown files behind the events', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'files')
        const cs = changeset({
            tasks: [{ ...proposedTask('#1', 'Write it down'), estimatedHours: 4, description: 'Body text' }],
            decisions: [{ title: 'Chose markdown', rationale: 'git diffs it' }],
            docs: [{ path: '.project/docs/generated.md', content: '# Generated' }]
        })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        const applied = await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)
        const taskBody = readFileSync(join(TEST_ROOT, applied.tasks[0].filePath), 'utf8')

        expect(taskBody).toContain('estimated_hours: 4')
        expect(taskBody).toContain('Body text')
        expect(existsSync(join(TEST_ROOT, applied.decisions[0].filePath))).toBe(true)
        expect(readFileSync(join(TEST_ROOT, '.project/docs/generated.md'), 'utf8')).toBe('# Generated')
    })

    it('should close the session and the changeset', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'closing')
        const cs = changeset({ tasks: [proposedTask('#1', 'Only task')] })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)

        expect(getChangeset(db, changesetId)?.status).toBe('applied')
        expect(
            (db.prepare('SELECT status FROM discovery_sessions WHERE id = ?').get(sessionId) as { status: string })
                .status
        ).toBe('applied')
    })

    it('should record a bypass when validators were overridden', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'bypass')
        const cs = changeset({ tasks: [proposedTask('#1', 'Forced')] })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs, { validatorsBypassed: true })

        const resolved = db
            .prepare(`SELECT payload FROM events_log WHERE type = 'discovery.resolved'`)
            .get() as { payload: string }
        expect(JSON.parse(resolved.payload).validatorsBypassed).toBe(true)
    })

    it('should survive a rebuild with provenance intact', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'rebuild')
        const cs = changeset({
            tasks: [proposedTask('#1', 'A'), proposedTask('#2', 'B')],
            dependencies: [{ taskRef: '#2', dependsOnRef: '#1' }]
        })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)
        await applyChangeset(TEST_ROOT, db, sessionId, changesetId, cs)

        const events = db
            .prepare('SELECT payload FROM events_log ORDER BY created_at ASC, rowid ASC')
            .all()
            .map((row) => JSON.parse((row as { payload: string }).payload))
        db.close()

        rebuild(TEST_ROOT, events)
        db = openDb(TEST_ROOT)

        expect(getTask(db, 'TASK-001')?.session_id).toBe(sessionId)
        expect(getAllDependencies(db)).toEqual([{ taskId: 'TASK-002', dependsOn: 'TASK-001' }])
        expect(getChangeset(db, changesetId)?.status).toBe('applied')
    })
})

describe('resolveWithoutApplying', () => {
    it('should abandon a session without creating anything', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'abandon')
        const cs = changeset({ tasks: [proposedTask('#1', 'Never built')] })
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, cs)

        await resolveWithoutApplying(TEST_ROOT, db, sessionId, changesetId, 'abandoned')

        expect(getChangeset(db, changesetId)?.status).toBe('abandoned')
        expect(getTask(db, 'TASK-001')).toBeUndefined()
    })

    it('should reopen the session on a revision request', async () => {
        const { sessionId } = await startDiscovery(TEST_ROOT, db, 'revise')
        const { changesetId } = await proposeChangeset(TEST_ROOT, db, sessionId, {
            tasks: [proposedTask('#1', 'Draft')]
        })

        await resolveWithoutApplying(TEST_ROOT, db, sessionId, changesetId, 'revision_requested')

        expect(
            (db.prepare('SELECT status FROM discovery_sessions WHERE id = ?').get(sessionId) as { status: string })
                .status
        ).toBe('open')
        expect(getChangeset(db, changesetId)?.status).toBe('proposed')
    })
})
