export interface Task {
    id: string
    title: string
    task_type: string
    status: string
    priority: string
    assignee: string | null
    file_path: string | null
    created_at: string
    updated_at: string
    content?: string | null
    comments?: Comment[]
}

export interface Comment {
    id: string
    task_id: string
    actor: string
    text: string
    created_at: string
}

export interface Decision {
    id: string
    title: string
    rationale: string
    task_id: string | null
    file_path: string | null
    actor: string
    created_at: string
}

export interface AipimEvent {
    id: string
    type: string
    timestamp: string
    actor: string
    [key: string]: unknown
}

export interface TeamMember {
    name: string
    email: string
    github?: string
    role?: string
}

export interface EventsPage {
    events: AipimEvent[]
    total: number
    limit: number
    offset: number
}

export interface DiscoverySession {
    id: string
    topic: string
    status: string
    started_at: string
    updated_at: string
    actor: string
}

export interface DiscoveryState {
    problem: string
    agreements: Array<{ statement: string; rationale: string }>
    alternatives: Array<{ option: string; rejectedBecause: string }>
    assumptions: Array<{ question: string; assumed: string; critical: boolean }>
    grounding: Array<{ kind: string; id: string; relation: string; note?: string }>
    openThreads: string[]
}

export interface Changeset {
    tasks: Array<{
        localId: string
        title: string
        taskType: string
        priority: string
        estimatedHours?: number
        description?: string
    }>
    dependencies: Array<{ taskRef: string; dependsOnRef: string }>
    decisions: Array<{ title: string; rationale: string; supersedes?: string[] }>
    docs: Array<{ path: string; content: string }>
}

export interface ProposedChangeset {
    id: string
    status: string
    proposedAt: string
    resolvedAt: string | null
    changeset: Changeset
}

export interface DiscoveryDetail extends DiscoverySession {
    version: number
    state: DiscoveryState
    history: Array<{ version: number; createdAt: string }>
    changesets: ProposedChangeset[]
}

export type Stats = Record<string, number>

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, init)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json() as Promise<T>
}

export function getTasks(filters?: { status?: string; assignee?: string; priority?: string }): Promise<Task[]> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.assignee) params.set('assignee', filters.assignee)
    if (filters?.priority) params.set('priority', filters.priority)
    const qs = params.toString()
    return apiFetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)
}

export function getTask(id: string): Promise<Task> {
    return apiFetch<Task>(`/api/tasks/${id}`)
}

export function getStats(): Promise<Stats> {
    return apiFetch<Stats>('/api/stats')
}

export function getTeam(): Promise<TeamMember[]> {
    return apiFetch<TeamMember[]>('/api/team')
}

export function getDecisions(): Promise<Decision[]> {
    return apiFetch<Decision[]>('/api/decisions')
}

export function getDecision(id: string): Promise<Decision & { content: string | null }> {
    return apiFetch<Decision & { content: string | null }>(`/api/decisions/${id}`)
}

export function getDiscoveries(status?: string): Promise<DiscoverySession[]> {
    return apiFetch<DiscoverySession[]>(`/api/discoveries${status ? `?status=${status}` : ''}`)
}

export function getDiscovery(id: string): Promise<DiscoveryDetail> {
    return apiFetch<DiscoveryDetail>(`/api/discoveries/${id}`)
}

export function getEvents(opts?: { limit?: number; offset?: number }): Promise<EventsPage> {
    const params = new URLSearchParams()
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.offset) params.set('offset', String(opts.offset))
    const qs = params.toString()
    return apiFetch<EventsPage>(`/api/events${qs ? `?${qs}` : ''}`)
}

export function postEvent(partial: Omit<AipimEvent, 'id' | 'timestamp' | 'actor'>): Promise<AipimEvent> {
    return apiFetch<AipimEvent>('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
    })
}

export function getTaskEvents(id: string): Promise<AipimEvent[]> {
    return apiFetch<AipimEvent[]>(`/api/tasks/${id}/events`)
}

export function putTaskContent(id: string, content: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/api/tasks/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    })
}
