import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'
import { parse, stringify } from 'smol-toml'

export interface TeamMember {
    id: string
    name: string
    email: string
    role?: string
    areas?: string[]
}

export interface ProjectConfig {
    project: { name: string; description?: string; active_skills?: string[] }
    team: TeamMember[]
    /** Commands that must pass before a task can be completed. See core/verification.ts. */
    checks?: { commands?: unknown[] }
    /** Claude Code hook behaviour. See core/hooks.ts. */
    hooks?: { block_on_unverified?: boolean }
}

export function loadConfig(projectRoot: string): ProjectConfig | null {
    const configPath = join(projectRoot, '.project/config.toml')
    if (!existsSync(configPath)) return null
    return parse(readFileSync(configPath, 'utf8')) as unknown as ProjectConfig
}

export function resolveActor(projectRoot: string): string {
    if (process.env.AIPIM_USER) return process.env.AIPIM_USER

    try {
        const email = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim()
        const config = loadConfig(projectRoot)
        const member = config?.team?.find((m) => m.email === email)
        if (member) return member.id
        return email
    } catch {
        return 'unknown'
    }
}

export function getMember(projectRoot: string, id: string): TeamMember | null {
    const config = loadConfig(projectRoot)
    return config?.team?.find((m) => m.id === id) ?? null
}

export function addTeamMember(projectRoot: string, member: TeamMember): void {
    const configPath = join(projectRoot, '.project/config.toml')
    const config = loadConfig(projectRoot) ?? {
        project: { name: 'My Project' },
        team: [] as TeamMember[]
    }

    const existing = config.team.findIndex((m) => m.id === member.id)
    if (existing >= 0) {
        config.team[existing] = member
    } else {
        config.team.push(member)
    }

    writeFileSync(configPath, stringify(config as unknown as Record<string, unknown>), 'utf8')
}
