import { describe, it, expect } from '@jest/globals'
import { buildTaskGraph, detectCycles, wouldCreateCycle } from '../../src/core/graph.js'
import type { TaskRow, DependencyEdge } from '../../src/core/db.js'

function task(id: string, status = 'backlog', priority = 'P2-M'): TaskRow {
    return {
        id,
        title: `Task ${id}`,
        task_type: 'feat',
        status,
        priority,
        assignee: null,
        file_path: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
    }
}

function edge(taskId: string, dependsOn: string): DependencyEdge {
    return { taskId, dependsOn }
}

describe('detectCycles', () => {
    it('returns no cycles for an empty graph', () => {
        expect(detectCycles([])).toEqual([])
    })

    it('returns no cycles for a linear chain', () => {
        expect(detectCycles([edge('B', 'A'), edge('C', 'B')])).toEqual([])
    })

    it('returns no cycles for a diamond', () => {
        const edges = [edge('B', 'A'), edge('C', 'A'), edge('D', 'B'), edge('D', 'C')]

        expect(detectCycles(edges)).toEqual([])
    })

    it('detects a two-node cycle', () => {
        const cycles = detectCycles([edge('A', 'B'), edge('B', 'A')])

        expect(cycles).toHaveLength(1)
        expect(cycles[0]).toEqual(['A', 'B'])
    })

    it('detects a three-node cycle', () => {
        const cycles = detectCycles([edge('A', 'B'), edge('B', 'C'), edge('C', 'A')])

        expect(cycles).toHaveLength(1)
        expect(cycles[0]).toEqual(['A', 'B', 'C'])
    })

    it('detects a self-dependency as a cycle', () => {
        expect(detectCycles([edge('A', 'A')])).toEqual([['A']])
    })

    it('reports the same cycle once regardless of traversal order', () => {
        const cycles = detectCycles([edge('B', 'C'), edge('C', 'A'), edge('A', 'B')])

        expect(cycles).toHaveLength(1)
    })
})

describe('wouldCreateCycle', () => {
    it('allows an edge that keeps the graph acyclic', () => {
        expect(wouldCreateCycle([edge('B', 'A')], 'C', 'B')).toBe(false)
    })

    it('rejects an edge that closes a loop', () => {
        expect(wouldCreateCycle([edge('B', 'A')], 'A', 'B')).toBe(true)
    })

    it('rejects a task depending on itself', () => {
        expect(wouldCreateCycle([], 'A', 'A')).toBe(true)
    })

    it('rejects an edge that closes a longer loop', () => {
        expect(wouldCreateCycle([edge('B', 'A'), edge('C', 'B')], 'A', 'C')).toBe(true)
    })
})

describe('buildTaskGraph', () => {
    it('marks a task with no dependencies as ready', () => {
        const graph = buildTaskGraph([task('TASK-001')], [])

        expect(graph.ready).toEqual(['TASK-001'])
        expect(graph.blocked).toEqual([])
    })

    it('marks a task as blocked while its dependency is unfinished', () => {
        const tasks = [task('TASK-001'), task('TASK-002')]
        const graph = buildTaskGraph(tasks, [edge('TASK-002', 'TASK-001')])

        expect(graph.ready).toEqual(['TASK-001'])
        expect(graph.blocked).toEqual(['TASK-002'])
    })

    it('marks a task as ready once its dependency is done', () => {
        const tasks = [task('TASK-001', 'done'), task('TASK-002')]
        const graph = buildTaskGraph(tasks, [edge('TASK-002', 'TASK-001')])

        expect(graph.ready).toEqual(['TASK-002'])
    })

    it('reports which dependencies are blocking a task', () => {
        const tasks = [task('TASK-001'), task('TASK-002', 'done'), task('TASK-003')]
        const edges = [edge('TASK-003', 'TASK-001'), edge('TASK-003', 'TASK-002')]

        const graph = buildTaskGraph(tasks, edges)
        const node = graph.nodes.find((n) => n.id === 'TASK-003')

        expect(node?.blockedBy).toEqual(['TASK-001'])
    })

    it('treats a dependency on an unknown task as blocking', () => {
        const graph = buildTaskGraph([task('TASK-002')], [edge('TASK-002', 'TASK-999')])

        expect(graph.blocked).toEqual(['TASK-002'])
        expect(graph.nodes[0].blockedBy).toEqual(['TASK-999'])
    })

    it('excludes done tasks from both ready and blocked', () => {
        const graph = buildTaskGraph([task('TASK-001', 'done')], [])

        expect(graph.ready).toEqual([])
        expect(graph.blocked).toEqual([])
    })

    it('records the reverse edge on the dependency', () => {
        const tasks = [task('TASK-001'), task('TASK-002')]
        const graph = buildTaskGraph(tasks, [edge('TASK-002', 'TASK-001')])

        expect(graph.nodes.find((n) => n.id === 'TASK-001')?.blocks).toEqual(['TASK-002'])
    })

    it('surfaces cycles alongside the nodes', () => {
        const tasks = [task('TASK-001'), task('TASK-002')]
        const edges = [edge('TASK-001', 'TASK-002'), edge('TASK-002', 'TASK-001')]

        expect(buildTaskGraph(tasks, edges).cycles).toEqual([['TASK-001', 'TASK-002']])
    })

    it('never reports a manually blocked task as ready', () => {
        const graph = buildTaskGraph([task('TASK-001', 'blocked')], [])

        expect(graph.ready).toEqual([])
        expect(graph.blocked).toEqual(['TASK-001'])
    })

    it('orders ready tasks by priority so the frontier is actionable', () => {
        const tasks = [task('TASK-001', 'backlog', 'P3'), task('TASK-002', 'backlog', 'P1-S')]

        expect(buildTaskGraph(tasks, []).ready).toEqual(['TASK-002', 'TASK-001'])
    })
})
