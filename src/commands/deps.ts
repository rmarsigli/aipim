import { Command } from 'commander'
import chalk from 'chalk'
import { existsSync } from 'fs'
import { join } from 'path'
import { readEvents } from '@/core/events.js'
import { rebuild, openDb } from '@/core/db.js'
import { loadTaskGraph, type TaskGraph, type GraphNode } from '@/core/graph.js'
import { logger } from '@/utils/logger.js'
import { output } from '@/utils/output.js'

function section(lines: string[], heading: string, nodes: GraphNode[], render: (node: GraphNode) => string[]): void {
    if (nodes.length === 0) return
    lines.push(heading)
    for (const node of nodes) lines.push(...render(node))
    lines.push('')
}

/**
 * Renders the dependency graph as terminal lines.
 * Kept pure and separate from the command so it can be tested directly.
 */
export function formatGraph(graph: TaskGraph): string[] {
    const lines: string[] = [chalk.bold('\nTask Dependency Graph\n')]

    if (graph.nodes.length === 0) {
        lines.push(chalk.yellow('No tasks found.'))
        return lines
    }

    if (graph.cycles.length > 0) {
        lines.push(chalk.red.bold('Circular dependencies detected:'))
        for (const cycle of graph.cycles) {
            lines.push(chalk.red(`  ${[...cycle, cycle[0]].join(' → ')}`))
        }
        lines.push('')
    }

    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    const ready = graph.ready.map((id) => byId.get(id) as GraphNode)
    const blocked = graph.blocked.map((id) => byId.get(id) as GraphNode)

    section(
        lines,
        chalk.blue.bold('In Progress:'),
        graph.nodes.filter((n) => n.status === 'in-progress'),
        (node) => [chalk.blue(`  ${node.id}: ${node.title}`)]
    )

    section(lines, chalk.yellow.bold('Ready to start:'), ready, (node) => [chalk.yellow(`  ${node.id}: ${node.title}`)])

    section(lines, chalk.red.bold('Blocked:'), blocked, (node) => [
        chalk.red(`  ${node.id}: ${node.title}`),
        ...node.blockedBy.map((depId) => {
            const status = byId.get(depId)?.status ?? 'missing'
            return chalk.gray(`     └─> waiting on ${depId} [${status}]`)
        })
    ])

    section(
        lines,
        chalk.green.bold('Completed:'),
        graph.nodes.filter((n) => n.status === 'done'),
        (node) => [chalk.green(`  ${node.id}: ${node.title}`)]
    )

    return lines
}

export const deps = new Command()
    .name('deps')
    .description('Visualize the task dependency graph')
    .action(() => {
        const projectRoot = process.cwd()

        if (!existsSync(join(projectRoot, '.project'))) {
            logger.error('No .project directory found. Run `aipim install` first.')
            process.exit(1)
        }

        try {
            // Derive the read model from the event log, exactly like the server does
            rebuild(projectRoot, readEvents(projectRoot))
            const db = openDb(projectRoot)
            try {
                for (const line of formatGraph(loadTaskGraph(db))) output.print(line)
            } finally {
                db.close()
            }
        } catch (error) {
            logger.error('Failed to analyze dependencies')
            if (error instanceof Error) logger.debug(error.message)
            process.exit(1)
        }
    })
