import Database from 'better-sqlite3'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'

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

CREATE TABLE IF NOT EXISTS events_log (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    actor       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
`

export function openDb(projectRoot: string): Database.Database {
    const db = new Database(join(projectRoot, DB_FILE))
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
            db.prepare(
                `INSERT OR IGNORE INTO tasks (id, title, task_type, status, priority, file_path, created_at, updated_at)
                 VALUES (?, ?, ?, 'backlog', ?, ?, ?, ?)`
            ).run(
                event.taskId,
                event.title,
                event.taskType,
                event.priority,
                event.filePath,
                event.timestamp,
                event.timestamp
            )
            break

        case 'task.status_changed':
            db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
                event.to,
                event.timestamp,
                event.taskId
            )
            break

        case 'task.assigned':
            db.prepare(`UPDATE tasks SET assignee = ?, updated_at = ? WHERE id = ?`).run(
                event.assignee,
                event.timestamp,
                event.taskId
            )
            break

        case 'task.priority_changed':
            db.prepare(`UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?`).run(
                event.to,
                event.timestamp,
                event.taskId
            )
            break

        case 'task.comment_added':
            db.prepare(`INSERT INTO comments (id, task_id, actor, text, created_at) VALUES (?, ?, ?, ?, ?)`).run(
                event.id,
                event.taskId,
                event.actor,
                event.text,
                event.timestamp
            )
            break

        case 'task.completed':
            db.prepare(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`).run(
                event.timestamp,
                event.taskId
            )
            break

        case 'decision.logged':
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
            break

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

export function getDecisions(db: Database.Database): DecisionRow[] {
    return db.prepare('SELECT * FROM decisions ORDER BY created_at DESC').all() as DecisionRow[]
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
