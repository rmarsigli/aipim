import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, join } from 'path'
import { appendEvents } from './events.js'
import {
    applyEvent,
    getAllDependencies,
    getChangesetsForSession,
    getDecisions,
    getTask,
    queryTasks,
    ChangesetRow
} from './db.js'
import { detectCycles } from './graph.js'
import { writeDiscoveryMirror } from './discovery.js'
import { adrMarkdown, slugify, taskMarkdown, today } from './markdown.js'
import { validatePath } from '../utils/path-validator.js'
import {
    Changeset,
    ChangesetResolution,
    ProposedDecision,
    ProposedDependency,
    ProposedDoc,
    ProposedTask
} from '../types/index.js'

const TASK_TYPES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test']
const PRIORITIES = ['P1-S', 'P1-M', 'P1-L', 'P2-S', 'P2-M', 'P2-L', 'P3']

export function emptyChangeset(): Changeset {
    return { tasks: [], dependencies: [], decisions: [], docs: [] }
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Coerces free-form JSON from an agent into a well-formed changeset.
 *
 * Normalising rather than rejecting keeps a malformed field from failing the
 * turn: what survives normalisation is then judged by `validateChangeset`,
 * which reports problems the caller can actually act on.
 */
export function normaliseChangeset(input: unknown): Changeset {
    const raw = asRecord(input)

    const tasks: ProposedTask[] = asArray(raw.tasks).map((item, index) => {
        const entry = asRecord(item)
        const localId = asString(entry.localId)
        return {
            localId: localId || `#${index + 1}`,
            title: asString(entry.title),
            taskType: asString(entry.taskType),
            priority: asString(entry.priority),
            ...(typeof entry.estimatedHours === 'number' ? { estimatedHours: entry.estimatedHours } : {}),
            ...(asString(entry.description) ? { description: asString(entry.description) } : {})
        }
    })

    const dependencies: ProposedDependency[] = asArray(raw.dependencies).map((item) => {
        const entry = asRecord(item)
        return { taskRef: asString(entry.taskRef), dependsOnRef: asString(entry.dependsOnRef) }
    })

    const decisions: ProposedDecision[] = asArray(raw.decisions).map((item) => {
        const entry = asRecord(item)
        const supersedes = asArray(entry.supersedes).map(asString).filter(Boolean)
        return {
            title: asString(entry.title),
            rationale: asString(entry.rationale),
            ...(supersedes.length ? { supersedes } : {})
        }
    })

    const docs: ProposedDoc[] = asArray(raw.docs).map((item) => {
        const entry = asRecord(item)
        return { path: asString(entry.path), content: asString(entry.content) }
    })

    return { tasks, dependencies, decisions, docs }
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ChangesetValidation {
    valid: boolean
    errors: string[]
}

/** A reference is local when it points at a task this same changeset creates. */
export function isLocalRef(ref: string): boolean {
    return ref.startsWith('#')
}

/**
 * Checks a changeset against the project it would be applied to.
 *
 * These rules are not configurable, because they are not preferences: a
 * changeset that fails them cannot be applied coherently at all. The
 * configurable judgement calls — how many tasks are too many, whether an open
 * critical assumption should block — live in the gate instead.
 */
export function validateChangeset(db: Database.Database, changeset: Changeset): ChangesetValidation {
    const errors: string[] = []
    const localIds = new Set<string>()

    for (const task of changeset.tasks) {
        if (!isLocalRef(task.localId)) {
            errors.push(`Task localId "${task.localId}" must start with # so dependencies can reference it`)
        }
        if (localIds.has(task.localId)) {
            errors.push(`Duplicate task localId "${task.localId}"`)
        }
        localIds.add(task.localId)

        if (!task.title.trim()) errors.push(`Task ${task.localId} has no title`)
        if (!TASK_TYPES.includes(task.taskType)) {
            errors.push(
                `Task ${task.localId} has invalid taskType "${task.taskType}" (expected ${TASK_TYPES.join(', ')})`
            )
        }
        if (!PRIORITIES.includes(task.priority)) {
            errors.push(
                `Task ${task.localId} has invalid priority "${task.priority}" (expected ${PRIORITIES.join(', ')})`
            )
        }
    }

    const resolvable = (ref: string): boolean => (isLocalRef(ref) ? localIds.has(ref) : getTask(db, ref) !== undefined)

    for (const dep of changeset.dependencies) {
        if (!resolvable(dep.taskRef)) errors.push(`Dependency references unknown task "${dep.taskRef}"`)
        if (!resolvable(dep.dependsOnRef)) errors.push(`Dependency references unknown task "${dep.dependsOnRef}"`)
    }

    // Local refs ('#1') and real IDs ('TASK-035') never collide, so proposed and
    // existing edges can be walked as one graph without resolving IDs first.
    const combined = [
        ...getAllDependencies(db),
        ...changeset.dependencies.map((dep) => ({ taskId: dep.taskRef, dependsOn: dep.dependsOnRef }))
    ]
    for (const cycle of detectCycles(combined)) {
        errors.push(`Dependency cycle: ${cycle.join(' → ')} → ${cycle[0]}`)
    }

    const knownDecisions = new Set(getDecisions(db).map((decision) => decision.id))
    for (const decision of changeset.decisions) {
        if (!decision.title.trim()) errors.push('A decision has no title')
        if (!decision.rationale.trim()) errors.push(`Decision "${decision.title}" has no rationale`)
        for (const supersededId of decision.supersedes ?? []) {
            if (!knownDecisions.has(supersededId)) {
                errors.push(`Decision "${decision.title}" supersedes unknown decision "${supersededId}"`)
            }
        }
    }

    for (const doc of changeset.docs) {
        if (!doc.path.trim()) {
            errors.push('A doc has no path')
        } else if (isAbsolute(doc.path) || doc.path.split(/[/\\]/).includes('..')) {
            errors.push(`Doc path must be relative and stay inside the project: ${doc.path}`)
        }
    }

    return { valid: errors.length === 0, errors }
}

// ─── Proposal ───────────────────────────────────────────────────────────────

export function nextChangesetId(db: Database.Database, sessionId: string): string {
    return `${sessionId}-CS${getChangesetsForSession(db, sessionId).length + 1}`
}

export function parseChangeset(row: ChangesetRow): Changeset {
    try {
        return normaliseChangeset(JSON.parse(row.payload))
    } catch {
        return emptyChangeset()
    }
}

/**
 * Records a proposed changeset and reports what validation found.
 *
 * Proposing never fails on validation — it is the evidence-gathering half of
 * the pair, mirroring how `verify_task` records a result and `complete_task`
 * decides. Rejection belongs to `resolveChangeset`.
 */
export async function proposeChangeset(
    projectRoot: string,
    db: Database.Database,
    sessionId: string,
    input: unknown
): Promise<{ changesetId: string; changeset: Changeset; validation: ChangesetValidation }> {
    const changeset = normaliseChangeset(input)
    const changesetId = nextChangesetId(db, sessionId)

    const [event] = await appendEvents(projectRoot, [
        { type: 'discovery.changeset_proposed', sessionId, changesetId, changeset }
    ])
    applyEvent(db, event)

    return { changesetId, changeset, validation: validateChangeset(db, changeset) }
}

// ─── Application ────────────────────────────────────────────────────────────

export interface AppliedChangeset {
    tasks: Array<{ localId: string; taskId: string; filePath: string }>
    dependencies: Array<{ taskId: string; dependsOn: string }>
    decisions: Array<{ decisionId: string; title: string; filePath: string }>
    docs: string[]
    /** The human-readable record of the session, written on application. */
    recordPath: string | null
    eventCount: number
}

/**
 * Allocates the IDs the new tasks will get.
 *
 * Numbering runs in memory across the whole batch: asking the read model for
 * the next ID once per task would hand every task in an unapplied changeset
 * the same number.
 */
function allocateTaskIds(db: Database.Database, tasks: ProposedTask[]): Map<string, string> {
    let highest = queryTasks(db).reduce((max, task) => {
        const match = task.id.match(/TASK-(\d+)/)
        return Math.max(max, match ? parseInt(match[1], 10) : 0)
    }, 0)

    return new Map(tasks.map((task) => [task.localId, `TASK-${(++highest).toString().padStart(3, '0')}`]))
}

/**
 * Applies a validated changeset as one unit.
 *
 * Everything is emitted through the ordinary write events — `task.created`,
 * `task.dependency_added`, `decision.logged` — so the Kanban, the graph and
 * `get_next_task` operate on the result without knowing discovery exists. Each
 * event carries `sessionId`, which is what makes a task traceable back to the
 * conversation that produced it.
 *
 * Events are written before the markdown files: if a file write fails the log
 * is still coherent and the task simply has no body, whereas orphan files with
 * no events would be invisible to every reader.
 */
export async function applyChangeset(
    projectRoot: string,
    db: Database.Database,
    sessionId: string,
    changesetId: string,
    changeset: Changeset,
    options: { validatorsBypassed?: boolean } = {}
): Promise<AppliedChangeset> {
    const taskIds = allocateTaskIds(db, changeset.tasks)
    const resolveRef = (ref: string): string => (isLocalRef(ref) ? (taskIds.get(ref) ?? ref) : ref)

    const taskFiles = changeset.tasks.map((task) => {
        const taskId = taskIds.get(task.localId) as string
        return {
            task,
            taskId,
            filePath: `.project/backlog/${today()}-${taskId}-${slugify(task.title)}.md`,
            content: taskMarkdown(task)
        }
    })

    const decisionFiles = changeset.decisions.map((decision) => ({
        decision,
        filePath: `.project/decisions/${today()}-ADR-${slugify(decision.title)}.md`,
        content: adrMarkdown(decision.title, decision.rationale, undefined, decision.supersedes)
    }))

    // Ordered so replay is coherent: tasks exist before the edges that name
    // them, and the resolution closes the session last.
    const events = await appendEvents(projectRoot, [
        ...taskFiles.map((entry) => ({
            type: 'task.created' as const,
            sessionId,
            taskId: entry.taskId,
            title: entry.task.title,
            taskType: entry.task.taskType,
            priority: entry.task.priority,
            filePath: entry.filePath
        })),
        ...changeset.dependencies.map((dep) => ({
            type: 'task.dependency_added' as const,
            sessionId,
            taskId: resolveRef(dep.taskRef),
            dependsOn: resolveRef(dep.dependsOnRef)
        })),
        ...decisionFiles.map((entry) => ({
            type: 'decision.logged' as const,
            sessionId,
            title: entry.decision.title,
            rationale: entry.decision.rationale,
            filePath: entry.filePath,
            ...(entry.decision.supersedes?.length ? { supersedes: entry.decision.supersedes } : {})
        })),
        {
            type: 'discovery.resolved' as const,
            sessionId,
            changesetId,
            resolution: 'applied' as ChangesetResolution,
            ...(options.validatorsBypassed ? { validatorsBypassed: true } : {})
        }
    ])

    for (const event of events) applyEvent(db, event)

    for (const entry of [...taskFiles, ...decisionFiles]) {
        const full = join(projectRoot, entry.filePath)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, entry.content, 'utf8')
    }

    for (const doc of changeset.docs) {
        const full = validatePath(doc.path, projectRoot)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, doc.content, 'utf8')
    }

    const decisionEvents = events.filter((event) => event.type === 'decision.logged')

    // Written after the resolution event has been applied, so the record shows
    // the session as resolved rather than mid-flight.
    const recordPath = writeDiscoveryMirror(projectRoot, db, sessionId)

    return {
        recordPath,
        tasks: taskFiles.map((entry) => ({
            localId: entry.task.localId,
            taskId: entry.taskId,
            filePath: entry.filePath
        })),
        dependencies: changeset.dependencies.map((dep) => ({
            taskId: resolveRef(dep.taskRef),
            dependsOn: resolveRef(dep.dependsOnRef)
        })),
        decisions: decisionFiles.map((entry, index) => ({
            decisionId: decisionEvents[index].id,
            title: entry.decision.title,
            filePath: entry.filePath
        })),
        docs: changeset.docs.map((doc) => doc.path),
        eventCount: events.length
    }
}

/**
 * Closes a session without applying anything, or reopens it for revision.
 */
export async function resolveWithoutApplying(
    projectRoot: string,
    db: Database.Database,
    sessionId: string,
    changesetId: string | undefined,
    resolution: Exclude<ChangesetResolution, 'applied'>
): Promise<void> {
    const [event] = await appendEvents(projectRoot, [
        { type: 'discovery.resolved', sessionId, changesetId, resolution }
    ])
    applyEvent(db, event)
}
