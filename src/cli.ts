#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { InstallOptions, UpdateOptions } from '@/types/index.js'
import { install } from './commands/install.js'
import { update } from './commands/update.js'
import { diff } from './commands/diff.js'
import { validate } from './commands/validate.js'
import { version } from './version.js'
import { logger } from '@/utils/logger.js'

const program = new Command()

const banner = `
    _    ___ ____ ___ __  __
   / \\  |_ _|  _ \\_ _|  \\/  |
  / _ \\  | || |_) | || |\\/| |
 / ___ \\ | ||  __/| || |  | |
/_/   \\_\\___|_|  |___|_|  |_|
`

program
    .name('aipim')
    .description('Artificial Intelligence Project Instruction Manager')
    .version(version)
    .option('-v, --verbose', 'Enable verbose logging')
    .hook('preAction', (thisCommand) => {
        const options = thisCommand.opts()
        if (options.verbose) {
            logger.setVerbose(true)
            logger.debug('Verbose mode enabled')
        }
    })

program
    .command('install')
    .description('Install AIPIM in current directory')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-p, --preset <name>', 'Use preset configuration')
    .option('--ai <ais...>', 'AI tools to use (claude-code, gemini, chatgpt)')
    .option('--guidelines <frameworks...>', 'Framework guidelines (react, astro)')
    .option('--compact', 'Use compact version (default)', true)
    .option('--full', 'Use full version')
    .option('--dry-run', 'Simulate actions without writing files')
    .action(async (options: unknown) => {
        /* eslint-disable no-console */
        console.log(chalk.blue(banner))
        console.log(chalk.blue(`AIPIM v${version}\n`))
        /* eslint-enable no-console */

        try {
            await install(options as InstallOptions)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(chalk.red(`\nError: ${message}\n`))
            process.exit(1)
        }
    })

program
    .command('update')
    .description('Update existing installation')
    .option('-f, --force', 'Overwrite customizations')
    .option('--ai <ais...>', 'AI tools to use (claude-code, gemini, chatgpt)')
    .option('--guidelines <frameworks...>', 'Framework guidelines (react, astro)')
    .option('--compact', 'Use compact version (default)', true)
    .option('--full', 'Use full version')
    .option('--dry-run', 'Simulate actions without writing files')
    .action(async (options: unknown) => {
        /* eslint-disable no-console */
        console.log(chalk.blue(banner))
        console.log(chalk.blue(`AIPIM v${version}\n`))
        /* eslint-enable no-console */

        try {
            await update(options as UpdateOptions)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(chalk.red(`\nError: ${message}\n`))
            process.exit(1)
        }
    })

program
    .command('diff')
    .description('Show what would change with update')
    .action(async () => {
        try {
            await diff()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(chalk.red(`\nError: ${message}\n`))
            process.exit(1)
        }
    })

program
    .command('validate')
    .description('Validate current installation')
    .action(async () => {
        try {
            await validate()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(chalk.red(`\nError: ${message}\n`))
            process.exit(1)
        }
    })

import { completion } from './commands/completion.js'
import { registerTaskCommand } from './commands/task.js'

program
    .command('completion')
    .description('Generate shell completion script')
    .action(() => {
        completion(program)
    })

registerTaskCommand(program)

program.parse(process.argv)

if (!process.argv.slice(2).length) {
    program.outputHelp()
    process.exit(0)
}
