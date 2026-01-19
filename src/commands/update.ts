import { UpdateOptions, InstallConfig } from '@/types/index.js'
import { updater } from '@/core/updater.js'
import { logger } from '@/utils/logger.js'
import { detectProject } from '@/core/detector.js'
import { promptConfiguration } from '@/prompts/install.js'
import ora from 'ora'
import chalk from 'chalk'

export async function update(options: UpdateOptions = {}): Promise<void> {
    const spinner = ora('Detecting project...').start()
    const detected = await detectProject()
    spinner.succeed('Project detected')

    // Reuse install prompt logic to resolve config
    let config: InstallConfig | null

    // Force implies yes/skipConfirmation
    const skipConfirmation = options.force || options.yes || false

    if (options.ai) {
        // Non-interactive / CLI flag mode
        config = {
            ais: Array.isArray(options.ai) ? options.ai : [options.ai],
            guidelines: options.guidelines
                ? Array.isArray(options.guidelines)
                    ? options.guidelines
                    : [options.guidelines]
                : [],
            version: options.full ? 'full' : 'compact',
            skipConfirmation,
            dryRun: options.dryRun || false
        }
    } else {
        // Interactive mode
        // We reuse promptConfiguration, but we need to map options to match InstallOptions roughly
        // promptConfiguration expects InstallOptions to pre-fill prompt defaults
        logger.info('Interactive Update Mode')
        logger.info('Please select options for the update (defaults to overwrite/update selected components)')

        config = await promptConfiguration(detected, {
            ...options, // Pass through dryRun, etc
            yes: skipConfirmation
        })
    }

    if (!config) {
        logger.error('Update cancelled')
        return
    }

    spinner.start('Updating AIPIM...')

    try {
        const results = await updater.update(process.cwd(), config)
        spinner.stop()

        // Report results
        let hasChanges = false

        results.forEach((res) => {
            if (res.status === 'error') {
                logger.error(`Failed to update ${chalk.bold(res.file)}: ${res.reason}`)
            } else if (res.status === 'skipped') {
                logger.warn(`Skipped ${chalk.bold(res.file)} (${res.reason})`)
            } else if (res.status === 'updated') {
                hasChanges = true
                logger.success(`Updated ${chalk.bold(res.file)}`)
            } else if (res.status === 'created') {
                hasChanges = true
                logger.success(`Created ${chalk.bold(res.file)}`)
            }
        })

        if (!hasChanges && results.every((r) => r.status === 'skipped')) {
            logger.info('No changes were made (files were already up to date or user-modified)')
        } else if (hasChanges) {
            logger.success('Update completed successfully')
        }
    } catch (error) {
        spinner.fail('Update failed')
        throw error
    }
}
