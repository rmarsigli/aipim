import { Command } from 'commander'
import { taskManager } from '@/core/task-manager.js'
import { logger } from '@/utils/logger.js'
import { output } from '@/utils/output.js'
import chalk from 'chalk'
import { existsSync } from 'fs'
import { join } from 'path'
import { readEvents } from '@/core/events.js'
import { rebuild, openDb, type TaskRow } from '@/core/db.js'
import { loadTaskGraph, getNextReadyTask } from '@/core/graph.js'

export interface NextTaskResult {
    /** Highest-priority task that is actually startable, or null when none is. */
    task: TaskRow | null
    /** How many other tasks are also ready right now. */
    remainingReady: number
    /** Unfinished tasks that cannot start yet. */
    blocked: string[]
    cycles: string[][]
}

/**
 * Resolves the next task to work on from the event log.
 *
 * Shares `getNextReadyTask` with the MCP `get_next_task` tool, so the CLI and an
 * agent can never disagree about what comes next — and neither hands out a task
 * that is still blocked by unfinished work.
 */
export function resolveNextTask(projectRoot: string): NextTaskResult {
    rebuild(projectRoot, readEvents(projectRoot))
    const db = openDb(projectRoot)

    try {
        const task = getNextReadyTask(db) ?? null
        const graph = loadTaskGraph(db)

        return {
            task,
            remainingReady: Math.max(graph.ready.length - (task ? 1 : 0), 0),
            blocked: graph.blocked,
            cycles: graph.cycles
        }
    } finally {
        db.close()
    }
}

export function registerTaskCommand(program: Command): void {
    const task = program.command('task').description('Manage project tasks')

    task.command('init')
        .argument('<type>', 'Task type (feat, fix, chore, etc.)')
        .argument('<name>', 'Task name')
        .description('Initialize a new task')
        .action(async (type: string, name: string) => {
            try {
                logger.info(`Creating new task: ${type}/${name}...`)
                const path = await taskManager.initTask(process.cwd(), { type, name })
                logger.success(`Task created: ${chalk.bold(path)}`)
                logger.info('Backlog updated successfully.')
            } catch (error) {
                logger.error('Failed to create task')
                if (error instanceof Error) {
                    logger.debug(error.message)
                }
                process.exit(1)
            }
        })

    task.command('next')
        .description('Show the next task in the backlog by priority')
        .action(() => {
            nextTask()
        })
}

function nextTask(): void {
    const log = output.print.bind(output)
    const projectRoot = process.cwd()

    if (!existsSync(join(projectRoot, '.project'))) {
        logger.error('No .project directory found. Run `aipim install` first.')
        process.exit(1)
    }

    const { task, remainingReady, blocked, cycles } = resolveNextTask(projectRoot)

    if (cycles.length > 0) {
        log('')
        log(chalk.red.bold('Circular dependencies detected:'))
        for (const cycle of cycles) log(chalk.red(`  ${[...cycle, cycle[0]].join(' \u2192 ')}`))
    }

    if (!task) {
        if (blocked.length > 0) {
            logger.warn(`Nothing is ready to start. Blocked: ${blocked.join(', ')}`)
            logger.info('Run `aipim deps` to see what each one is waiting on.')
        } else {
            logger.warn('No tasks in backlog. All done!')
        }
        process.exit(0)
    }

    log('')
    log(chalk.bold('Next task:'))
    log(`  ${chalk.cyan(`${task.id}: ${task.title}`)}`)
    log(`  Priority: ${chalk.yellow(task.priority)}`)
    if (task.file_path) log(`  File: ${chalk.gray(task.file_path)}`)
    log('')
    log(chalk.gray(`  ${remainingReady} more task(s) ready`))
    if (blocked.length > 0) log(chalk.gray(`  ${blocked.length} task(s) blocked`))
    log('')
}
