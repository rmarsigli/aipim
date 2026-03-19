import { describe, it, expect } from '@jest/globals'
import { buildGraph, TaskNode } from '../../src/utils/dependencies.js'

function makeTask(id: string, status: TaskNode['status'] = 'backlog', dependsOn: string[] = []): TaskNode {
    return { id, title: id, status, dependsOn, blocks: [], path: `/tmp/${id}.md` }
}

describe('buildGraph()', () => {
    it('returns empty graph for empty task list', () => {
        const graph = buildGraph([])
        expect(graph.nodes.size).toBe(0)
        expect(graph.cycles).toHaveLength(0)
    })

    it('maps all tasks as nodes', () => {
        const tasks = [makeTask('TASK-001'), makeTask('TASK-002')]
        const graph = buildGraph(tasks)
        expect(graph.nodes.size).toBe(2)
        expect(graph.nodes.has('TASK-001')).toBe(true)
        expect(graph.nodes.has('TASK-002')).toBe(true)
    })

    it('does not mark blocked when dependencies are all completed', () => {
        const tasks = [makeTask('TASK-001', 'completed'), makeTask('TASK-002', 'backlog', ['TASK-001'])]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-002')?.status).toBe('backlog')
    })

    it('marks task as blocked when dependency is not completed', () => {
        const tasks = [makeTask('TASK-001', 'backlog'), makeTask('TASK-002', 'backlog', ['TASK-001'])]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-002')?.status).toBe('blocked')
    })

    it('marks task as blocked when dependency does not exist at all', () => {
        const tasks = [makeTask('TASK-002', 'backlog', ['TASK-GHOST'])]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-002')?.status).toBe('blocked')
    })

    it('does not change status of completed tasks even if dependency is pending', () => {
        const tasks = [makeTask('TASK-001', 'backlog'), makeTask('TASK-002', 'completed', ['TASK-001'])]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-002')?.status).toBe('completed')
    })

    it('handles task with multiple dependencies — blocked if any is incomplete', () => {
        const tasks = [
            makeTask('TASK-001', 'completed'),
            makeTask('TASK-002', 'backlog'),
            makeTask('TASK-003', 'backlog', ['TASK-001', 'TASK-002'])
        ]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-003')?.status).toBe('blocked')
    })

    it('handles task with multiple dependencies — not blocked if all are complete', () => {
        const tasks = [
            makeTask('TASK-001', 'completed'),
            makeTask('TASK-002', 'completed'),
            makeTask('TASK-003', 'backlog', ['TASK-001', 'TASK-002'])
        ]
        const graph = buildGraph(tasks)
        expect(graph.nodes.get('TASK-003')?.status).toBe('backlog')
    })

    it('resolves T015 shorthand as TASK-015', () => {
        const tasks = [makeTask('TASK-015', 'backlog'), makeTask('TASK-016', 'backlog', ['T015'])]
        const graph = buildGraph(tasks)
        // TASK-015 is not completed, so TASK-016 must be blocked
        expect(graph.nodes.get('TASK-016')?.status).toBe('blocked')
    })

    describe('cycle detection', () => {
        it('detects a direct cycle (A → B → A)', () => {
            const tasks = [makeTask('TASK-A', 'backlog', ['TASK-B']), makeTask('TASK-B', 'backlog', ['TASK-A'])]
            const graph = buildGraph(tasks)
            expect(graph.cycles.length).toBeGreaterThan(0)
        })

        it('detects a transitive cycle (A → B → C → A)', () => {
            const tasks = [
                makeTask('TASK-A', 'backlog', ['TASK-B']),
                makeTask('TASK-B', 'backlog', ['TASK-C']),
                makeTask('TASK-C', 'backlog', ['TASK-A'])
            ]
            const graph = buildGraph(tasks)
            expect(graph.cycles.length).toBeGreaterThan(0)
        })

        it('returns no cycles when graph is a DAG', () => {
            const tasks = [
                makeTask('TASK-001', 'completed'),
                makeTask('TASK-002', 'backlog', ['TASK-001']),
                makeTask('TASK-003', 'backlog', ['TASK-002'])
            ]
            const graph = buildGraph(tasks)
            expect(graph.cycles).toHaveLength(0)
        })
    })
})
