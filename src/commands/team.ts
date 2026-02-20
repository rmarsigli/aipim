import { Command } from 'commander'
import { input, select } from '@inquirer/prompts'
import chalk from 'chalk'
import { loadConfig, resolveActor, getMember, addTeamMember, TeamMember } from '@/core/team.js'
import { logger } from '@/utils/logger.js'
import { output } from '@/utils/output.js'

export function registerTeamCommand(program: Command): void {
    const team = program.command('team').description('Manage team members')

    team.command('list')
        .description('List team members from config.toml')
        .action(() => {
            const cwd = process.cwd()
            const config = loadConfig(cwd)
            const log = output.print.bind(output)

            if (!config) {
                logger.warn('No config.toml found. Run `aipim install` to create one.')
                process.exit(0)
            }

            if (!config.team || config.team.length === 0) {
                logger.warn('No team members configured.')
                process.exit(0)
            }

            log('')
            log(chalk.bold(`Team — ${config.project.name}`))
            log('')
            for (const m of config.team) {
                const areas = m.areas?.join(', ')
                const role = m.role ? chalk.gray(`[${m.role}]`) : ''
                const areasStr = areas ? chalk.gray(`  ${areas}`) : ''
                log(`  ${chalk.cyan(m.id)}  ${m.name}  <${m.email}>  ${role}${areasStr}`)
            }
            log('')
        })

    team.command('whoami')
        .description('Show the resolved actor identity for this machine')
        .action(() => {
            const cwd = process.cwd()
            const actor = resolveActor(cwd)
            const member = getMember(cwd, actor)
            const log = output.print.bind(output)

            log('')
            if (member) {
                log(`  ${chalk.bold('Actor:')} ${chalk.cyan(member.id)}`)
                log(`  ${chalk.bold('Name:')}  ${member.name}`)
                log(`  ${chalk.bold('Email:')} ${member.email}`)
                if (member.role) log(`  ${chalk.bold('Role:')}  ${member.role}`)
            } else {
                log(`  ${chalk.bold('Actor:')} ${chalk.cyan(actor)}`)
                log(chalk.gray('  (not in config.toml team)'))
            }
            log('')
        })

    team.command('add')
        .description('Add a team member to config.toml')
        .action(async () => {
            const cwd = process.cwd()

            const id = await input({
                message: 'Member ID (short slug, e.g. alice):',
                validate: (v) => (v.trim().length > 0 ? true : 'Required')
            })

            const name = await input({
                message: 'Full name:',
                validate: (v) => (v.trim().length > 0 ? true : 'Required')
            })

            const email = await input({
                message: 'Email:',
                validate: (v) => (v.includes('@') ? true : 'Invalid email')
            })

            const role = await select({
                message: 'Role:',
                choices: [
                    { name: 'tech-lead', value: 'tech-lead' },
                    { name: 'dev', value: 'dev' },
                    { name: 'designer', value: 'designer' },
                    { name: 'pm', value: 'pm' },
                    { name: 'qa', value: 'qa' },
                    { name: '(none)', value: '' }
                ]
            })

            const areasInput = await input({
                message: 'Areas (comma-separated, optional):'
            })

            const member: TeamMember = {
                id: id.trim(),
                name: name.trim(),
                email: email.trim(),
                ...(role ? { role } : {}),
                ...(areasInput.trim()
                    ? {
                          areas: areasInput
                              .split(',')
                              .map((a) => a.trim())
                              .filter(Boolean)
                      }
                    : {})
            }

            addTeamMember(cwd, member)
            logger.success(`Team member ${chalk.cyan(member.id)} added to .project/config.toml`)
        })
}
