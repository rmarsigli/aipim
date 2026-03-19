import { McpTool } from '../tools/index.js'
import { databaseSkill } from './database/index.js'
import { loadConfig } from '../../core/team.js'

export interface ActiveSkill {
    id: string
    tools: McpTool[]
}

export class ActiveSkillRegistry {
    private availableSkills: ActiveSkill[] = [databaseSkill]

    public getActiveTools(projectRoot: string): McpTool[] {
        const config = loadConfig(projectRoot)
        const activeSkillIds = config?.project?.active_skills ?? []

        const tools: McpTool[] = []
        for (const skillId of activeSkillIds) {
            const skill = this.availableSkills.find((s) => s.id === skillId)
            if (skill) {
                tools.push(...skill.tools)
            }
        }
        return tools
    }
}

export const activeSkillRegistry = new ActiveSkillRegistry()
