import Database from 'better-sqlite3'
import { Changeset, DiscoveryState } from '../types/index.js'
import { loadConfig } from './team.js'
import { queryTasks } from './db.js'

/**
 * The configurable half of the consensus gate.
 *
 * ```toml
 * [discovery]
 * max_open_critical       = 0
 * max_tasks_per_changeset = 15
 * require_estimates       = true
 * require_grounding       = true
 * ```
 *
 * Every field is off unless set, so a project with no `[discovery]` block is
 * unaffected — the same choice `[checks]` makes.
 */
export interface DiscoveryGateConfig {
    maxOpenCritical: number | null
    maxTasksPerChangeset: number | null
    requireEstimates: boolean
    requireGrounding: boolean
}

export interface DiscoveryGateResult {
    satisfied: boolean
    failures: string[]
}

function asPositiveIntOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function getDiscoveryGateConfig(projectRoot: string): DiscoveryGateConfig {
    try {
        const discovery = loadConfig(projectRoot)?.discovery
        return {
            maxOpenCritical: asPositiveIntOrNull(discovery?.max_open_critical),
            maxTasksPerChangeset: asPositiveIntOrNull(discovery?.max_tasks_per_changeset),
            requireEstimates: discovery?.require_estimates === true,
            requireGrounding: discovery?.require_grounding === true
        }
    } catch {
        return { maxOpenCritical: null, maxTasksPerChangeset: null, requireEstimates: false, requireGrounding: false }
    }
}

/**
 * Judges whether a changeset has enough consensus behind it to be applied.
 *
 * The two counting rules target opposite failure modes of the same mechanism.
 * `max_open_critical` catches deciding in the dark — a discussion that skipped
 * a load-bearing question and proposed anyway. `max_tasks_per_changeset`
 * catches hallucinated completeness — forty invented tasks that look like a
 * plan. Both are checks on the changeset, not separate code paths.
 */
export function evaluateDiscoveryGate(
    config: DiscoveryGateConfig,
    changeset: Changeset,
    state: DiscoveryState,
    projectHasTasks: boolean
): DiscoveryGateResult {
    const failures: string[] = []

    if (config.maxOpenCritical !== null) {
        const critical = state.assumptions.filter((assumption) => assumption.critical)
        if (critical.length > config.maxOpenCritical) {
            failures.push(
                `${critical.length} critical assumption(s) still open (limit ${config.maxOpenCritical}): ` +
                    critical.map((assumption) => `"${assumption.question}"`).join(', ')
            )
        }
    }

    if (config.maxTasksPerChangeset !== null && changeset.tasks.length > config.maxTasksPerChangeset) {
        failures.push(
            `${changeset.tasks.length} tasks proposed, limit is ${config.maxTasksPerChangeset} — split the work or raise the limit`
        )
    }

    if (config.requireEstimates) {
        const missing = changeset.tasks.filter((task) => typeof task.estimatedHours !== 'number')
        if (missing.length > 0) {
            failures.push(`No estimate on: ${missing.map((task) => task.localId).join(', ')}`)
        }
    }

    // Only meaningful in a project that has something to collide with. In an
    // empty one there is nothing to ground against, which is exactly why
    // greenfield discovery needs no special case.
    if (config.requireGrounding && projectHasTasks && state.grounding.length === 0) {
        failures.push('No grounding recorded — check find_related for tasks and decisions this overlaps')
    }

    return { satisfied: failures.length === 0, failures }
}

export function projectHasTasks(db: Database.Database): boolean {
    return queryTasks(db).length > 0
}

export function explainDiscoveryGate(changesetId: string, result: DiscoveryGateResult): string {
    return (
        `Cannot apply ${changesetId} — the consensus gate is not satisfied: ${result.failures.join('; ')}. ` +
        `Resolve what is missing, or pass force: true to apply anyway (the bypass is recorded in the event log).`
    )
}
