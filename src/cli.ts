#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { InstallOptions, UpdateOptions } from '@/types/index.js'
import { install } from './commands/install.js'
import { update } from './commands/update.js'
import { validate } from './commands/validate.js'
import { version } from './version.js'
import { logger } from '@/utils/logger.js'
import { addSkill } from './commands/add.js'
import { listSkills } from './commands/list.js'

const program = new Command()

const banner = `
    ▄▄█▄▄      █████╗ ██╗██████╗ ██╗███╗   ███╗
  ▀▀▀███▀▀▀   ██╔══██╗██║██╔══██╗██║████╗ ████║
     ███      ███████║██║██████╔╝██║██╔████╔██║
   ▄█████▄    ██╔══██║██║██╔═══╝ ██║██║╚██╔╝██║
  ▐███████▌   ██║  ██║██║██║     ██║██║ ╚═╝ ██║
   ▀█████▀    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝     ╚═╝
     ▀█▀      ═════════════════════════════════
`

program
    .name('aipim')
    .description('Artificial Intelligence Project Instruction Manager')
    .version(version)
    .addHelpText('before', chalk.blue(banner))
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
    .option('--ai <ais...>', 'AI tools to use (claude-code, gemini)')
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
    .option('--ai <ais...>', 'AI tools to use (claude-code, gemini)')
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

import { deps } from './commands/deps.js'
program.addCommand(deps)

import { completion } from './commands/completion.js'
import { registerTaskCommand } from './commands/task.js'

program
    .command('list')
    .description('List available additions (skills)')
    .argument('<type>', 'Type of item to list (e.g., "skills")')
    .action((type: string) => {
        if (type !== 'skills') {
            console.error(chalk.red('\nError: Only "skills" is supported right now. Try: aipim list skills\n'))
            process.exit(1)
        }
        listSkills()
    })

program
    .command('add')
    .description('Add an extension module to the current project')
    .argument('<type>', 'Type of item to add (e.g., "skill")')
    .argument('<name>', 'Name of the item to add')
    .action(async (type: string, name: string) => {
        if (type !== 'skill') {
            console.error(chalk.red('\nError: Only "skill" is supported right now. Try: aipim add skill <name>\n'))
            process.exit(1)
        }
        await addSkill(name)
    })
import { registerMigrateCommand } from './commands/migrate.js'
import { registerMcpCommand } from './commands/mcp.js'
import { registerTeamCommand } from './commands/team.js'
import { registerUiCommand } from './commands/ui.js'

program
    .command('completion')
    .description('Generate shell completion script')
    .action(() => {
        completion(program)
    })

registerTaskCommand(program)
registerMigrateCommand(program)
registerMcpCommand(program)
registerTeamCommand(program)
registerUiCommand(program)

if (!process.argv.slice(2).length) {
    program.outputHelp()
    process.exit(0)
}

program.parse(process.argv)
