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
export function migrate(projectRoot: string): MigrationResult {
    const existing = readEvents(projectRoot)
    if (existing.length > 0) {
        return { tasksFound: 0, eventsGenerated: 0, skipped: existing.length }
    }

    let tasksFound = 0
    let eventsGenerated = 0

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
            appendEvent(projectRoot, {
                type: 'task.created',
                taskId,
                title: String(fm.title ?? file),
                taskType: extractTaskType(file),
                priority: String(fm.priority ?? 'P3'),
                filePath: `.project/backlog/${file}`
            })
            eventsGenerated++

            if (fm.assignee) {
                appendEvent(projectRoot, {
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
            appendEvent(projectRoot, {
                type: 'task.created',
                taskId,
                title: String(fm.title ?? file),
                taskType: extractTaskType(file),
                priority: String(fm.priority ?? 'P3'),
                filePath: `.project/completed/${file}`
            })
            eventsGenerated++

            appendEvent(projectRoot, {
                type: 'task.completed',
                taskId,
                notes: 'Migrated from completed/ directory',
                actualHours: typeof fm.actual_hours === 'number' ? fm.actual_hours : undefined
            })
            eventsGenerated++
        }
    }

    // Rebuild SQLite from the generated events
    rebuild(projectRoot, readEvents(projectRoot))

    return { tasksFound, eventsGenerated, skipped: 0 }
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
