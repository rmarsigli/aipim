import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { gitBranch, gitLog } from './git.js'

/**
 * Gets the project name from package.json or falls back to directory name.
 * @param cwd - Current working directory
 */
export function getProjectName(cwd: string): string {
    const packageJsonPath = join(cwd, 'package.json')
    if (existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string }
            return pkg.name || cwd.split('/').pop() || 'Unknown'
        } catch {
            // Fall through
        }
    }
    return cwd.split('/').pop() || 'Unknown'
}

/**
 * Gets the current git branch name.
 */
export async function getCurrentBranch(cwd: string): Promise<string> {
    return gitBranch(cwd).then((b) => b || 'N/A')
}

/**
 * Gets the most recent commits formatted as hash and message.
 */
export async function getRecentCommits(cwd: string, count: number): Promise<Array<{ hash: string; message: string }>> {
    const output = await gitLog(count, '%h||%s', cwd)
    if (!output) return []
    return output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
            const [hash, ...rest] = line.split('||')
            return { hash, message: rest.join('||') }
        })
}

/**
 * Parses the context.md file content.
 * Extracts frontmatter, current state, and next action.
 *
 * @param content - Raw content of context.md
 */
export function parseContext(content: string): {
    frontmatter: Record<string, unknown>
    currentState: string
    nextAction: string
} {
    const lines = content.split('\n')
    const frontmatter: Record<string, unknown> = {}
    let currentState = ''
    let nextAction = ''

    // Parse frontmatter
    let inFrontmatter = false
    let inCurrentState = false

    for (const line of lines) {
        if (line.trim() === '---') {
            if (!inFrontmatter) {
                inFrontmatter = true
            } else {
                inFrontmatter = false
            }
            continue
        }

        if (inFrontmatter) {
            const match = line.match(/^(\w+):\s*(.+)$/)
            if (match) {
                const [, key, value] = match
                // Handle arrays
                if (value.startsWith('[') && value.endsWith(']')) {
                    frontmatter[key] = value
                        .slice(1, -1)
                        .split(',')
                        .map((s) => s.trim())
                } else {
                    frontmatter[key] = value
                }
            }
        }

        if (line.startsWith('# Current State')) {
            inCurrentState = true
            continue
        }

        if (inCurrentState) {
            if (line.startsWith('#')) {
                break
            }
            currentState += line + '\n'
        }
    }

    nextAction = (frontmatter.next_action as string) || ''
    currentState = currentState.trim()

    return { frontmatter, currentState, nextAction }
}

/**
 * Parses a task markdown file.
 * Extracts title, estimated/actual hours, status, and current phase.
 */
export function parseTask(content: string): {
    title: string
    estimated_hours: string
    actual_hours: string
    status: string
    currentPhase: string | null
} {
    const lines = content.split('\n')
    let title = ''
    let estimated_hours = ''
    let actual_hours = ''
    let status = ''
    let currentPhase: string | null = null

    for (const line of lines) {
        if (line.startsWith('title:')) {
            title = line.replace('title:', '').trim().replace(/"/g, '')
        } else if (line.startsWith('estimated_hours:')) {
            estimated_hours = line.replace('estimated_hours:', '').trim()
        } else if (line.startsWith('actual_hours:')) {
            actual_hours = line.replace('actual_hours:', '').trim()
        } else if (line.startsWith('status:')) {
            status = line.replace('status:', '').trim()
        } else if (line.match(/^### Phase \d+:/)) {
            // Check if this phase has uncompleted items
            const phaseMatch = line.match(/^### (Phase \d+:.+)/)
            if (phaseMatch && !currentPhase) {
                currentPhase = phaseMatch[1]
            }
        }
    }

    return { title, estimated_hours, actual_hours, status, currentPhase }
}

/**
 * Extracts the title from an ADR content.
 */
export function extractADRTitle(content: string): string {
    const match = content.match(/^# (.+)$/m)
    return match ? match[1] : 'No title'
}

/**
 * Gets recent ADRs (decisions).
 */
export function getRecentDecisions(projectDir: string, count: number): Array<{ file: string; title: string }> {
    const decisionsDir = join(projectDir, 'decisions')
    if (existsSync(decisionsDir)) {
        try {
            const adrs = readdirSync(decisionsDir)
                .filter((f) => f.endsWith('.md'))
                .sort()
                .reverse()
                .slice(0, count)

            return adrs.map((adr) => {
                const adrPath = join(decisionsDir, adr)
                const content = readFileSync(adrPath, 'utf-8')
                const title = extractADRTitle(content)
                return { file: adr, title }
            })
        } catch {
            return []
        }
    }
    return []
}

/**
 * Calculates progress from checkboxes in content.
 */
export function calculateProgress(content: string): {
    completed: number
    total: number
    percentage: number
} {
    const checkboxes = content.match(/- \[[ xX]\]/g) || []
    const completed = content.match(/- \[[xX]\]/g)?.length || 0
    const total = checkboxes.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return { completed, total, percentage }
}

/**
 * Extracts checkpoints (last 3 completed, current, next).
 */
export function extractCheckpoints(content: string): {
    lastCompleted: string[]
    current: string | null
    next: string | null
} {
    const lines = content.split('\n')
    const completed: string[] = []
    let current: string | null = null
    let next: string | null = null

    let foundCurrent = false

    for (const line of lines) {
        const checkedMatch = line.match(/^- \[x\]\s*(.+)$/i)
        if (checkedMatch && !foundCurrent) {
            completed.push(checkedMatch[1].trim())
        }

        const uncheckedMatch = line.match(/^- \[ \]\s*(.+)$/)
        if (uncheckedMatch && !foundCurrent) {
            current = uncheckedMatch[1].trim()
            foundCurrent = true
        } else if (uncheckedMatch && foundCurrent && !next) {
            next = uncheckedMatch[1].trim()
            break
        }
    }

    // Return last 3 completed items
    const lastCompleted = completed.slice(-3)

    return { lastCompleted, current, next }
}

/**
 * Extracts the objective from the task file.
 */
export function extractObjective(content: string): string {
    const lines = content.split('\n')
    let inObjective = false
    let objective = ''

    for (const line of lines) {
        if (line.startsWith('## Objective')) {
            inObjective = true
            continue
        }

        if (inObjective) {
            if (line.startsWith('##')) {
                break
            }
            if (line.trim() && !line.startsWith('**')) {
                objective += line.trim() + ' '
            }
        }
    }

    return objective.trim()
}
