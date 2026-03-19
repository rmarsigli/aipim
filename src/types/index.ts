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
    'session.started',
    'session.ended'
]

export interface BaseEvent {
    id: string
    type: EventType
    timestamp: string // ISO 8601
    actor: string // git config user.email or AIPIM_USER
    projectRoot?: string
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
    | SessionStartedEvent
    | SessionEndedEvent
