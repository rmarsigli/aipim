import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { resolveNextTask } from '../../src/commands/task.js'

const FIXTURE_DIR = join(process.cwd(), 'tests/__fixtures__/task-next-test/backlog')

function writeTask(filename: string, priority: string, created: string, title = 'Test Task'): void {
    writeFileSync(
        join(FIXTURE_DIR, filename),
        `---\ntitle: "${title}"\npriority: ${priority}\ncreated: ${created}\nstatus: backlog\n---\n\n# ${title}\n`
    )
}

beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
})

afterEach(() => {
    rmSync(join(FIXTURE_DIR, '..'), { recursive: true, force: true })
})

describe('resolveNextTask', () => {
    it('returns null for empty file list', () => {
        expect(resolveNextTask([], FIXTURE_DIR)).toBeNull()
    })

    it('returns the single task when only one exists', () => {
        writeTask('TASK-001.md', 'P2-M', '2026-01-01T10:00:00Z', 'Only Task')
        const result = resolveNextTask(['TASK-001.md'], FIXTURE_DIR)
        expect(result?.title).toBe('Only Task')
        expect(result?.priority).toBe('P2-M')
    })

    it('prefers P1-S over P3', () => {
        writeTask('TASK-001.md', 'P3', '2026-01-01T10:00:00Z', 'Low Priority')
        writeTask('TASK-002.md', 'P1-S', '2026-01-02T10:00:00Z', 'Critical')
        const result = resolveNextTask(['TASK-001.md', 'TASK-002.md'], FIXTURE_DIR)
        expect(result?.title).toBe('Critical')
        expect(result?.priority).toBe('P1-S')
    })

    it('prefers P1-S over P1-M', () => {
        writeTask('TASK-001.md', 'P1-M', '2026-01-01T10:00:00Z', 'Medium')
        writeTask('TASK-002.md', 'P1-S', '2026-01-02T10:00:00Z', 'Small Critical')
        const result = resolveNextTask(['TASK-001.md', 'TASK-002.md'], FIXTURE_DIR)
        expect(result?.priority).toBe('P1-S')
    })

    it('prefers P1-L over P2-S', () => {
        writeTask('TASK-001.md', 'P2-S', '2026-01-01T10:00:00Z', 'Quick win')
        writeTask('TASK-002.md', 'P1-L', '2026-01-02T10:00:00Z', 'Critical large')
        const result = resolveNextTask(['TASK-001.md', 'TASK-002.md'], FIXTURE_DIR)
        expect(result?.priority).toBe('P1-L')
    })

    it('on priority tie, picks the oldest task (earlier created)', () => {
        writeTask('TASK-001.md', 'P1-S', '2026-01-03T10:00:00Z', 'Newer')
        writeTask('TASK-002.md', 'P1-S', '2026-01-01T10:00:00Z', 'Older')
        const result = resolveNextTask(['TASK-001.md', 'TASK-002.md'], FIXTURE_DIR)
        expect(result?.title).toBe('Older')
    })

    it('handles tasks without priority field (defaults to P3)', () => {
        writeFileSync(
            join(FIXTURE_DIR, 'TASK-001.md'),
            '---\ntitle: "No Priority"\ncreated: 2026-01-01T10:00:00Z\n---\n'
        )
        writeTask('TASK-002.md', 'P1-S', '2026-01-01T10:00:00Z', 'Has Priority')
        const result = resolveNextTask(['TASK-001.md', 'TASK-002.md'], FIXTURE_DIR)
        expect(result?.title).toBe('Has Priority')
    })

    it('handles tasks without created field (falls back to filename)', () => {
        writeFileSync(
            join(FIXTURE_DIR, 'TASK-001.md'),
            '---\ntitle: "No Created"\npriority: P1-S\n---\n'
        )
        expect(() => resolveNextTask(['TASK-001.md'], FIXTURE_DIR)).not.toThrow()
    })

    it('correctly orders all priority levels', () => {
        const priorities = ['P3', 'P2-L', 'P2-M', 'P2-S', 'P1-L', 'P1-M', 'P1-S']
        priorities.forEach((p, i) => {
            writeTask(`task-${i}.md`, p, `2026-01-0${i + 1}T10:00:00Z`, `Task ${p}`)
        })
        const files = priorities.map((p, i) => `task-${i}.md`)
        const result = resolveNextTask(files, FIXTURE_DIR)
        expect(result?.priority).toBe('P1-S')
    })
})
