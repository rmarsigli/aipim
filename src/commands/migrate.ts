import { Command } from 'commander'
import { migrate } from '@/core/migrator.js'
import { logger } from '@/utils/logger.js'

export function registerMigrateCommand(program: Command): void {
    program
        .command('migrate')
        .description('Migrate existing AIPIM 1.x project to 2.0 (events.jsonl + SQLite)')
        .action(() => {
            logger.info('Scanning existing project...')

            try {
                const result = migrate(process.cwd())

                if (result.skipped > 0) {
                    logger.info(`Already migrated: ${result.skipped} events preserved`)
                    return
                }

                logger.success(`Migrated ${result.tasksFound} tasks → ${result.eventsGenerated} events`)
            } catch (error) {
                logger.error('Migration failed')
                if (error instanceof Error) logger.debug(error.message)
                process.exit(1)
            }
        })
}
