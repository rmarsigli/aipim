import { Command } from 'commander'
import { taskManager } from '@/core/task-manager.js'
import { logger } from '@/utils/logger.js'
import { output } from '@/utils/output.js'
import chalk from 'chalk'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export interface TaskSummary {
    file: string
    title: string
    priority: string
    created: string
}

const PRIORITY_ORDER: Record<string, number> = {
    'P1-S': 1,
    'P1-M': 2,
    'P1-L': 3,
    'P2-S': 4,
    'P2-M': 5,
    'P2-L': 6,
    P3: 7
}

/**
 * Selects the highest-priority task from a list of backlog .md files.
 * Order: P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3, oldest first on tie.
 */
export function resolveNextTask(files: string[], backlogDir: string): TaskSummary | null {
    if (files.length === 0) return null

    const tasks: TaskSummary[] = files.map((file) => {
        const content = readFileSync(join(backlogDir, file), 'utf-8')
        const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m)
        const priorityMatch = content.match(/^priority:\s*(.+?)\s*$/m)
        const createdMatch = content.match(/^created:\s*(.+?)\s*$/m)
        return {
            file,
            title: titleMatch?.[1] ?? file,
            priority: priorityMatch?.[1]?.trim() ?? 'P3',
            created: createdMatch?.[1] ?? file
        }
    })

    tasks.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 8
        const pb = PRIORITY_ORDER[b.priority] ?? 8
        if (pa !== pb) return pa - pb
        return a.created.localeCompare(b.created)
    })

    return tasks[0]
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
    const cwd = process.cwd()
    const projectDir = join(cwd, '.project')

    if (!existsSync(projectDir)) {
        logger.error('No .project directory found. Run `aipim install` first.')
        process.exit(1)
    }

    const backlogDir = join(projectDir, 'backlog')
    if (!existsSync(backlogDir)) {
        logger.error('No backlog directory found.')
        process.exit(1)
    }

    const backlogFiles = readdirSync(backlogDir).filter((f) => f.endsWith('.md'))

    if (backlogFiles.length === 0) {
        logger.warn('No tasks in backlog. All done!')
        process.exit(0)
    }

    const next = resolveNextTask(backlogFiles, backlogDir)
    if (!next) {
        logger.warn('No tasks in backlog. All done!')
        process.exit(0)
    }

    log('')
    log(chalk.bold('Next task:'))
    log(`  ${chalk.cyan(next.title)}`)
    log(`  Priority: ${chalk.yellow(next.priority)}`)
    log(`  File: ${chalk.gray(next.file)}`)
    log('')
    log(chalk.gray(`  ${backlogFiles.length - 1} more task(s) in backlog`))
    log('')
}
