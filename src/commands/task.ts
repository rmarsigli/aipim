import { Command } from 'commander'
import { taskManager } from '@/core/task-manager.js'
import { logger } from '@/utils/logger.js'
import chalk from 'chalk'

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
}
