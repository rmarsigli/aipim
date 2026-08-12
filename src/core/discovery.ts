import Database from 'better-sqlite3'
import { appendEvent } from './events.js'
import {
    applyEvent,
    getDecisions,
    getDiscoverySession,
    getLatestDiscoveryState,
    queryDiscoverySessions,
    queryTasks,
    DiscoverySessionRow
} from './db.js'
import { DiscoveryState, Assumption } from '../types/index.js'

/**
 * A discovery session together with its newest distilled state.
 * This is what an agent with no chat context reads to pick up the thread.
 */
export interface LoadedDiscovery {
    session: DiscoverySessionRow
    version: number
    state: DiscoveryState
}

export function emptyDiscoveryState(): DiscoveryState {
    return { problem: '', agreements: [], alternatives: [], assumptions: [], grounding: [], openThreads: [] }
}

/**
 * Allocates the next session ID: D001, D002, …
 */
export function nextDiscoveryId(db: Database.Database): string {
    const max = queryDiscoverySessions(db).reduce((highest, session) => {
        const match = session.id.match(/^D(\d+)$/)
        return Math.max(highest, match ? parseInt(match[1], 10) : 0)
    }, 0)
    return `D${(max + 1).toString().padStart(3, '0')}`
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Coerces whatever an agent sent into a well-formed DiscoveryState.
 *
 * The state arrives as free-form JSON over MCP, so every field is normalised
 * rather than trusted: a malformed snapshot must degrade to an empty section,
 * never corrupt the session or throw mid-conversation.
 */
export function normaliseDiscoveryState(input: unknown): DiscoveryState {
    const raw = asRecord(input)

    return {
        problem: asString(raw.problem),
        agreements: asArray(raw.agreements).map((item) => {
            const entry = asRecord(item)
            return { statement: asString(entry.statement), rationale: asString(entry.rationale) }
        }),
        alternatives: asArray(raw.alternatives).map((item) => {
            const entry = asRecord(item)
            return { option: asString(entry.option), rejectedBecause: asString(entry.rejectedBecause) }
        }),
        assumptions: asArray(raw.assumptions).map((item) => {
            const entry = asRecord(item)
            return {
                question: asString(entry.question),
                assumed: asString(entry.assumed),
                critical: entry.critical === true
            }
        }),
        grounding: asArray(raw.grounding).map((item) => {
            const entry = asRecord(item)
            const relation = asString(entry.relation)
            const note = asString(entry.note)
            return {
                kind: entry.kind === 'decision' ? ('decision' as const) : ('task' as const),
                id: asString(entry.id),
                relation: relation === 'conflicts' || relation === 'supersedes' ? relation : ('overlaps' as const),
                ...(note ? { note } : {})
            }
        }),
        openThreads: asArray(raw.openThreads).map(asString).filter(Boolean)
    }
}

function parseState(json: string): DiscoveryState {
    try {
        return normaliseDiscoveryState(JSON.parse(json))
    } catch {
        return emptyDiscoveryState()
    }
}

/**
 * Opens a new discovery session.
 *
 * Sessions are deliberately not exclusive: several may be open at once. Forcing
 * one at a time would create a failure mode ("I have to close that to think
 * about this") without buying anything, since sessions are cheap.
 */
export async function startDiscovery(
    projectRoot: string,
    db: Database.Database,
    topic: string
): Promise<{ sessionId: string }> {
    const sessionId = nextDiscoveryId(db)
    const event = await appendEvent(projectRoot, { type: 'discovery.started', sessionId, topic })
    applyEvent(db, event)
    return { sessionId }
}

/**
 * Records a distilled-state snapshot as the session's next version.
 */
export async function recordDiscoveryState(
    projectRoot: string,
    db: Database.Database,
    sessionId: string,
    state: unknown
): Promise<{ version: number }> {
    const event = await appendEvent(projectRoot, {
        type: 'discovery.state_updated',
        sessionId,
        state: normaliseDiscoveryState(state)
    })
    applyEvent(db, event)

    const stored = getLatestDiscoveryState(db, sessionId)
    return { version: stored?.version ?? 1 }
}

/**
 * Loads a session with its newest state, or undefined when the session does not
 * exist. A session with no snapshot yet reads as an empty state, not as absent.
 */
export function loadDiscovery(db: Database.Database, sessionId: string): LoadedDiscovery | undefined {
    const session = getDiscoverySession(db, sessionId)
    if (!session) return undefined

    const latest = getLatestDiscoveryState(db, sessionId)
    return {
        session,
        version: latest?.version ?? 0,
        state: latest ? parseState(latest.state) : emptyDiscoveryState()
    }
}

/**
 * Returns the session to work with when the caller did not name one: the open
 * session touched most recently.
 */
export function currentDiscovery(db: Database.Database): LoadedDiscovery | undefined {
    const [mostRecent] = queryDiscoverySessions(db, { status: 'open' })
    return mostRecent ? loadDiscovery(db, mostRecent.id) : undefined
}

/**
 * Summarises open sessions for callers that only need to know they exist —
 * get_project_context and the SessionStart hook, which report open discoveries
 * without ever entering one.
 */
export interface OpenDiscoverySummary {
    id: string
    topic: string
    updatedAt: string
    openAssumptions: number
    criticalAssumptions: number
}

export function openDiscoveries(db: Database.Database): OpenDiscoverySummary[] {
    return queryDiscoverySessions(db, { status: 'open' }).map((session) => {
        const loaded = loadDiscovery(db, session.id)
        const assumptions: Assumption[] = loaded?.state.assumptions ?? []
        return {
            id: session.id,
            topic: session.topic,
            updatedAt: session.updated_at,
            openAssumptions: assumptions.length,
            criticalAssumptions: assumptions.filter((a) => a.critical).length
        }
    })
}

// ─── Grounding ──────────────────────────────────────────────────────────────

export interface RelatedMatch {
    kind: 'task' | 'decision'
    id: string
    title: string
    status?: string
    priority?: string
    /** How many query terms this item matched — the ranking key. */
    score: number
}

/** Terms shorter than this match too much to be worth searching on. */
const MIN_TERM_LENGTH = 3

function terms(query: string): string[] {
    return [
        ...new Set(
            query
                .toLowerCase()
                .split(/[^\p{L}\p{N}]+/u)
                .filter((term) => term.length >= MIN_TERM_LENGTH)
        )
    ]
}

function score(haystack: string, needles: string[]): number {
    const text = haystack.toLowerCase()
    return needles.filter((needle) => text.includes(needle)).length
}

/**
 * Finds existing tasks and decisions related to a piece of text.
 *
 * This is what makes discovery behave differently in an empty project and a
 * live one without branching: an empty project simply matches nothing, so the
 * conversation moves from reconciling to inventing on its own.
 *
 * Matching runs over the read model — task titles, decision titles and
 * rationales — not over task markdown bodies, which would mean reading every
 * backlog file on every call. It is a grounding aid, not a search engine.
 */
export function findRelated(db: Database.Database, query: string, limit = 10): RelatedMatch[] {
    const needles = terms(query)
    if (needles.length === 0) return []

    const taskMatches: RelatedMatch[] = queryTasks(db)
        .map((task) => ({
            kind: 'task' as const,
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            score: score(task.title, needles)
        }))
        .filter((match) => match.score > 0)

    const decisionMatches: RelatedMatch[] = getDecisions(db)
        .map((decision) => ({
            kind: 'decision' as const,
            id: decision.id,
            title: decision.title,
            score: score(`${decision.title} ${decision.rationale}`, needles)
        }))
        .filter((match) => match.score > 0)

    return [...taskMatches, ...decisionMatches]
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, limit)
}
