import { describe, it, expect } from '@jest/globals'
import { formatGraph } from '../../src/commands/deps.js'
import { buildTaskGraph } from '../../src/core/graph.js'
import type { TaskRow, DependencyEdge } from '../../src/core/db.js'

function task(id: string, status = 'backlog', title = `Task ${id}`): TaskRow {
    return {
        id,
        title,
        task_type: 'feat',
        status,
        priority: 'P2-M',
        assignee: null,
        file_path: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
    }
}

function edge(taskId: string, dependsOn: string): DependencyEdge {
    return { taskId, dependsOn }
}

function render(tasks: TaskRow[], edges: DependencyEdge[]): string {
    // Strip ANSI colour codes so assertions test content, not formatting
    // eslint-disable-next-line no-control-regex
    return formatGraph(buildTaskGraph(tasks, edges)).join('\n').replace(/\[[0-9;]*m/g, '')
}

describe('formatGraph', () => {
    it('reports an empty project', () => {
        expect(render([], [])).toContain('No tasks found')
    })

    it('lists a task with no dependencies as ready', () => {
        const output = render([task('TASK-001')], [])

        expect(output).toContain('Ready to start')
        expect(output).toContain('TASK-001')
    })

    it('lists a blocked task with what it is waiting on', () => {
        const output = render([task('TASK-001'), task('TASK-002')], [edge('TASK-002', 'TASK-001')])

        expect(output).toContain('Blocked')
        expect(output).toMatch(/TASK-002[\s\S]*TASK-001/)
    })

    it('warns about dependency cycles', () => {
        const edges = [edge('TASK-001', 'TASK-002'), edge('TASK-002', 'TASK-001')]
        const output = render([task('TASK-001'), task('TASK-002')], edges)

        expect(output).toContain('Circular')
        expect(output).toContain('TASK-001 → TASK-002')
    })

    it('separates completed tasks from the frontier', () => {
        const output = render([task('TASK-001', 'done'), task('TASK-002')], [])

        expect(output).toContain('Completed')
        expect(output.indexOf('Ready to start')).toBeLessThan(output.indexOf('Completed'))
    })

    it('shows in-progress tasks in their own section', () => {
        const output = render([task('TASK-001', 'in-progress')], [])

        expect(output).toContain('In Progress')
    })
})
