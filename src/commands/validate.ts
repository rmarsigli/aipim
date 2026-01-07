import { logger } from '@/utils/logger.js'
import { doctor } from '@/core/doctor.js'
import chalk from 'chalk'

export async function validate(): Promise<void> {
    logger.info('Validating AIPM environment...')

    // We pass process.cwd() as the root to check
    const results = await doctor.diagnose(process.cwd())
    let hasFailures = false
    let hasWarnings = false

    /* eslint-disable no-console */
    console.log('') // Spacer

    for (const result of results) {
        if (result.status === 'pass') {
            console.log(`${chalk.green('✔')} ${result.name}: ${chalk.gray(result.message)}`)
        } else if (result.status === 'warn') {
            hasWarnings = true
            console.log(`${chalk.yellow('⚠')} ${result.name}: ${chalk.yellow(result.message)}`)
        } else {
            hasFailures = true
            console.log(`${chalk.red('✖')} ${result.name}: ${chalk.red(result.message)}`)
        }
    }

    console.log('') // Spacer
    /* eslint-enable no-console */

    if (hasFailures) {
        logger.error('Validation failed. Please fix the issues above.')
        process.exit(1) // Return error code for CI
    } else if (hasWarnings) {
        logger.success('Validation passed with warnings.')
    } else {
        logger.success('All checks passed!')
    }
}
