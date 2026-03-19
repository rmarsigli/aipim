import { statSync } from 'fs'
import { join } from 'path'
import { McpTool } from '../tools/index.js'
import { ActiveSkill } from './types.js'
import { databaseSkill } from './database/index.js'
import { loadConfig } from '../../core/team.js'
import { logger } from '../../utils/logger.js'

export type { ActiveSkill }

interface ConfigCache {
    mtime: number
    activeSkillIds: string[]
}

export class ActiveSkillRegistry {
    private availableSkills: ActiveSkill[] = [databaseSkill]
    private configCache = new Map<string, ConfigCache>()

    public register(skill: ActiveSkill): void {
        this.availableSkills.push(skill)
    }

    public getActiveTools(projectRoot: string): McpTool[] {
        const activeSkillIds = this.resolveActiveSkillIds(projectRoot)

        const tools: McpTool[] = []
        for (const skillId of activeSkillIds) {
            const skill = this.availableSkills.find((s) => s.id === skillId)
            if (skill) {
                tools.push(...skill.tools)
            } else {
                logger.warn(
                    `Active skill '${skillId}' is listed in active_skills but is not available. Check spelling in .project/config.toml.`
                )
            }
        }
        return tools
    }

    private resolveActiveSkillIds(projectRoot: string): string[] {
        const configPath = join(projectRoot, '.project/config.toml')
        try {
            const mtime = statSync(configPath).mtimeMs
            const cached = this.configCache.get(projectRoot)
            if (cached && cached.mtime === mtime) {
                return cached.activeSkillIds
            }
            const config = loadConfig(projectRoot)
            const activeSkillIds = config?.project?.active_skills ?? []
            this.configCache.set(projectRoot, { mtime, activeSkillIds })
            return activeSkillIds
        } catch {
            return []
        }
    }
}

export const activeSkillRegistry = new ActiveSkillRegistry()
