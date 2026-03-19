import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import matter from 'gray-matter'
import { queryTasks, getNextTask, getBlockers, getTask, getCommentsForTask, getStats } from '../../core/db.js'
import { readEventsForTask } from '../../core/events.js'
import type { McpTool, ToolContext } from './index.js'

function currentBranch(): string {
    try {
        return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
    } catch {
        return 'unknown'
    }
}

function readContextMd(projectRoot: string): { session?: number; nextAction?: string } {
    const path = join(projectRoot, '.project/context.md')
    if (!existsSync(path)) return {}
    try {
        const { data } = matter(readFileSync(path, 'utf8'))
        return { session: data.session as number | undefined, nextAction: data.next_action as string | undefined }
    } catch {
        return {}
    }
}

export function readFileSafe(projectRoot: string, filePath: string | null): string | null {
    if (!filePath) return null
    const full = join(projectRoot, filePath)
    return existsSync(full) ? readFileSync(full, 'utf8') : null
}

function daysSince(timestamp: string): number {
    return Math.floor((Date.now() - new Date(timestamp).getTime()) / 86_400_000)
}

export const readTools: McpTool[] = [
    {
        schema: {
            name: 'get_project_context',
            description: 'Get a full overview of the project state. Call this at the start of every session.',
            inputSchema: { type: 'object', properties: {} }
        },
        handler: ({ db, projectRoot, events }: ToolContext): unknown => {
            const stats = getStats(db)
            const total = Object.values(stats).reduce((a, b) => a + b, 0)
            const inProgress = queryTasks(db, { status: 'in-progress' })
            const nextTask = getNextTask(db)
            const blockers = getBlockers(db)
            const recentEvents = events.slice(-10)
            const ctx = readContextMd(projectRoot)
            const branch = currentBranch()

            return {
                stats: { total, byStatus: stats },
                currentTask: inProgress[0] ?? null,
                nextTask: nextTask ?? null,
                blockers,
                recentEvents,
                session: { number: ctx.session ?? null, branch, nextAction: ctx.nextAction ?? null }
            }
        }
    },

    {
        schema: {
            name: 'get_next_task',
            description: 'Get the next task to work on, ordered by real priority (P1-S first, not alphabetical).',
            inputSchema: { type: 'object', properties: {} }
        },
        handler: ({ db, projectRoot }: ToolContext): unknown => {
            const task = getNextTask(db)
            if (!task) return { message: 'No tasks in backlog. All done!' }
            const content = readFileSafe(projectRoot, task.file_path)
            const comments = getCommentsForTask(db, task.id)
            return { ...task, content, comments }
        }
    },

    {
        schema: {
            name: 'list_tasks',
            description: 'List tasks with optional filters, ordered by priority.',
            inputSchema: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['backlog', 'in-progress', 'review', 'done', 'blocked']
                    },
                    assignee: { type: 'string' },
                    priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
                    limit: { type: 'number', description: 'Max results (default 20)' }
                }
            }
        },
        handler: ({ db }: ToolContext, args: Record<string, unknown>): unknown => {
            const limit = typeof args.limit === 'number' ? args.limit : 20
            const filter = {
                status: args.status as string | undefined,
                assignee: args.assignee as string | undefined,
                priority: args.priority as string | undefined
            }
            return queryTasks(db, filter).slice(0, limit)
        }
    },

    {
        schema: {
            name: 'get_task',
            description: 'Get full details of a specific task including markdown content, comments, and event history.',
            inputSchema: {
                type: 'object',
                required: ['taskId'],
                properties: { taskId: { type: 'string', description: 'Task ID, e.g. TASK-007' } }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const taskId = args.taskId as string
            const task = getTask(db, taskId)
            if (!task) return { error: `Task ${taskId} not found` }
            const content = readFileSafe(projectRoot, task.file_path)
            const comments = getCommentsForTask(db, taskId)
            const taskEvents = readEventsForTask(projectRoot, taskId)
            return { ...task, content, comments, events: taskEvents }
        }
    },

    {
        schema: {
            name: 'get_blockers',
            description: 'Get all blocked tasks with how long they have been blocked.',
            inputSchema: { type: 'object', properties: {} }
        },
        handler: ({ db, projectRoot }: ToolContext): unknown => {
            const blocked = getBlockers(db)
            return blocked.map((task) => {
                const taskEvents = readEventsForTask(projectRoot, task.id)
                const lastStatusChange = [...taskEvents].reverse().find((e) => e.type === 'task.status_changed')
                const blockedSince = lastStatusChange?.timestamp ?? task.updated_at
                return {
                    ...task,
                    blockedSince,
                    blockedForDays: daysSince(blockedSince)
                }
            })
        }
    }
]
