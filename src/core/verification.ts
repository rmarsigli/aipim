import { AipimEvent } from '../types/index.js'
import { loadConfig } from './team.js'

/**
 * A recorded check, as stored in the `checks` table.
 */
export interface CheckRecord {
    command: string
    passed: boolean
    created_at: string
}

/**
 * Outcome of evaluating the verification gate for a task.
 * A command lands in exactly one bucket:
 *   - missing: never ran for this task
 *   - stale:   passed, but before the task last changed
 *   - failing: latest run did not pass
 */
export interface GateResult {
    satisfied: boolean
    missing: string[]
    stale: string[]
    failing: string[]
}

/**
 * Reads the check commands a project requires before a task may be completed.
 *
 * ```toml
 * [checks]
 * commands = ["pnpm test", "pnpm lint"]
 * ```
 *
 * Returns an empty list when unconfigured, which makes the gate a no-op.
 */
export function getRequiredChecks(projectRoot: string): string[] {
    try {
        const commands = loadConfig(projectRoot)?.checks?.commands
        if (!Array.isArray(commands)) return []
        return commands.filter((c): c is string => typeof c === 'string')
    } catch {
        return []
    }
}

/**
 * Returns the timestamp of the most recent event for a task that represents
 * actual work — creation, status change, comment, content update, and so on.
 *
 * `check.run` events are deliberately excluded: recording evidence must not
 * count as activity, otherwise every check would invalidate itself.
 */
export function lastActivityAt(events: AipimEvent[], taskId: string): string | null {
    let latest: string | null = null

    for (const event of events) {
        if (event.type === 'check.run') continue
        if (!('taskId' in event) || event.taskId !== taskId) continue
        if (latest === null || event.timestamp > latest) latest = event.timestamp
    }

    return latest
}

/**
 * Evaluates whether the recorded evidence satisfies the required checks.
 *
 * A required command is satisfied when its most recent run passed *and*
 * happened after `since` — proof that the check saw the current state of
 * the work, not an older version of it.
 *
 * With no required commands the gate is a no-op, so projects that have not
 * configured checks keep working exactly as before.
 */
export function evaluateGate(required: string[], checks: CheckRecord[], since: string | null): GateResult {
    const missing: string[] = []
    const stale: string[] = []
    const failing: string[] = []

    for (const command of required) {
        const latest = checks
            .filter((c) => c.command === command)
            .reduce<CheckRecord | null>((acc, c) => (acc === null || c.created_at > acc.created_at ? c : acc), null)

        if (latest === null) {
            missing.push(command)
        } else if (!latest.passed) {
            failing.push(command)
        } else if (since !== null && latest.created_at <= since) {
            stale.push(command)
        }
    }

    return {
        satisfied: missing.length === 0 && stale.length === 0 && failing.length === 0,
        missing,
        stale,
        failing
    }
}

/**
 * Builds a human-readable explanation of why the gate rejected a completion.
 */
export function explainGate(taskId: string, result: GateResult): string {
    const parts: string[] = []
    if (result.missing.length > 0) parts.push(`never run: ${result.missing.join(', ')}`)
    if (result.failing.length > 0) parts.push(`failing: ${result.failing.join(', ')}`)
    if (result.stale.length > 0) parts.push(`stale (ran before the last change): ${result.stale.join(', ')}`)

    return (
        `Cannot complete ${taskId} — verification gate not satisfied (${parts.join('; ')}). ` +
        `Run verify_task first, or pass force: true to complete anyway (the bypass is recorded in the event log).`
    )
}
