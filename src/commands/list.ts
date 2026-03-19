import chalk from 'chalk'
import { skillRegistry } from '@/core/skills.js'

export function listSkills(): void {
    const skills = skillRegistry.list()

    /* eslint-disable no-console */
    console.log(chalk.bold('\nAvailable Skills:\n'))

    if (skills.length === 0) {
        console.log(chalk.gray('  No skills available.'))
        return
    }

    skills.forEach((skill) => {
        console.log(`  ${chalk.cyan(skill.id.padEnd(15))} ${chalk.white(skill.name)}`)
        console.log(`  ${''.padEnd(15)} ${chalk.gray(skill.description)}\n`)
    })
    /* eslint-enable no-console */
}
