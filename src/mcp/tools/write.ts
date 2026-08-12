import { renameSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { appendEvent } from '../../core/events.js'
import {
    applyEvent,
    getTask,
    queryTasks,
    getChecksForTask,
    getDependencies,
    getAllDependencies
} from '../../core/db.js'
import { wouldCreateCycle } from '../../core/graph.js'
import { getMember } from '../../core/team.js'
import { getRequiredChecks, evaluateGate, lastActivityAt, explainGate } from '../../core/verification.js'
import { validatePathSafe } from '../../utils/path-validator.js'
import type { McpTool, ToolContext } from './index.js'

const execAsync = promisify(exec)

// Tail of command output kept as evidence — enough to diagnose a failure
// without turning events.jsonl into a log dump.
const OUTPUT_TAIL_CHARS = 2000

// Check commands are frequently whole test suites, so they get a much longer
// budget than the default 30s tool timeout.
const CHECK_TIMEOUT_MS = 300_000

interface CheckResult {
    command: string
    exitCode: number
    passed: boolean
    durationMs: number
    output: string
}

/**
 * Runs a single check command in the project root and captures its outcome.
 *
 * Commands come from the project's own config.toml, which carries the same
 * trust level as its package.json scripts — this is not a sandbox boundary.
 */
async function runCheck(command: string, projectRoot: string): Promise<CheckResult> {
    const startedAt = Date.now()
    try {
        const { stdout, stderr } = await execAsync(command, { cwd: projectRoot, timeout: CHECK_TIMEOUT_MS })
        return {
            command,
            exitCode: 0,
            passed: true,
            durationMs: Date.now() - startedAt,
            output: (stdout + stderr).slice(-OUTPUT_TAIL_CHARS)
        }
    } catch (err) {
        const e = err as { code?: number; stdout?: string; stderr?: string; message?: string }
        const output = (e.stdout ?? '') + (e.stderr ?? '') || (e.message ?? '')
        return {
            command,
            exitCode: typeof e.code === 'number' ? e.code : 1,
            passed: false,
            durationMs: Date.now() - startedAt,
            output: output.slice(-OUTPUT_TAIL_CHARS)
        }
    }
}

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

/**
 * Builds the archive filename for a completed task.
 *
 * Archived files are dated by completion, so any date the backlog file already
 * carries (its creation date) is replaced rather than prefixed — otherwise the
 * name ends up with two stacked dates.
 */
function completedFilename(filePath: string): string {
    return `${today()}-${basename(filePath).replace(/^\d{4}-\d{2}-\d{2}-/, '')}`
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
            name: 'verify_task',
            description:
                'Run the project verification checks for a task and record the result as evidence in the event log. Required before complete_task when [checks] is configured in config.toml.',
            inputSchema: {
                type: 'object',
                required: ['taskId'],
                properties: {
                    taskId: { type: 'string' },
                    commands: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Override the configured commands. Use sparingly — the config is the contract.'
                    }
                }
            }
        },
        timeoutMs: CHECK_TIMEOUT_MS,
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)

            const override = Array.isArray(args.commands)
                ? (args.commands as unknown[]).filter((c): c is string => typeof c === 'string')
                : null
            const commands = override ?? getRequiredChecks(projectRoot)

            if (commands.length === 0) {
                return {
                    taskId,
                    results: [],
                    allPassed: true,
                    message: 'No checks configured. Add [checks] commands to .project/config.toml to enable the gate.'
                }
            }

            const results: CheckResult[] = []
            // Every command runs, even after a failure — one report beats one bisect.
            for (const command of commands) {
                const result = await runCheck(command, projectRoot)
                results.push(result)

                const event = await appendEvent(projectRoot, {
                    type: 'check.run',
                    taskId,
                    command: result.command,
                    exitCode: result.exitCode,
                    passed: result.passed,
                    durationMs: result.durationMs,
                    output: result.output
                })
                applyEvent(db, event)
            }

            return {
                taskId,
                results: results.map(({ output, ...rest }) => ({ ...rest, output: output.slice(-500) })),
                allPassed: results.every((r) => r.passed)
            }
        }
    },

    {
        schema: {
            name: 'complete_task',
            description:
                'Mark a task as done. Moves the .md file to completed/ and logs the event. Rejected unless the configured verification checks passed after the task last changed — run verify_task first.',
            inputSchema: {
                type: 'object',
                required: ['taskId'],
                properties: {
                    taskId: { type: 'string' },
                    notes: { type: 'string' },
                    actualHours: { type: 'number' },
                    force: {
                        type: 'boolean',
                        description: 'Bypass the verification gate. The bypass is recorded in the event log.'
                    }
                }
            }
        },
        handler: async ({ db, projectRoot, events }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const notes = args.notes as string | undefined
            const actualHours = args.actualHours as number | undefined
            const force = args.force === true

            const task = getTask(db, taskId)
            if (!task) throw new Error(`Task ${taskId} not found`)

            const required = getRequiredChecks(projectRoot)
            if (required.length > 0 && !force) {
                const gate = evaluateGate(required, getChecksForTask(db, taskId), lastActivityAt(events, taskId))
                if (!gate.satisfied) throw new Error(explainGate(taskId, gate))
            }
            const checksBypassed = force && required.length > 0

            let fileMoved: string | null = null
            if (task.file_path) {
                const dest = `.project/completed/${completedFilename(task.file_path)}`
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

            const event = await appendEvent(projectRoot, {
                type: 'task.completed',
                taskId,
                notes,
                actualHours,
                ...(checksBypassed ? { checksBypassed: true } : {})
            })
            applyEvent(db, event)

            return { success: true, taskId, completedAt: event.timestamp, fileMoved, checksBypassed }
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
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const status = args.status as string
            const reason = args.reason as string | undefined

            const task = getTask(db, taskId)
            if (!task) throw new Error(`Task ${taskId} not found`)

            const statusEvent = await appendEvent(projectRoot, {
                type: 'task.status_changed',
                taskId,
                from: task.status,
                to: status
            })
            applyEvent(db, statusEvent)

            if (reason) {
                const commentEvent = await appendEvent(projectRoot, {
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
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const text = args.text as string

            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)

            const event = await appendEvent(projectRoot, { type: 'task.comment_added', taskId, text })
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
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const title = args.title as string
            const rationale = args.rationale as string
            const taskId = args.taskId as string | undefined
            const existingFilePath = args.filePath as string | undefined

            const decisionsDir = join(projectRoot, '.project/decisions')
            mkdirSync(decisionsDir, { recursive: true })

            let filePath: string
            if (existingFilePath) {
                // validatePathSafe resolves symlinks, preventing TOCTOU attacks
                // where a symlink is substituted between the path check and file use.
                await validatePathSafe(existingFilePath, projectRoot)
            }
            if (existingFilePath && existsSync(join(projectRoot, existingFilePath))) {
                filePath = existingFilePath
            } else {
                filePath = `.project/decisions/${today()}-ADR-${slugify(title)}.md`
                writeFileSync(join(projectRoot, filePath), adrMarkdown(title, rationale, taskId), 'utf8')
            }

            const event = await appendEvent(projectRoot, {
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
        handler: async (ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
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

            const event = await appendEvent(projectRoot, {
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
            name: 'add_dependency',
            description:
                'Declare that a task depends on another one. The dependent task stays out of the ready frontier until its dependency is done. Cycles are rejected.',
            inputSchema: {
                type: 'object',
                required: ['taskId', 'dependsOn'],
                properties: {
                    taskId: { type: 'string', description: 'The task that waits' },
                    dependsOn: { type: 'string', description: 'The task that must finish first' }
                }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const dependsOn = args.dependsOn as string

            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)
            if (!getTask(db, dependsOn)) throw new Error(`Task ${dependsOn} not found`)

            if (getDependencies(db, taskId).includes(dependsOn)) {
                return { success: true, taskId, dependsOn, alreadyExisted: true }
            }

            if (wouldCreateCycle(getAllDependencies(db), taskId, dependsOn)) {
                throw new Error(
                    `Cannot add ${taskId} → ${dependsOn}: it would create a dependency cycle. Call get_task_graph to inspect the current edges.`
                )
            }

            const event = await appendEvent(projectRoot, { type: 'task.dependency_added', taskId, dependsOn })
            applyEvent(db, event)

            return { success: true, taskId, dependsOn, alreadyExisted: false }
        }
    },

    {
        schema: {
            name: 'remove_dependency',
            description: 'Remove a dependency edge between two tasks.',
            inputSchema: {
                type: 'object',
                required: ['taskId', 'dependsOn'],
                properties: {
                    taskId: { type: 'string' },
                    dependsOn: { type: 'string' }
                }
            }
        },
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const dependsOn = args.dependsOn as string

            if (!getDependencies(db, taskId).includes(dependsOn)) {
                throw new Error(`No dependency from ${taskId} to ${dependsOn}`)
            }

            const event = await appendEvent(projectRoot, { type: 'task.dependency_removed', taskId, dependsOn })
            applyEvent(db, event)

            return { success: true, taskId, dependsOn }
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
        handler: async ({ db, projectRoot }: ToolContext, args: Record<string, unknown>): Promise<unknown> => {
            const taskId = args.taskId as string
            const assignee = args.assignee as string

            if (!getTask(db, taskId)) throw new Error(`Task ${taskId} not found`)

            const member = getMember(projectRoot, assignee)
            if (!member) throw new Error(`Team member "${assignee}" not found in config.toml`)

            const event = await appendEvent(projectRoot, { type: 'task.assigned', taskId, assignee })
            applyEvent(db, event)

            return { success: true, taskId, assignee, assigneeName: member.name }
        }
    }
]
