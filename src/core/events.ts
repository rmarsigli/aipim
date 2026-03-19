import { readFileSync, appendFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'
import { resolveActor } from './team.js'

interface EventsCache {
    mtime: number
    events: AipimEvent[]
}

const eventsCache = new Map<string, EventsCache>()

// Per-projectRoot write lock: ensures concurrent async callers don't interleave
// their appendFileSync calls. Implemented as a promise chain so each caller
// awaits the previous write before proceeding.
const appendLocks = new Map<string, Promise<void>>()

// Loose input type — type discriminant is validated, extra fields pass through
type PartialEvent = { type: AipimEvent['type'] } & Record<string, unknown>

const EVENTS_FILE = '.project/events.jsonl'

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Appends an event to the project's events.jsonl file.
 * Events are immutable — never edited, never deleted.
 *
 * Serialises concurrent writers via a per-projectRoot promise chain so that
 * overlapping async tool handlers don't interleave partial writes.
 */
export async function appendEvent(projectRoot: string, partial: PartialEvent): Promise<AipimEvent> {
    const prev = appendLocks.get(projectRoot) ?? Promise.resolve()
    let unlock!: () => void
    appendLocks.set(
        projectRoot,
        new Promise<void>((res) => {
            unlock = res
        })
    )

    await prev
    try {
        const event = {
            ...partial,
            id: generateId(),
            timestamp: new Date().toISOString(),
            actor: resolveActor(projectRoot)
        } as AipimEvent

        const filePath = join(projectRoot, EVENTS_FILE)
        appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8')
        // Invalidate mtime cache so the next readEvents() picks up the new event
        eventsCache.delete(projectRoot)
        return event
    } finally {
        unlock()
    }
}

/**
 * Reads all events from events.jsonl, ordered by timestamp ascending.
 * Results are cached by file mtime so repeated calls within the same request
 * do not re-read or re-parse the file unless it has been modified.
 */
export function readEvents(projectRoot: string): AipimEvent[] {
    const filePath = join(projectRoot, EVENTS_FILE)
    if (!existsSync(filePath)) return []

    const mtime = statSync(filePath).mtimeMs
    const cached = eventsCache.get(projectRoot)
    if (cached && cached.mtime === mtime) {
        return cached.events
    }

    const events = readFileSync(filePath, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AipimEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    eventsCache.set(projectRoot, { mtime, events })
    return events
}

/**
 * Returns all events for a specific task ID.
 */
export function readEventsForTask(projectRoot: string, taskId: string): AipimEvent[] {
    return readEvents(projectRoot).filter((e) => 'taskId' in e && e.taskId === taskId)
}
