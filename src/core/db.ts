import Database from 'better-sqlite3'
import { join } from 'path'
import {
    AipimEvent,
    TaskCreatedEvent,
    TaskStatusChangedEvent,
    TaskAssignedEvent,
    TaskPriorityChangedEvent,
    TaskCommentAddedEvent,
    TaskCompletedEvent,
    DecisionLoggedEvent,
    CheckRunEvent,
    TaskDependencyAddedEvent,
    TaskDependencyRemovedEvent,
    DiscoveryStartedEvent,
    DiscoveryStateUpdatedEvent
} from '../types/index.js'

const DB_FILE = '.project/data.db'

// Shared ORDER BY clause for priority sorting: P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3
const PRIORITY_ORDER_SQL = `
    ORDER BY
        CASE SUBSTR(priority, 1, 2)
            WHEN 'P1' THEN 1
            WHEN 'P2' THEN 2
            WHEN 'P3' THEN 3
            ELSE 4
        END,
        CASE SUBSTR(priority, 4, 1)
            WHEN 'S' THEN 1
            WHEN 'M' THEN 2
            WHEN 'L' THEN 3
            ELSE 4
        END,
        created_at ASC`

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    task_type   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'backlog',
    priority    TEXT NOT NULL,
    assignee    TEXT,
    file_path   TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    actor       TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    rationale   TEXT NOT NULL,
    task_id     TEXT,
    file_path   TEXT,
    actor       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id     TEXT NOT NULL,
    depends_on  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (task_id, depends_on)
);

CREATE TABLE IF NOT EXISTS checks (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL,
    command     TEXT NOT NULL,
    exit_code   INTEGER NOT NULL,
    passed      INTEGER NOT NULL,
    duration_ms INTEGER,
    output      TEXT,
    actor       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_sessions (
    id          TEXT PRIMARY KEY,
    topic       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    started_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    actor       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_states (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    version     INTEGER NOT NULL,
    state       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE (session_id, version)
);

CREATE TABLE IF NOT EXISTS events_log (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    actor       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_checks_task    ON checks(task_id);
CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON task_dependencies(depends_on);
CREATE INDEX IF NOT EXISTS idx_discovery_states_session ON discovery_states(session_id);
`

/**
 * Recognises the failure mode where better-sqlite3 was installed but its native
 * binding was never compiled.
 *
 * pnpm v10 blocks install scripts by default, so `pnpm add -g aipim` produces a
 * package that looks fine until something opens the database. better-sqlite3
 * loads its binding lazily, which is why `aipim --version` and even
 * `aipim install` succeed first and give a false sense that the install worked.
 */
export function isMissingNativeBinding(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('better_sqlite3.node') || message.includes('Could not locate the bindings file')
}

export const MISSING_BINDING_HELP =
    'SQLite could not start: better-sqlite3 is installed but its native binding was never built.\n\n' +
    'pnpm blocks package install scripts by default, so the build step was skipped at install\n' +
    'time. The binding loads lazily, which is why earlier commands appeared to work.\n\n' +
    'Fix it with:\n\n' +
    '  pnpm approve-builds -g     # aipim installed globally\n' +
    '  pnpm approve-builds        # aipim as a project dependency\n\n' +
    'To declare it up front in a project instead, add to its package.json:\n\n' +
    '  "pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }\n'

export function openDb(projectRoot: string): Database.Database {
    let db: Database.Database
    try {
        db = new Database(join(projectRoot, DB_FILE))
    } catch (error) {
        if (isMissingNativeBinding(error)) throw new Error(MISSING_BINDING_HELP)
        throw error
    }
    db.pragma('journal_mode = WAL')
    return db
}

/**
 * Drops all tables and rebuilds the database from the given events array.
 * Safe to call multiple times — fully idempotent.
 */
export function rebuild(projectRoot: string, events: AipimEvent[]): void {
    const db = openDb(projectRoot)

    db.exec('DROP TABLE IF EXISTS events_log')
    db.exec('DROP TABLE IF EXISTS discovery_states')
    db.exec('DROP TABLE IF EXISTS discovery_sessions')
    db.exec('DROP TABLE IF EXISTS checks')
    db.exec('DROP TABLE IF EXISTS task_dependencies')
    db.exec('DROP TABLE IF EXISTS comments')
    db.exec('DROP TABLE IF EXISTS decisions')
    db.exec('DROP TABLE IF EXISTS tasks')
    db.exec(SCHEMA)

    const applyAll = db.transaction((evts: AipimEvent[]) => {
        for (const evt of evts) applyEvent(db, evt)
    })
    applyAll(events)
    db.close()
}

// ─── Event handlers ──────────────────────────────────────────────────────────
// Each handler is a pure function that receives the DB and a narrowed event.
// To support a new event type: add a handler function and register it below.

function handleTaskCreated(db: Database.Database, event: TaskCreatedEvent): void {
    db.prepare(
        `INSERT OR IGNORE INTO tasks (id, title, task_type, status, priority, file_path, created_at, updated_at)
         VALUES (?, ?, ?, 'backlog', ?, ?, ?, ?)`
    ).run(event.taskId, event.title, event.taskType, event.priority, event.filePath, event.timestamp, event.timestamp)
}

function handleTaskStatusChanged(db: Database.Database, event: TaskStatusChangedEvent): void {
    db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(event.to, event.timestamp, event.taskId)
}

function handleTaskAssigned(db: Database.Database, event: TaskAssignedEvent): void {
    db.prepare(`UPDATE tasks SET assignee = ?, updated_at = ? WHERE id = ?`).run(
        event.assignee,
        event.timestamp,
        event.taskId
    )
}

function handleTaskPriorityChanged(db: Database.Database, event: TaskPriorityChangedEvent): void {
    db.prepare(`UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?`).run(
        event.to,
        event.timestamp,
        event.taskId
    )
}

function handleTaskCommentAdded(db: Database.Database, event: TaskCommentAddedEvent): void {
    db.prepare(`INSERT INTO comments (id, task_id, actor, text, created_at) VALUES (?, ?, ?, ?, ?)`).run(
        event.id,
        event.taskId,
        event.actor,
        event.text,
        event.timestamp
    )
}

function handleTaskCompleted(db: Database.Database, event: TaskCompletedEvent): void {
    db.prepare(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`).run(event.timestamp, event.taskId)
}

function handleDecisionLogged(db: Database.Database, event: DecisionLoggedEvent): void {
    db.prepare(
        `INSERT INTO decisions (id, title, rationale, task_id, file_path, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        event.id,
        event.title,
        event.rationale,
        event.taskId ?? null,
        event.filePath ?? null,
        event.actor,
        event.timestamp
    )
}

function handleCheckRun(db: Database.Database, event: CheckRunEvent): void {
    db.prepare(
        `INSERT OR IGNORE INTO checks (id, task_id, command, exit_code, passed, duration_ms, output, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        event.id,
        event.taskId,
        event.command,
        event.exitCode,
        event.passed ? 1 : 0,
        event.durationMs ?? null,
        event.output ?? null,
        event.actor,
        event.timestamp
    )
}

function handleTaskDependencyAdded(db: Database.Database, event: TaskDependencyAddedEvent): void {
    db.prepare(`INSERT OR IGNORE INTO task_dependencies (task_id, depends_on, created_at) VALUES (?, ?, ?)`).run(
        event.taskId,
        event.dependsOn,
        event.timestamp
    )
}

function handleTaskDependencyRemoved(db: Database.Database, event: TaskDependencyRemovedEvent): void {
    db.prepare(`DELETE FROM task_dependencies WHERE task_id = ? AND depends_on = ?`).run(event.taskId, event.dependsOn)
}

function handleDiscoveryStarted(db: Database.Database, event: DiscoveryStartedEvent): void {
    db.prepare(
        `INSERT OR IGNORE INTO discovery_sessions (id, topic, status, started_at, updated_at, actor)
         VALUES (?, ?, 'open', ?, ?, ?)`
    ).run(event.sessionId, event.topic, event.timestamp, event.timestamp, event.actor)
}

/**
 * Records a distilled-state snapshot as the next version of its session.
 *
 * The version is derived at apply time rather than carried on the event, so it
 * stays correct when the read model is rebuilt from the log. Keying the row on
 * the event id (rather than on session+version) is what keeps re-applying the
 * same event a no-op instead of appending a duplicate version.
 */
function handleDiscoveryStateUpdated(db: Database.Database, event: DiscoveryStateUpdatedEvent): void {
    const row = db
        .prepare('SELECT MAX(version) AS version FROM discovery_states WHERE session_id = ?')
        .get(event.sessionId) as { version: number | null } | undefined

    db.prepare(
        `INSERT OR IGNORE INTO discovery_states (id, session_id, version, state, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(event.id, event.sessionId, (row?.version ?? 0) + 1, JSON.stringify(event.state), event.timestamp)

    db.prepare('UPDATE discovery_sessions SET updated_at = ? WHERE id = ?').run(event.timestamp, event.sessionId)
}

/**
 * Applies a single event to an already-open database.
 * Used both during rebuild and for incremental updates (append → applyEvent).
 */
export function applyEvent(db: Database.Database, event: AipimEvent): void {
    // Always log the raw event
    db.prepare(
        `INSERT OR IGNORE INTO events_log (id, type, payload, actor, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(event.id, event.type, JSON.stringify(event), event.actor, event.timestamp)

    switch (event.type) {
        case 'task.created':
            return handleTaskCreated(db, event)
        case 'task.status_changed':
            return handleTaskStatusChanged(db, event)
        case 'task.assigned':
            return handleTaskAssigned(db, event)
        case 'task.priority_changed':
            return handleTaskPriorityChanged(db, event)
        case 'task.comment_added':
            return handleTaskCommentAdded(db, event)
        case 'task.completed':
            return handleTaskCompleted(db, event)
        case 'decision.logged':
            return handleDecisionLogged(db, event)
        case 'check.run':
            return handleCheckRun(db, event)
        case 'task.dependency_added':
            return handleTaskDependencyAdded(db, event)
        case 'task.dependency_removed':
            return handleTaskDependencyRemoved(db, event)
        case 'discovery.started':
            return handleDiscoveryStarted(db, event)
        case 'discovery.state_updated':
            return handleDiscoveryStateUpdated(db, event)
        // Events that don't mutate derived state (content_updated, dependency_*, session_*)
        default:
            break
    }
}

// ─── Query helpers ──────────────────────────────────────────────────────────

export interface TaskRow {
    id: string
    title: string
    task_type: string
    status: string
    priority: string
    assignee: string | null
    file_path: string | null
    created_at: string
    updated_at: string
}

export interface CommentRow {
    id: string
    task_id: string
    actor: string
    text: string
    created_at: string
}

export interface DecisionRow {
    id: string
    title: string
    rationale: string
    task_id: string | null
    file_path: string | null
    actor: string
    created_at: string
}

export function queryTasks(
    db: Database.Database,
    filter?: { status?: string; assignee?: string; priority?: string }
): TaskRow[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: string[] = []

    if (filter?.status) {
        sql += ' AND status = ?'
        params.push(filter.status)
    }
    if (filter?.assignee) {
        sql += ' AND assignee = ?'
        params.push(filter.assignee)
    }
    if (filter?.priority) {
        sql += ' AND priority LIKE ?'
        params.push(filter.priority + '%')
    }

    sql += PRIORITY_ORDER_SQL

    return db.prepare(sql).all(...params) as TaskRow[]
}

/**
 * Returns the highest-priority task in the backlog.
 * Order: P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3, then oldest first on tie.
 */
export function getNextTask(db: Database.Database): TaskRow | undefined {
    return db.prepare(`SELECT * FROM tasks WHERE status = 'backlog'${PRIORITY_ORDER_SQL} LIMIT 1`).get() as
        | TaskRow
        | undefined
}

export function getTask(db: Database.Database, taskId: string): TaskRow | undefined {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
}

export function getBlockers(db: Database.Database): TaskRow[] {
    return db.prepare(`SELECT * FROM tasks WHERE status = 'blocked' ORDER BY updated_at ASC`).all() as TaskRow[]
}

export function getCommentsForTask(db: Database.Database, taskId: string): CommentRow[] {
    return db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as CommentRow[]
}

export interface CheckRow {
    id: string
    task_id: string
    command: string
    exit_code: number
    passed: boolean
    duration_ms: number | null
    output: string | null
    actor: string
    created_at: string
}

/**
 * Returns all recorded checks for a task, oldest first.
 * SQLite has no boolean type, so `passed` is normalised back to a real boolean here.
 */
export function getChecksForTask(db: Database.Database, taskId: string): CheckRow[] {
    const rows = db.prepare('SELECT * FROM checks WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as Array<
        Omit<CheckRow, 'passed'> & { passed: number }
    >
    return rows.map((row) => ({ ...row, passed: row.passed === 1 }))
}

export interface DependencyEdge {
    taskId: string
    dependsOn: string
}

/**
 * Returns the IDs of the tasks a given task depends on.
 */
export function getDependencies(db: Database.Database, taskId: string): string[] {
    const rows = db
        .prepare('SELECT depends_on FROM task_dependencies WHERE task_id = ? ORDER BY depends_on ASC')
        .all(taskId) as Array<{ depends_on: string }>
    return rows.map((r) => r.depends_on)
}

/**
 * Returns the IDs of the tasks blocked by a given task — the reverse edge.
 */
export function getDependents(db: Database.Database, taskId: string): string[] {
    const rows = db
        .prepare('SELECT task_id FROM task_dependencies WHERE depends_on = ? ORDER BY task_id ASC')
        .all(taskId) as Array<{ task_id: string }>
    return rows.map((r) => r.task_id)
}

/**
 * Returns every dependency edge in the project.
 */
export function getAllDependencies(db: Database.Database): DependencyEdge[] {
    const rows = db
        .prepare('SELECT task_id, depends_on FROM task_dependencies ORDER BY task_id ASC, depends_on ASC')
        .all() as Array<{ task_id: string; depends_on: string }>
    return rows.map((r) => ({ taskId: r.task_id, dependsOn: r.depends_on }))
}

export function getDecisions(db: Database.Database): DecisionRow[] {
    return db.prepare('SELECT * FROM decisions ORDER BY created_at DESC').all() as DecisionRow[]
}

export interface DiscoverySessionRow {
    id: string
    topic: string
    status: string
    started_at: string
    updated_at: string
    actor: string
}

export interface DiscoveryStateRow {
    id: string
    session_id: string
    version: number
    state: string
    created_at: string
}

export function getDiscoverySession(db: Database.Database, sessionId: string): DiscoverySessionRow | undefined {
    return db.prepare('SELECT * FROM discovery_sessions WHERE id = ?').get(sessionId) as DiscoverySessionRow | undefined
}

/**
 * Lists discovery sessions, most recently touched first.
 */
export function queryDiscoverySessions(db: Database.Database, filter?: { status?: string }): DiscoverySessionRow[] {
    if (filter?.status) {
        return db
            .prepare('SELECT * FROM discovery_sessions WHERE status = ? ORDER BY updated_at DESC')
            .all(filter.status) as DiscoverySessionRow[]
    }
    return db.prepare('SELECT * FROM discovery_sessions ORDER BY updated_at DESC').all() as DiscoverySessionRow[]
}

/**
 * Returns the newest distilled-state snapshot for a session, or undefined when
 * the session was started but nothing has been distilled into it yet.
 */
export function getLatestDiscoveryState(db: Database.Database, sessionId: string): DiscoveryStateRow | undefined {
    return db
        .prepare('SELECT * FROM discovery_states WHERE session_id = ? ORDER BY version DESC LIMIT 1')
        .get(sessionId) as DiscoveryStateRow | undefined
}

/**
 * Returns every snapshot for a session, oldest first — the version history the
 * append-only log gives us for free.
 */
export function getDiscoveryStates(db: Database.Database, sessionId: string): DiscoveryStateRow[] {
    return db
        .prepare('SELECT * FROM discovery_states WHERE session_id = ? ORDER BY version ASC')
        .all(sessionId) as DiscoveryStateRow[]
}

export function getStats(db: Database.Database): Record<string, number> {
    const rows = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all() as Array<{
        status: string
        count: number
    }>

    const byStatus: Record<string, number> = {}
    for (const row of rows) {
        byStatus[row.status] = row.count
    }
    return byStatus
}
