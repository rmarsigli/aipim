import { renameSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { appendEvent } from '../../core/events.js'
import { applyEvent, getTask, queryTasks } from '../../core/db.js'
import { getMember } from '../../core/team.js'
import type { McpTool, ToolContext } from './index.js'

function nextTaskId(ctx: ToolContext): string {
    const tasks = queryTasks(ctx.db)
    const max = tasks.reduce((m, t) => {
        const match = t.id.match(/TASK-(\d+)/)
        const num = match ? parseInt(match[1], 10) : 0
        return Math.max(m, num)
    }, 0)
    return `TASK-${(max + 1).toString().padStart(3, '0')}`
}

function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40)
}

function today(): string {
    return new Date().toISOString().split('T')[0]
}

function adrMarkdown(title: string, rationale: string, taskId?: string): string {
    const taskLine = taskId ? `taskId: ${taskId}\n` : ''
    return `---
title: "${title}"
date: ${today()}
${taskLine}status: Accepted
---

# ${title}

## Rationale

${rationale}

## Status

Accepted
`
}

function taskMarkdown(title: string, taskId: string, priority: string, taskType: string, description?: string): string {
    return `---
title: "${title}"
created: ${new Date().toISOString()}
priority: ${priority}
status: backlog
tags: [${taskType}]
---

# ${title}
${description ? `\n${description}\n` : ''}
`
}

export const writeTools: McpTool[] = [
    {
        schema: {
            name: 'complete_task',
            description: 'Mark a task as done. Moves the .md file to completed/ and logs the event.',
            inputSchema: {
                type: 'object',
                required: ['taskId'],
                properties: {
                    taskId: { type: 'string' },
                    notes: { type: 'string' },
                    actualHours: { type: 'number' }
                }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const taskId = args.taskId as string
            const notes = args.notes as string | undefined
            const actualHours = args.actualHours as number | undefined

            const task = getTask(db, taskId)
            if (!task) throw new Error(`Task ${taskId} not found`)

            let fileMoved: string | null = null
            if (task.file_path) {
                const dest = `.project/completed/${today()}-${basename(task.file_path)}`
                const srcFull = join(projectRoot, task.file_path)
                const destFull = join(projectRoot, dest)
                mkdirSync(join(projectRoot, '.project/completed'), { recursive: true })
                try {
                    renameSync(srcFull, destFull)
                    fileMoved = dest
                } catch (err) {
                    // File may not exist if the task was created without a markdown file — ignore.
                    const code = (err as NodeJS.ErrnoException).code
                    if (code !== 'ENOENT') throw err
                }
            }

            const event = appendEvent(projectRoot, { type: 'task.completed', taskId, notes, actualHours })
            applyEvent(db, event)

            return { success: true, taskId, completedAt: event.timestamp, fileMoved }
        }
    },

    {
        schema: {
            name: 'update_task_status',
            description: 'Update the status of a task.',
            inputSchema: {
                type: 'object',
                required: ['taskId', 'status'],
                properties: {
                    taskId: { type: 'string' },
                    status: { type: 'string', enum: ['backlog', 'in-progress', 'review', 'blocked'] },
                    reason: { type: 'string' }
                }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const taskId = args.taskId as string
            const status = args.status as string
            const reason = args.reason as string | undefined

            const task = getTask(db, taskId)
            if (!task) throw new Error(`Task ${taskId} not found`)

            const statusEvent = appendEvent(projectRoot, {
                type: 'task.status_changed',
                taskId,
                from: task.status,
                to: status
            })
            applyEvent(db, statusEvent)

            if (reason) {
                const commentEvent = appendEvent(projectRoot, {
                    type: 'task.comment_added',
                    taskId,
                    text: `Status changed to ${status}: ${reason}`
                })
                applyEvent(db, commentEvent)
            }

            return { success: true, taskId, from: task.status, to: status }
        }
    },

    {
        schema: {
            name: 'add_comment',
            description: 'Add a comment to a task. Comments are immutable once written.',
            inputSchema: {
                type: 'object',
                required: ['taskId', 'text'],
                properties: {
                    taskId: { type: 'string' },
                    text: { type: 'string' }
                }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const taskId = args.taskId as string
            const text = args.text as string

            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)

            const event = appendEvent(projectRoot, { type: 'task.comment_added', taskId, text })
            applyEvent(db, event)

            return { success: true, commentId: event.id, taskId, text, timestamp: event.timestamp }
        }
    },

    {
        schema: {
            name: 'log_decision',
            description:
                'Log an architectural decision (ADR). Creates a .md file in .project/decisions/. If the file already exists (e.g. hand-written ADR), pass filePath to link it without overwriting.',
            inputSchema: {
                type: 'object',
                required: ['title', 'rationale'],
                properties: {
                    title: { type: 'string' },
                    rationale: { type: 'string' },
                    taskId: { type: 'string' },
                    filePath: {
                        type: 'string',
                        description:
                            'Relative path to an existing .md file. If provided, the file is linked as-is instead of creating a new one.'
                    }
                }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const title = args.title as string
            const rationale = args.rationale as string
            const taskId = args.taskId as string | undefined
            const existingFilePath = args.filePath as string | undefined

            const decisionsDir = join(projectRoot, '.project/decisions')
            mkdirSync(decisionsDir, { recursive: true })

            let filePath: string
            if (existingFilePath && existsSync(join(projectRoot, existingFilePath))) {
                filePath = existingFilePath
            } else {
                filePath = `.project/decisions/${today()}-ADR-${slugify(title)}.md`
                writeFileSync(join(projectRoot, filePath), adrMarkdown(title, rationale, taskId), 'utf8')
            }

            const event = appendEvent(projectRoot, {
                type: 'decision.logged',
                title,
                rationale,
                taskId,
                filePath
            })
            applyEvent(db, event)

            return { success: true, decisionId: event.id, filePath }
        }
    },

    {
        schema: {
            name: 'create_task',
            description: 'Create a new task in the backlog.',
            inputSchema: {
                type: 'object',
                required: ['title', 'taskType', 'priority'],
                properties: {
                    title: { type: 'string' },
                    taskType: {
                        type: 'string',
                        enum: ['feat', 'fix', 'chore', 'docs', 'refactor', 'test']
                    },
                    priority: {
                        type: 'string',
                        enum: ['P1-S', 'P1-M', 'P1-L', 'P2-S', 'P2-M', 'P2-L', 'P3']
                    },
                    description: { type: 'string' }
                }
            }
        },
        handler: (ctx: ToolContext, args: Record<string, unknown>): unknown => {
            const { db, projectRoot } = ctx
            const title = args.title as string
            const taskType = args.taskType as string
            const priority = args.priority as string
            const description = args.description as string | undefined

            const taskId = nextTaskId(ctx)
            const filePath = `.project/backlog/${today()}-${taskId}-${slugify(title)}.md`

            mkdirSync(join(projectRoot, '.project/backlog'), { recursive: true })
            writeFileSync(
                join(projectRoot, filePath),
                taskMarkdown(title, taskId, priority, taskType, description),
                'utf8'
            )

            const event = appendEvent(projectRoot, {
                type: 'task.created',
                taskId,
                title,
                taskType,
                priority,
                filePath
            })
            applyEvent(db, event)

            return { success: true, taskId, filePath }
        }
    },

    {
        schema: {
            name: 'assign_task',
            description: 'Assign a task to a team member. The assignee must be a member ID from config.toml.',
            inputSchema: {
                type: 'object',
                required: ['taskId', 'assignee'],
                properties: {
                    taskId: { type: 'string' },
                    assignee: { type: 'string', description: 'Member ID from config.toml (e.g. "alice")' }
                }
            }
        },
        handler: ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): unknown => {
            const taskId = args.taskId as string
            const assignee = args.assignee as string

            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)

            const member = getMember(projectRoot, assignee)
            if (!member) throw new Error(`Team member "${assignee}" not found in config.toml`)

            const event = appendEvent(projectRoot, { type: 'task.assigned', taskId, assignee })
            applyEvent(db, event)

            return { success: true, taskId, assignee, assigneeName: member.name }
        }
    }
]
