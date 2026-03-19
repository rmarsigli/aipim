import chalk from 'chalk'
import { skillRegistry } from '@/core/skills.js'
import { logger } from '@/utils/logger.js'

export async function addSkill(skillId: string): Promise<void> {
    logger.info(`Adding skill: ${chalk.cyan(skillId)}`)

    const skill = skillRegistry.get(skillId)
    if (!skill) {
        logger.error(`Skill '${skillId}' is not available in the registry.`)
        logger.info(`Run ${chalk.cyan('aipim list skills')} to see available modules.`)
        process.exit(1)
    }

    try {
        await skillRegistry.injectSkill(skillId, process.cwd())
        // logger.success happens inside injectSkill currently once implemented fully
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to add skill: ${message}`)
        process.exit(1)
    }
}
