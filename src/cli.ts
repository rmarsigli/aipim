#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { install } from './commands/install'
import { update } from './commands/update'
// @ts-ignore
import { version } from '../package.json'

const program = new Command()

const banner = `
 █████╗ ██╗██████╗ ███╗   ███╗
██╔══██╗██║██╔══██╗████╗ ████║
███████║██║██████╔╝██╔████╔██║
██╔══██║██║██╔═══╝ ██║╚██╔╝██║
██║  ██║██║██║     ██║ ╚═╝ ██║
╚═╝  ╚═╝╚═╝╚═╝     ╚═╝     ╚═╝
`

program
    .name('aipm')
    .description('AI-optimized project management system')
    .version(version)

program
    .command('install')
    .description('Install AIPM in current directory')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-p, --preset <name>', 'Use preset configuration')
    .option('--ai <ais...>', 'AI tools to use (claude-code, gemini, chatgpt)')
    .option('--guidelines <frameworks...>', 'Framework guidelines (react, astro)')
    .option('--compact', 'Use compact version (default)', true)
    .option('--full', 'Use full version')
    .action(async (options) => {
        console.log(chalk.blue(banner))
        console.log(chalk.blue(`AIPM v${version}\n`))
        
        try {
            await install(options)
        } catch (error: any) {
            console.error(chalk.red(`\n❌ Error: ${error.message}\n`))
            process.exit(1)
        }
    })

program
    .command('update')
    .description('Update existing installation')
    .option('-f, --force', 'Overwrite customizations')
    .action(async (options) => {
        console.log(chalk.blue(banner))
        console.log(chalk.blue(`AIPM v${version}\n`))
        
        try {
            await update(options)
        } catch (error: any) {
            console.error(chalk.red(`\n❌ Error: ${error.message}\n`))
            process.exit(1)
        }
    })

program
    .command('diff')
    .description('Show what would change with update')
    .action(async () => {
        console.log(chalk.yellow('\n🔍 Diff command coming soon!\n'))
    })

program
    .command('validate')
    .description('Validate current installation')
    .action(async () => {
        console.log(chalk.yellow('\n🔍 Validate command coming soon!\n'))
    })

program.parse(process.argv)

if (!process.argv.slice(2).length) {
    program.outputHelp()
}
