import { readFileSync, appendFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'
import { resolveActor } from './team.js'

/**
 * Cache identity for events.jsonl.
 *
 * mtime alone is not enough: a file that is deleted and recreated can land on
 * the same mtimeMs, and then a stale parse is served for a completely different
 * file. Inode and size make that collision effectively impossible.
 */
interface EventsCache {
    mtime: number
    size: number
    inode: number
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
    const [event] = await appendEvents(projectRoot, [partial])
    return event
}

/**
 * Appends several events as one unit: they are stamped together and written in
 * a single call while the lock is held, so nothing can interleave between them.
 *
 * This is what makes applying a discovery changeset atomic. Writing its events
 * one at a time would let a concurrent tool call land in the middle, leaving
 * the log with half a changeset applied.
 *
 * Events in a batch share a timestamp. `readEvents` sorts stably, so the order
 * they are passed in is the order they replay in — tasks before the
 * dependencies that reference them.
 */
export async function appendEvents(projectRoot: string, partials: PartialEvent[]): Promise<AipimEvent[]> {
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
        if (partials.length === 0) return []

        const actor = resolveActor(projectRoot)
        const timestamp = new Date().toISOString()
        const taken = new Set<string>()

        const events = partials.map((partial) => {
            let id = generateId()
            while (taken.has(id)) id = generateId()
            taken.add(id)
            return { ...partial, id, timestamp, actor } as AipimEvent
        })

        const filePath = join(projectRoot, EVENTS_FILE)
        appendFileSync(filePath, events.map((event) => JSON.stringify(event)).join('\n') + '\n', 'utf8')
        // Invalidate mtime cache so the next readEvents() picks up the new events
        eventsCache.delete(projectRoot)
        return events
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

    const { mtimeMs: mtime, size, ino: inode } = statSync(filePath)
    const cached = eventsCache.get(projectRoot)
    if (cached && cached.mtime === mtime && cached.size === size && cached.inode === inode) {
        return cached.events
    }

    const events = readFileSync(filePath, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AipimEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    eventsCache.set(projectRoot, { mtime, size, inode, events })
    return events
}

/**
 * Returns all events for a specific task ID.
 */
export function readEventsForTask(projectRoot: string, taskId: string): AipimEvent[] {
    return readEvents(projectRoot).filter((e) => 'taskId' in e && e.taskId === taskId)
}
