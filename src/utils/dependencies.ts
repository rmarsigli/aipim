import fs from 'fs'
import path from 'path'

/**
 * Represents a task node in the dependency graph.
 */
export interface TaskNode {
    id: string
    title: string
    status: 'backlog' | 'in-progress' | 'completed' | 'blocked'
    dependsOn: string[]
    blocks: string[]
    path: string
}

/**
 * Represents the entire dependency graph including nodes and detected cycles.
 */
export interface DependencyGraph {
    nodes: Map<string, TaskNode>
    cycles: string[][]
}

/**
 * Retrieves all tasks from the project (current, backlog, completed).
 *
 * @param projectDir - The root directory of the project
 * @returns Array of all found tasks
 */
export function getAllTasks(projectDir: string): TaskNode[] {
    const tasks: TaskNode[] = []

    const dirs = [path.join(projectDir, '.project', 'backlog'), path.join(projectDir, '.project', 'completed')]

    // 1. Current Task
    const currentTaskPath = path.join(projectDir, '.project', 'current-task.md')
    if (fs.existsSync(currentTaskPath)) {
        tasks.push(parseTaskFile(currentTaskPath, 'in-progress'))
    }

    // 2. Backlog & Completed
    dirs.forEach((dir) => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
            files.forEach((file) => {
                const status = dir.includes('completed') ? 'completed' : 'backlog'
                tasks.push(parseTaskFile(path.join(dir, file), status))
            })
        }
    })

    return tasks
}

interface Frontmatter {
    title?: string
    status?: string
    depends_on?: string[]
    blocks?: string[]
}

function parseTaskFile(filePath: string, initialStatus: TaskNode['status']): TaskNode {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = parseFrontmatter(content) as Frontmatter
    const filename = path.basename(filePath)

    // Extract ID
    let id = filename.replace('.md', '')
    if (filename === 'current-task.md') {
        const titleMatch = (data.title || '').match(/(T\d{3}|TASK-\d{3})/)
        id = titleMatch ? titleMatch[0] : 'CURRENT'
    } else {
        const match = filename.match(/(T\d+|TASK-\d+)/)
        if (match) id = match[0].replace('T', 'TASK-').replace('TASK-ASK-', 'TASK-')
        else id = filename
    }

    // Normalize dependencies
    let dependsOn: string[] = []
    if (Array.isArray(data.depends_on)) {
        dependsOn = data.depends_on
    }

    let blocks: string[] = []
    if (Array.isArray(data.blocks)) {
        blocks = data.blocks
    }

    return {
        id,
        title: data.title || 'Untitled',
        status: ((data.status === 'done' ? 'completed' : data.status) as TaskNode['status']) || initialStatus,
        dependsOn,
        blocks,
        path: filePath
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFrontmatter(content: string): Record<string, any> {
    const lines = content.split('\n')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frontmatter: Record<string, any> = {}
    let inFrontmatter = false
    let currentCtx: string | null = null // for arrays

    for (const line of lines) {
        if (line.trim() === '---') {
            if (!inFrontmatter) inFrontmatter = true
            else break
            continue
        }

        if (inFrontmatter) {
            // Simple key: value
            const match = line.match(/^(\w+):\s*(.+)?$/)
            if (match) {
                const key = match[1]
                const value = match[2]

                if (!value) {
                    // Start of array or object?
                    frontmatter[key] = []
                    currentCtx = key
                } else if (value.startsWith('[') && value.endsWith(']')) {
                    // Inline array
                    frontmatter[key] = value
                        .slice(1, -1)
                        .split(',')
                        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
                    currentCtx = null
                } else {
                    // active value
                    frontmatter[key] = value.trim().replace(/^['"]|['"]$/g, '')
                    currentCtx = key // if multiline array could happen? simple parser assumes indentation for array follows immediately
                }
            } else if (line.trim().startsWith('-') && currentCtx) {
                // Array item
                const item = line
                    .trim()
                    .substring(1)
                    .trim()
                    .replace(/^['"]|['"]$/g, '')
                const target = frontmatter[currentCtx] as string[]
                if (Array.isArray(target)) {
                    target.push(item)
                }
            }
        }
    }
    return frontmatter
}

/**
 * Builds a dependency graph from a list of tasks.
 * Detects cycles and identifies blocked tasks.
 *
 * @param tasks - The list of tasks to process
 * @returns The built dependency graph
 */
export function buildGraph(tasks: TaskNode[]): DependencyGraph {
    const nodes = new Map<string, TaskNode>()
    tasks.forEach((t) => nodes.set(t.id, t))

    // Logic to determine if blocked
    // blocked if any hard dependency is NOT completed
    tasks.forEach((task) => {
        if (task.status === 'completed') return

        const isBlocked = task.dependsOn.some((depId) => {
            // Find dep by ID (exact match or partial match?)
            // We'll trust exact match for now
            // But we should be robust about TASK-015 vs T015
            const dep = findTaskById(nodes, depId)
            return !dep || dep.status !== 'completed'
        })

        if (isBlocked) {
            task.status = 'blocked'
        }
    })

    return {
        nodes,
        cycles: detectCycles(nodes)
    }
}

function findTaskById(nodes: Map<string, TaskNode>, id: string): TaskNode | undefined {
    // Try exact
    if (nodes.has(id)) return nodes.get(id)

    // Try normalizing T015 -> TASK-015
    const normalized = id.startsWith('T') && !id.startsWith('TASK') ? id.replace('T', 'TASK-') : id
    if (nodes.has(normalized)) return nodes.get(normalized)

    // Try finding by prefix
    for (const [key, node] of nodes.entries()) {
        if (key.includes(id) || id.includes(key)) return node
    }
    return undefined
}

function detectCycles(nodes: Map<string, TaskNode>): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function dfs(taskId: string, path: string[]): void {
        visited.add(taskId)
        recursionStack.add(taskId)
        path.push(taskId)

        const task = nodes.get(taskId)
        if (task) {
            for (const depId of task.dependsOn) {
                // Find actual ID in graph
                const depNode = findTaskById(nodes, depId)
                if (!depNode) continue // Dependency not found in files

                const actualDepId = depNode.id

                if (!visited.has(actualDepId)) {
                    dfs(actualDepId, path)
                } else if (recursionStack.has(actualDepId)) {
                    // Cycle found
                    const cycleStart = path.indexOf(actualDepId)
                    cycles.push([...path.slice(cycleStart), actualDepId])
                }
            }
        }

        recursionStack.delete(taskId)
        path.pop()
    }

    for (const taskId of nodes.keys()) {
        if (!visited.has(taskId)) {
            dfs(taskId, [])
        }
    }

    return cycles
}
