import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { appendEvent, readEvents } from './events.js'
import { rebuild } from './db.js'

export interface MigrationResult {
    tasksFound: number
    eventsGenerated: number
    skipped: number
}

/**
 * Migrates an existing AIPIM 1.x project (markdown-only) to 2.0.
 * Reads backlog/ and completed/ directories, generates synthetic events in events.jsonl,
 * and rebuilds the SQLite database.
 *
 * Safe to run multiple times — idempotent.
 */
export async function migrate(projectRoot: string): Promise<MigrationResult> {
    const existing = readEvents(projectRoot)
    if (existing.length > 0) {
        return { tasksFound: 0, eventsGenerated: 0, skipped: existing.length }
    }

    let tasksFound = 0
    let eventsGenerated = 0
    // Collected during the file pass, emitted afterwards so every referenced
    // task already exists as an event before its edges are written.
    const declaredDependencies: Array<{ taskId: string; dependsOn: string }> = []
    const migratedIds = new Set<string>()

    // Migrate backlog/
    const backlogDir = join(projectRoot, '.project/backlog')
    if (existsSync(backlogDir)) {
        const files = readdirSync(backlogDir).filter((f) => f.endsWith('.md'))
        for (const file of files) {
            const taskId = extractTaskId(file)
            if (!taskId) continue

            const content = readFileSync(join(backlogDir, file), 'utf8')
            const { data: fm } = matter(content)

            tasksFound++
            migratedIds.add(taskId)
            await appendEvent(projectRoot, {
                type: 'task.created',
                taskId,
                title: String(fm.title ?? file),
                taskType: extractTaskType(file),
                priority: String(fm.priority ?? 'P3'),
                filePath: `.project/backlog/${file}`
            })
            eventsGenerated++

            for (const dependsOn of normaliseDependsOn(fm.depends_on)) {
                declaredDependencies.push({ taskId, dependsOn })
            }

            if (fm.assignee) {
                await appendEvent(projectRoot, {
                    type: 'task.assigned',
                    taskId,
                    assignee: String(fm.assignee)
                })
                eventsGenerated++
            }
        }
    }

    // Migrate completed/
    const completedDir = join(projectRoot, '.project/completed')
    if (existsSync(completedDir)) {
        const files = readdirSync(completedDir).filter((f) => f.endsWith('.md'))
        for (const file of files) {
            const taskId = extractTaskId(file)
            if (!taskId) continue

            const content = readFileSync(join(completedDir, file), 'utf8')
            const { data: fm } = matter(content)

            tasksFound++
            migratedIds.add(taskId)
            await appendEvent(projectRoot, {
                type: 'task.created',
                taskId,
                title: String(fm.title ?? file),
                taskType: extractTaskType(file),
                priority: String(fm.priority ?? 'P3'),
                filePath: `.project/completed/${file}`
            })
            eventsGenerated++

            await appendEvent(projectRoot, {
                type: 'task.completed',
                taskId,
                notes: 'Migrated from completed/ directory',
                actualHours: typeof fm.actual_hours === 'number' ? fm.actual_hours : undefined
            })
            eventsGenerated++
        }
    }

    // Dependencies last: an edge to a task that was never migrated is dropped
    // rather than recorded as a permanently unsatisfiable blocker.
    for (const { taskId, dependsOn } of declaredDependencies) {
        if (!migratedIds.has(dependsOn) || taskId === dependsOn) continue
        await appendEvent(projectRoot, { type: 'task.dependency_added', taskId, dependsOn })
        eventsGenerated++
    }

    // Rebuild SQLite from the generated events
    rebuild(projectRoot, readEvents(projectRoot))

    return { tasksFound, eventsGenerated, skipped: 0 }
}

/**
 * Normalises a 1.x `depends_on` frontmatter value into canonical task IDs.
 * Accepts both `TASK-001` and the short `T001` form used by early projects.
 */
function normaliseDependsOn(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => extractTaskId(entry))
        .filter((id): id is string => id !== null)
}

/**
 * Extracts a normalized task ID from a filename.
 * "2026-01-25-TASK-001-name.md" → "TASK-001"
 * "2026-01-25-T001-name.md"    → "TASK-001"
 */
export function extractTaskId(filename: string): string | null {
    const match = filename.match(/TASK-(\d+)|T(\d+)/i)
    if (!match) return null
    const num = (match[1] ?? match[2]).padStart(3, '0')
    return `TASK-${num}`
}

/**
 * Infers task type from the filename.
 */
export function extractTaskType(filename: string): string {
    if (filename.includes('feat')) return 'feat'
    if (filename.includes('fix')) return 'fix'
    if (filename.includes('chore')) return 'chore'
    if (filename.includes('docs')) return 'docs'
    if (filename.includes('refactor')) return 'refactor'
    return 'feat'
}
