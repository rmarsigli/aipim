import { readFileSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'
import { resolveActor } from './team.js'

// Loose input type — type discriminant is validated, extra fields pass through
type PartialEvent = { type: AipimEvent['type'] } & Record<string, unknown>

const EVENTS_FILE = '.project/events.jsonl'

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Appends an event to the project's events.jsonl file.
 * Events are immutable — never edited, never deleted.
 */
export function appendEvent(projectRoot: string, partial: PartialEvent): AipimEvent {
    const event = {
        ...partial,
        id: generateId(),
        timestamp: new Date().toISOString(),
        actor: resolveActor(projectRoot)
    } as AipimEvent

    const filePath = join(projectRoot, EVENTS_FILE)
    appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8')
    return event
}

/**
 * Reads all events from events.jsonl, ordered by timestamp ascending.
 */
export function readEvents(projectRoot: string): AipimEvent[] {
    const filePath = join(projectRoot, EVENTS_FILE)
    if (!existsSync(filePath)) return []

    return readFileSync(filePath, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AipimEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/**
 * Returns all events for a specific task ID.
 */
export function readEventsForTask(projectRoot: string, taskId: string): AipimEvent[] {
    return readEvents(projectRoot).filter((e) => 'taskId' in e && e.taskId === taskId)
}
