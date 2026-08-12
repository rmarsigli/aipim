import Database from 'better-sqlite3'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { queryTasks, getChecksForTask } from './db.js'
import { loadTaskGraph, getNextReadyTask } from './graph.js'
import { getRequiredChecks, evaluateGate, lastActivityAt } from './verification.js'
import { loadConfig } from './team.js'
import { AipimEvent } from '../types/index.js'

const SETTINGS_PATH = '.claude/settings.json'

/**
 * Tag embedded in every hook AIPIM writes, so a re-install can replace its own
 * entries without touching hooks the user added by hand.
 */
export const AIPIM_HOOK_MARKER = 'aipim-managed'

export interface HookCommand {
    type: string
    command: string
}

export interface HookMatcher {
    matcher?: string
    hooks: HookCommand[]
}

export interface HookSettings {
    hooks: Record<string, HookMatcher[]>
}

function managed(command: string): HookMatcher {
    return { hooks: [{ type: 'command', command: `${command} # ${AIPIM_HOOK_MARKER}` }] }
}

/**
 * The hooks AIPIM registers in .claude/settings.json.
 *
 * These are what move the session protocol out of CLAUDE.md prose and into
 * something the harness actually executes:
 *   - SessionStart injects the current project state, so no session begins blind.
 *   - Stop checks that in-progress work is verified before the agent walks away.
 */
export function buildHookSettings(): HookSettings {
    return {
        hooks: {
            SessionStart: [managed('aipim hook session-start')],
            Stop: [managed('aipim hook stop')]
        }
    }
}

function isManaged(entry: HookMatcher): boolean {
    return entry.hooks?.some((h) => typeof h.command === 'string' && h.command.includes(AIPIM_HOOK_MARKER)) ?? false
}

/**
 * Merges AIPIM's hooks into an existing settings object.
 *
 * User-authored hooks are preserved; AIPIM's own previous entries are replaced
 * rather than appended, which makes repeated installs idempotent.
 */
export function mergeHookSettings(existing: Record<string, unknown>, ours: HookSettings): Record<string, unknown> {
    const existingHooks = (existing.hooks ?? {}) as Record<string, HookMatcher[]>
    const mergedHooks: Record<string, HookMatcher[]> = { ...existingHooks }

    for (const [event, entries] of Object.entries(ours.hooks)) {
        const userEntries = (mergedHooks[event] ?? []).filter((entry) => !isManaged(entry))
        mergedHooks[event] = [...userEntries, ...entries]
    }

    return { ...existing, hooks: mergedHooks }
}

/**
 * Writes AIPIM's hooks into the project's .claude/settings.json.
 *
 * Refuses to touch a settings file it cannot parse — a broken merge would cost
 * the user more than a missing hook.
 */
export function installHooks(projectRoot: string): string {
    const settingsPath = join(projectRoot, SETTINGS_PATH)

    let existing: Record<string, unknown> = {}
    if (existsSync(settingsPath)) {
        const raw = readFileSync(settingsPath, 'utf8')
        try {
            existing = JSON.parse(raw) as Record<string, unknown>
        } catch {
            throw new Error(`${SETTINGS_PATH} could not be parsed as JSON — fix it by hand and run this again.`)
        }
    }

    const merged = mergeHookSettings(existing, buildHookSettings())
    mkdirSync(join(projectRoot, '.claude'), { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8')

    return SETTINGS_PATH
}

export interface StopHookResult {
    block: boolean
    reason?: string
}

/**
 * Decides whether the agent should be stopped from ending its turn.
 *
 * Blocking is opt-in per project (`[hooks] block_on_unverified = true`), because
 * a hook that fights the user is worse than one that does nothing. When enabled,
 * it stops the agent from walking away from in-progress work whose checks have
 * not passed.
 */
export function evaluateStopHook(db: Database.Database, projectRoot: string, events: AipimEvent[]): StopHookResult {
    const config = loadConfig(projectRoot)
    if (config?.hooks?.block_on_unverified !== true) return { block: false }

    const required = getRequiredChecks(projectRoot)
    if (required.length === 0) return { block: false }

    const unverified = queryTasks(db, { status: 'in-progress' }).filter(
        (task) => !evaluateGate(required, getChecksForTask(db, task.id), lastActivityAt(events, task.id)).satisfied
    )

    if (unverified.length === 0) return { block: false }

    return {
        block: true,
        reason:
            `In-progress work has not been verified: ${unverified.map((t) => t.id).join(', ')}. ` +
            `Run verify_task before finishing, or set the task back to backlog.`
    }
}

/**
 * Builds the plain-text project state injected at the start of a session.
 * Deliberately short — this is context, not a report.
 */
export function buildSessionContext(db: Database.Database, projectRoot: string): string {
    const lines: string[] = ['AIPIM project state:']

    const inProgress = queryTasks(db, { status: 'in-progress' })
    const graph = loadTaskGraph(db)
    const next = getNextReadyTask(db)
    const checks = getRequiredChecks(projectRoot)

    if (graph.nodes.length === 0) {
        lines.push('- No tasks yet. Use create_task to add one.')
        return lines.join('\n')
    }

    if (inProgress.length > 0) {
        lines.push(`- In progress: ${inProgress.map((t) => `${t.id} (${t.title})`).join(', ')}`)
    }

    lines.push(
        next ? `- Next ready task: ${next.id} — ${next.title} [${next.priority}]` : '- No tasks are ready to start.'
    )

    if (graph.blocked.length > 0) {
        lines.push(`- Blocked: ${graph.blocked.join(', ')}`)
    }

    if (graph.cycles.length > 0) {
        lines.push(`- WARNING: dependency cycle detected: ${graph.cycles.map((c) => c.join(' → ')).join('; ')}`)
    }

    if (checks.length > 0) {
        lines.push(
            `- Verification required before complete_task: ${checks.join(', ')}. Run verify_task when the work is done.`
        )
    }

    lines.push('- Call get_project_context for the full picture.')

    return lines.join('\n')
}
