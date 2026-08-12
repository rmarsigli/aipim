// ─── Installer ─────────────────────────────────────────────────────────────

export interface PackageJson {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    [key: string]: unknown
}

export interface FrameworkConfig {
    id: string
    name: string
    template: string
    check: (pkg: PackageJson) => boolean
}

export interface DetectedProject {
    framework: string | null
    frameworkVersion: string | null
    packageManager: string | null
    hasGit: boolean
    hasNodeModules: boolean
    existingSetup: {
        hasProject: boolean
        hasPrompts: string[]
    }
}

export interface InstallConfig {
    ais: string[]
    guidelines: string[]
    dryRun?: boolean
    version: 'compact' | 'full'
    skipConfirmation: boolean
}

export interface InstallOptions {
    yes?: boolean
    preset?: string
    ai?: string[]
    guidelines?: string[]
    compact?: boolean
    full?: boolean
    dryRun?: boolean
}

export interface UpdateOptions {
    force?: boolean
    dryRun?: boolean
    yes?: boolean
    ai?: string[]
    guidelines?: string[]
    compact?: boolean
    full?: boolean
}

// ─── Events (v2.0) ─────────────────────────────────────────────────────────

export const TASK_STATUSES = ['backlog', 'in-progress', 'review', 'blocked', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export type EventType =
    | 'task.created'
    | 'task.status_changed'
    | 'task.assigned'
    | 'task.content_updated'
    | 'task.comment_added'
    | 'task.priority_changed'
    | 'task.dependency_added'
    | 'task.dependency_removed'
    | 'task.completed'
    | 'decision.logged'
    | 'check.run'
    | 'discovery.started'
    | 'discovery.state_updated'
    | 'session.started'
    | 'session.ended'

export const EVENT_TYPES: EventType[] = [
    'task.created',
    'task.status_changed',
    'task.assigned',
    'task.content_updated',
    'task.comment_added',
    'task.priority_changed',
    'task.dependency_added',
    'task.dependency_removed',
    'task.completed',
    'decision.logged',
    'check.run',
    'discovery.started',
    'discovery.state_updated',
    'session.started',
    'session.ended'
]

export interface BaseEvent {
    id: string
    type: EventType
    timestamp: string // ISO 8601
    actor: string // git config user.email or AIPIM_USER
    projectRoot?: string
    /**
     * The discovery session this event came from, when it came from one.
     * Set on every event a changeset application emits, which is what makes
     * a task or decision traceable back to the conversation that produced it.
     */
    sessionId?: string
}

export interface TaskCreatedEvent extends BaseEvent {
    type: 'task.created'
    taskId: string
    title: string
    taskType: string // feat, fix, chore, etc.
    priority: string
    filePath: string // relative path to the .md file
}

export interface TaskStatusChangedEvent extends BaseEvent {
    type: 'task.status_changed'
    taskId: string
    from: string
    to: string
}

export interface TaskAssignedEvent extends BaseEvent {
    type: 'task.assigned'
    taskId: string
    assignee: string
}

export interface TaskCommentAddedEvent extends BaseEvent {
    type: 'task.comment_added'
    taskId: string
    text: string
}

export interface TaskCompletedEvent extends BaseEvent {
    type: 'task.completed'
    taskId: string
    notes?: string
    actualHours?: number
    /** True when the verification gate was explicitly bypassed. Kept for auditability. */
    checksBypassed?: boolean
}

/**
 * Evidence that a verification command ran against a task.
 * This is what turns "done" from a claim into a verifiable fact.
 */
export interface CheckRunEvent extends BaseEvent {
    type: 'check.run'
    taskId: string
    command: string
    exitCode: number
    passed: boolean
    durationMs?: number
    /** Tail of the command output, truncated — enough to diagnose without bloating the log. */
    output?: string
}

export interface TaskContentUpdatedEvent extends BaseEvent {
    type: 'task.content_updated'
    taskId: string
    commit?: string // git commit hash if available
}

export interface TaskPriorityChangedEvent extends BaseEvent {
    type: 'task.priority_changed'
    taskId: string
    from: string
    to: string
}

export interface TaskDependencyAddedEvent extends BaseEvent {
    type: 'task.dependency_added'
    taskId: string
    dependsOn: string
}

export interface TaskDependencyRemovedEvent extends BaseEvent {
    type: 'task.dependency_removed'
    taskId: string
    dependsOn: string
}

export interface DecisionLoggedEvent extends BaseEvent {
    type: 'decision.logged'
    title: string
    rationale: string
    taskId?: string
    filePath?: string
}

// ─── Discovery ─────────────────────────────────────────────────────────────

export const DISCOVERY_STATUSES = ['open', 'proposed', 'applied', 'abandoned'] as const
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number]

export interface Agreement {
    statement: string
    rationale: string
}

/** An option that was considered and dropped. The reason is the point. */
export interface Alternative {
    option: string
    rejectedBecause: string
}

/**
 * A question the user chose to skip, together with the premise adopted in the
 * absence of an answer.
 *
 * Skipping is never silent. The assumption is simultaneously the record of what
 * was decided without an answer and the agenda for resuming the session later:
 * people come back to a discovery exactly when a skipped question turns out to
 * have been load-bearing.
 */
export interface Assumption {
    question: string
    assumed: string
    critical: boolean
}

export const GROUNDING_RELATIONS = ['overlaps', 'conflicts', 'supersedes'] as const
export type GroundingRelation = (typeof GROUNDING_RELATIONS)[number]

/** Something already in the project that the discussion touches. */
export interface GroundingRef {
    kind: 'task' | 'decision'
    id: string
    relation: GroundingRelation
    note?: string
}

/**
 * The distilled state of a discovery session, rewritten whole on every turn.
 *
 * Stored as a snapshot rather than as granular per-note events because the log
 * is append-only: keeping the whole state each turn yields version history for
 * free, and no query anyone actually makes needs the granular form. It also
 * matches how an agent works — it re-derives the whole state each turn anyway.
 *
 * `assumptions` is questions that were asked and skipped; `openThreads` is
 * questions not yet asked. The distinction matters: assumptions flow into the
 * output, open threads are the agent's own scratch list.
 */
export interface DiscoveryState {
    problem: string
    agreements: Agreement[]
    alternatives: Alternative[]
    assumptions: Assumption[]
    grounding: GroundingRef[]
    openThreads: string[]
}

export interface DiscoveryStartedEvent extends BaseEvent {
    type: 'discovery.started'
    sessionId: string
    topic: string
}

export interface DiscoveryStateUpdatedEvent extends BaseEvent {
    type: 'discovery.state_updated'
    sessionId: string
    state: DiscoveryState
}

export interface SessionStartedEvent extends BaseEvent {
    type: 'session.started'
    sessionNumber: number
}

export interface SessionEndedEvent extends BaseEvent {
    type: 'session.ended'
    sessionNumber: number
    summary?: string
}

export type AipimEvent =
    | TaskCreatedEvent
    | TaskStatusChangedEvent
    | TaskAssignedEvent
    | TaskCommentAddedEvent
    | TaskCompletedEvent
    | TaskContentUpdatedEvent
    | TaskPriorityChangedEvent
    | TaskDependencyAddedEvent
    | TaskDependencyRemovedEvent
    | DecisionLoggedEvent
    | CheckRunEvent
    | DiscoveryStartedEvent
    | DiscoveryStateUpdatedEvent
    | SessionStartedEvent
    | SessionEndedEvent
