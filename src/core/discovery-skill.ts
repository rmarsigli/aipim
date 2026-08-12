import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SKILL_TEMPLATE = 'base/discovery-skill.md'

/** Where Claude Code looks for project skills. */
export const CLAUDE_SKILL_PATH = '.claude/skills/aipim-discovery/SKILL.md'

/**
 * Harness-neutral copy of the playbook. Written for every project so agents
 * without a skills directory still have something to be pointed at.
 */
export const PROMPT_PATH = '.project/prompts/discovery.md'

export interface InstalledDiscoverySkill {
    written: string[]
}

/**
 * Installs the discovery playbook.
 *
 * The skill's frontmatter describes explicit invocation rather than intent —
 * a description like "use when the user wants to build a feature" is what makes
 * a skill fire on its own, which is exactly what discovery must not do.
 *
 * Writing is idempotent: the same content lands in the same places on every
 * install, so re-running leaves no duplicates.
 */
export function installDiscoverySkill(
    projectRoot: string,
    templatesDir: string,
    options: { claudeCode?: boolean } = {}
): InstalledDiscoverySkill {
    const source = join(templatesDir, SKILL_TEMPLATE)
    if (!existsSync(source)) {
        throw new Error(`Discovery skill template not found at ${source}`)
    }

    const written: string[] = []

    const promptTarget = join(projectRoot, PROMPT_PATH)
    mkdirSync(join(projectRoot, '.project/prompts'), { recursive: true })
    writeFileSync(promptTarget, readFileSync(source, 'utf8'), 'utf8')
    written.push(PROMPT_PATH)

    if (options.claudeCode) {
        const skillTarget = join(projectRoot, CLAUDE_SKILL_PATH)
        mkdirSync(join(projectRoot, '.claude/skills/aipim-discovery'), { recursive: true })
        copyFileSync(source, skillTarget)
        written.push(CLAUDE_SKILL_PATH)
    }

    return { written }
}
