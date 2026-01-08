import { checkbox, select, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { DetectedProject, InstallConfig } from '@/types/index.js'
import { AI_TOOLS, PROMPTS } from '@/constants.js'
import { logger } from '@/utils/logger.js'
import { guidelineRegistry } from '@/core/guidelines.js'

export async function promptConfiguration(
    detected: DetectedProject,
    options: Partial<InstallConfig> & { yes?: boolean } = {}
): Promise<InstallConfig | null> {
    logger.info(chalk.blue('\nInstallation Options\n'))

    const theme = {
        prefix: '',
        icon: {
            cursor: '-',
            checked: '[x]',
            unchecked: '[ ]'
        }
    }

    const ais = await checkbox({
        message: 'Which AI tools will you use?',
        choices: [
            { name: 'Claude Code (terminal AI assistant)', value: AI_TOOLS.CLAUDE_CODE, checked: true },
            { name: 'Claude.ai (web interface)', value: AI_TOOLS.CLAUDE_AI, checked: true },
            { name: 'Google Gemini', value: AI_TOOLS.GEMINI, checked: false },
            { name: 'ChatGPT', value: AI_TOOLS.CHATGPT, checked: false }
        ],
        validate: (answer: unknown): boolean | string => {
            if (Array.isArray(answer) && answer.length < 1) {
                return 'You must choose at least one AI tool.'
            }
            return true
        },
        theme
    })

    const allGuidelines = guidelineRegistry.list()
    const guidelineChoices = allGuidelines.map((g) => ({
        name: g.name,
        value: g.id,
        checked: detected.framework === g.id || detected.framework?.includes(g.id)
    }))

    const guidelines = await checkbox({
        message: 'Add framework-specific guidelines?',
        choices: guidelineChoices,
        theme
    })

    const version = await select<'compact' | 'full'>({
        message: 'Choose system version:',
        choices: [
            {
                name: 'Compact (1,000 tokens, optimized) [RECOMMENDED]',
                value: 'compact',
                short: 'Compact'
            },
            {
                name: 'Full (4,000 tokens, comprehensive)',
                value: 'full',
                short: 'Full'
            }
        ],
        default: 'compact',
        theme
    })

    if (!options.yes) {
        logger.info(chalk.blue('\nInstallation Summary\n'))
        if (options.dryRun) {
            logger.warn('  DRY RUN MODE: No files will be created\n')
        }
        logger.info('Files to be created:')
        logger.info(chalk.gray('  • .project/ (directory structure)'))

        const tokens = version === 'compact' ? '~1,000' : '~4,000'
        ais.forEach((ai: string) => {
            const filename = getPromptFilename(ai)
            logger.info(chalk.gray(`  • ${filename} (${tokens} tokens${guidelines.length > 0 ? ' + guidelines' : ''})`))
        })

        const existingFiles = detected.existingSetup.hasPrompts
        if (existingFiles.length > 0) {
            logger.warn('\n Warning: This will replace existing files:')
            existingFiles.forEach((f: string) => logger.warn(`   • ${f}`))
        }

        const confirmed = await confirm({
            message: 'Proceed with installation?',
            default: true,
            theme
        })

        if (!confirmed) {
            return null
        }
    }

    return {
        ais,
        guidelines,
        version,
        skipConfirmation: options.yes || false,
        dryRun: options.dryRun
    }
}

function getPromptFilename(ai: string): string {
    const filenames: Record<string, string> = {
        [AI_TOOLS.CLAUDE_CODE]: PROMPTS.CLAUDE,
        [AI_TOOLS.CLAUDE_AI]: PROMPTS.CLAUDE,
        [AI_TOOLS.GEMINI]: PROMPTS.GEMINI,
        [AI_TOOLS.CHATGPT]: PROMPTS.CHATGPT
    }

    return filenames[ai] || `${ai.toUpperCase()}.md`
}
