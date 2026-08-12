import Database from 'better-sqlite3'
import { TaskRow, DependencyEdge, queryTasks, getAllDependencies } from './db.js'

/**
 * A task plus its position in the dependency graph.
 */
export interface GraphNode {
    id: string
    title: string
    status: string
    priority: string
    /** Tasks this one waits on. */
    dependsOn: string[]
    /** Tasks waiting on this one — the reverse edge. */
    blocks: string[]
    /** Subset of dependsOn that is not done yet (or does not exist). */
    blockedBy: string[]
    ready: boolean
}

export interface TaskGraph {
    nodes: GraphNode[]
    edges: DependencyEdge[]
    /** Each cycle as a node list, rotated to start at its lowest ID so it is stable. */
    cycles: string[][]
    /** Actionable frontier: unfinished tasks whose dependencies are all done, priority-ordered. */
    ready: string[]
    /** Unfinished tasks that cannot start yet. */
    blocked: string[]
}

// Statuses that take a task out of the actionable frontier.
// 'blocked' is set by hand, 'done' is finished — neither is work you can pick up.
const NON_ACTIONABLE = new Set(['done', 'blocked'])

/**
 * Ranks a priority string for sorting: P1-S first, P3 last.
 * Must stay in sync with PRIORITY_ORDER_SQL in db.ts.
 */
export function priorityRank(priority: string): number {
    const tier = { P1: 1, P2: 2, P3: 3 }[priority.slice(0, 2)] ?? 4
    const size = { S: 1, M: 2, L: 3 }[priority.charAt(3)] ?? 4
    return tier * 10 + size
}

function buildAdjacency(edges: DependencyEdge[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>()
    for (const { taskId, dependsOn } of edges) {
        const list = adjacency.get(taskId)
        if (list) list.push(dependsOn)
        else adjacency.set(taskId, [dependsOn])
    }
    return adjacency
}

/** Rotates a cycle so it starts at its lowest ID — same cycle, same representation. */
function normaliseCycle(cycle: string[]): string[] {
    let lowest = 0
    for (let i = 1; i < cycle.length; i++) {
        if (cycle[i] < cycle[lowest]) lowest = i
    }
    return [...cycle.slice(lowest), ...cycle.slice(0, lowest)]
}

/**
 * Finds every dependency cycle via depth-first search.
 * Each cycle is reported once, no matter how many entry points reach it.
 */
export function detectCycles(edges: DependencyEdge[]): string[][] {
    const adjacency = buildAdjacency(edges)
    const nodes = new Set<string>()
    for (const { taskId, dependsOn } of edges) {
        nodes.add(taskId)
        nodes.add(dependsOn)
    }

    const visited = new Set<string>()
    const onPath = new Set<string>()
    const path: string[] = []
    const found = new Map<string, string[]>()

    function visit(node: string): void {
        visited.add(node)
        onPath.add(node)
        path.push(node)

        for (const next of adjacency.get(node) ?? []) {
            if (!visited.has(next)) {
                visit(next)
            } else if (onPath.has(next)) {
                const cycle = normaliseCycle(path.slice(path.indexOf(next)))
                found.set(cycle.join('>'), cycle)
            }
        }

        onPath.delete(node)
        path.pop()
    }

    for (const node of [...nodes].sort()) {
        if (!visited.has(node)) visit(node)
    }

    return [...found.values()]
}

/**
 * Answers whether adding `taskId → dependsOn` would close a loop.
 *
 * It would exactly when `dependsOn` can already reach `taskId`, so this is a
 * reachability walk rather than a full cycle scan.
 */
export function wouldCreateCycle(edges: DependencyEdge[], taskId: string, dependsOn: string): boolean {
    if (taskId === dependsOn) return true

    const adjacency = buildAdjacency(edges)
    const seen = new Set<string>()
    const stack = [dependsOn]

    while (stack.length > 0) {
        const current = stack.pop() as string
        if (current === taskId) return true
        if (seen.has(current)) continue
        seen.add(current)
        stack.push(...(adjacency.get(current) ?? []))
    }

    return false
}

/**
 * Assembles the full task graph: nodes with both edge directions resolved,
 * the actionable frontier, the blocked set, and any cycles.
 *
 * A dependency on a task that does not exist counts as blocking — an unknown
 * prerequisite is not a satisfied one.
 */
export function buildTaskGraph(tasks: TaskRow[], edges: DependencyEdge[]): TaskGraph {
    const byId = new Map(tasks.map((t) => [t.id, t]))

    const nodes: GraphNode[] = tasks.map((task) => {
        const dependsOn = edges.filter((e) => e.taskId === task.id).map((e) => e.dependsOn)
        const blocks = edges.filter((e) => e.dependsOn === task.id).map((e) => e.taskId)
        const blockedBy = dependsOn.filter((id) => byId.get(id)?.status !== 'done')

        return {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dependsOn,
            blocks,
            blockedBy,
            ready: !NON_ACTIONABLE.has(task.status) && blockedBy.length === 0
        }
    })

    const actionable = nodes.filter((n) => n.status !== 'done')

    return {
        nodes,
        edges,
        cycles: detectCycles(edges),
        ready: actionable
            .filter((n) => n.ready)
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
            .map((n) => n.id),
        blocked: actionable.filter((n) => !n.ready).map((n) => n.id)
    }
}

/**
 * Loads the graph for a project from the read model.
 */
export function loadTaskGraph(db: Database.Database): TaskGraph {
    return buildTaskGraph(queryTasks(db), getAllDependencies(db))
}

/**
 * Returns the highest-priority task that is actually startable — backlog only,
 * with every dependency already done.
 *
 * This is what `get_next_task` should hand an agent: never a blocked task.
 */
export function getNextReadyTask(db: Database.Database): TaskRow | undefined {
    const graph = buildTaskGraph(queryTasks(db), getAllDependencies(db))
    const backlog = new Map(queryTasks(db, { status: 'backlog' }).map((t) => [t.id, t]))

    for (const id of graph.ready) {
        const task = backlog.get(id)
        if (task) return task
    }
    return undefined
}
