import ora from 'ora'
import chalk from 'chalk'
import { detectProject } from '@/core/detector.js'
import { installProject } from '@/core/installer.js'
import { promptConfiguration } from '@/prompts/install.js'
import { InstallConfig, InstallOptions } from '@/types/index.js'
import { logger } from '@/utils/logger.js'

export async function install(options: InstallOptions = {}): Promise<void> {
    const spinner = ora('Detecting project...').start()
    const detected = await detectProject()
    spinner.stop()
    logger.success('Project detected')

    if (detected.framework) {
        logger.info(`Found: ${detected.framework} project`)
    }
    if (detected.hasGit) {
        logger.info('Git repository: Yes')
    }
    if (detected.packageManager) {
        logger.info(`Package manager: ${detected.packageManager}`)
    }

    let config: InstallConfig | null

    if (options.preset) {
        logger.warn('Preset feature coming soon, using interactive mode')
        config = await promptConfiguration(detected, options)
    } else if (options.ai) {
        config = {
            ais: Array.isArray(options.ai) ? options.ai : [options.ai],
            guidelines: options.guidelines
                ? Array.isArray(options.guidelines)
                    ? options.guidelines
                    : [options.guidelines]
                : [],
            version: options.full ? 'full' : 'compact',
            skipConfirmation: options.yes || false,
            dryRun: options.dryRun || false
        }
    } else {
        config = await promptConfiguration(detected, options)
    }

    if (!config) {
        logger.error('Installation cancelled')
        return
    }

    spinner.start('Installing...')

    await installProject(config, detected)

    spinner.stop()
    logger.success('Installation complete!')

    logger.info('Next steps:')
    logger.info(`  1. Edit ${chalk.cyan('.project/context.md')} with your project details`)
    logger.info(
        `  2. Read the guide: ${chalk.blue('https://github.com/rmarsigli/aipim/blob/main/docs/basic-usage.md')}`
    )
    logger.info(`  3. Run ${chalk.cyan('.project/scripts/pre-session.sh')} to verify setup`)
    logger.info(
        `  4. Start coding! (Copy task template to start: ${chalk.cyan('cp .project/_templates/v1/task-template.md .project/current-task.md')})`
    )

    if (config.ais.includes('claude-code') || config.ais.includes('claude-ai')) {
        logger.info('Start your AI session with:')
        logger.info(' "Follow session start protocol and continue development"')
    }
}
