import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { evaluateGate, lastActivityAt, getRequiredChecks, type CheckRecord } from '../../src/core/verification.js'
import type { AipimEvent, CheckRunEvent, TaskCreatedEvent, TaskCommentAddedEvent } from '../../src/types/index.js'

function check(command: string, passed: boolean, createdAt: string): CheckRecord {
    return { command, passed, created_at: createdAt }
}

describe('evaluateGate', () => {
    it('is satisfied when no checks are required', () => {
        const result = evaluateGate([], [], '2026-01-01T00:00:00.000Z')

        expect(result.satisfied).toBe(true)
        expect(result.missing).toEqual([])
    })

    it('reports a required command that was never run as missing', () => {
        const result = evaluateGate(['pnpm test'], [], '2026-01-01T00:00:00.000Z')

        expect(result.satisfied).toBe(false)
        expect(result.missing).toEqual(['pnpm test'])
    })

    it('is satisfied when every required command passed after the last activity', () => {
        const checks = [check('pnpm test', true, '2026-01-01T10:00:00.000Z'), check('pnpm lint', true, '2026-01-01T10:01:00.000Z')]

        const result = evaluateGate(['pnpm test', 'pnpm lint'], checks, '2026-01-01T09:00:00.000Z')

        expect(result.satisfied).toBe(true)
        expect(result.failing).toEqual([])
        expect(result.stale).toEqual([])
    })

    it('reports a command that passed before the last activity as stale', () => {
        const checks = [check('pnpm test', true, '2026-01-01T08:00:00.000Z')]

        const result = evaluateGate(['pnpm test'], checks, '2026-01-01T09:00:00.000Z')

        expect(result.satisfied).toBe(false)
        expect(result.stale).toEqual(['pnpm test'])
        expect(result.missing).toEqual([])
    })

    it('reports a command whose latest run failed as failing', () => {
        const checks = [check('pnpm test', true, '2026-01-01T10:00:00.000Z'), check('pnpm test', false, '2026-01-01T11:00:00.000Z')]

        const result = evaluateGate(['pnpm test'], checks, '2026-01-01T09:00:00.000Z')

        expect(result.satisfied).toBe(false)
        expect(result.failing).toEqual(['pnpm test'])
    })

    it('uses only the most recent run of each command', () => {
        const checks = [check('pnpm test', false, '2026-01-01T10:00:00.000Z'), check('pnpm test', true, '2026-01-01T11:00:00.000Z')]

        const result = evaluateGate(['pnpm test'], checks, '2026-01-01T09:00:00.000Z')

        expect(result.satisfied).toBe(true)
    })

    it('ignores recorded checks that are not required', () => {
        const checks = [check('pnpm typecheck', true, '2026-01-01T10:00:00.000Z')]

        const result = evaluateGate(['pnpm test'], checks, '2026-01-01T09:00:00.000Z')

        expect(result.satisfied).toBe(false)
        expect(result.missing).toEqual(['pnpm test'])
    })
})

function taskCreated(timestamp: string): TaskCreatedEvent {
    return {
        id: `evt-${timestamp}`,
        type: 'task.created',
        timestamp,
        actor: 'test@example.com',
        taskId: 'TASK-001',
        title: 'Test',
        taskType: 'feat',
        priority: 'P1-S',
        filePath: '.project/backlog/test.md'
    }
}

function comment(timestamp: string): TaskCommentAddedEvent {
    return {
        id: `evt-${timestamp}`,
        type: 'task.comment_added',
        timestamp,
        actor: 'test@example.com',
        taskId: 'TASK-001',
        text: 'note'
    }
}

function checkRun(timestamp: string): CheckRunEvent {
    return {
        id: `evt-${timestamp}`,
        type: 'check.run',
        timestamp,
        actor: 'test@example.com',
        taskId: 'TASK-001',
        command: 'pnpm test',
        exitCode: 0,
        passed: true
    }
}

describe('lastActivityAt', () => {
    it('returns null when the task has no events', () => {
        expect(lastActivityAt([], 'TASK-001')).toBeNull()
    })

    it('returns the timestamp of the latest non-check event', () => {
        const events: AipimEvent[] = [taskCreated('2026-01-01T10:00:00.000Z'), comment('2026-01-01T11:00:00.000Z')]

        expect(lastActivityAt(events, 'TASK-001')).toBe('2026-01-01T11:00:00.000Z')
    })

    it('ignores check.run events so recording evidence does not invalidate itself', () => {
        const events: AipimEvent[] = [comment('2026-01-01T11:00:00.000Z'), checkRun('2026-01-01T12:00:00.000Z')]

        expect(lastActivityAt(events, 'TASK-001')).toBe('2026-01-01T11:00:00.000Z')
    })

    it('ignores events belonging to other tasks', () => {
        const other = { ...comment('2026-01-01T12:00:00.000Z'), taskId: 'TASK-002' }
        const events: AipimEvent[] = [comment('2026-01-01T11:00:00.000Z'), other]

        expect(lastActivityAt(events, 'TASK-001')).toBe('2026-01-01T11:00:00.000Z')
    })
})

describe('getRequiredChecks', () => {
    const CONFIG_ROOT = join(process.cwd(), 'tests/__fixtures__/verification-config')

    beforeEach(() => {
        mkdirSync(join(CONFIG_ROOT, '.project'), { recursive: true })
    })

    afterEach(() => {
        rmSync(CONFIG_ROOT, { recursive: true, force: true })
    })

    it('returns an empty list when there is no config file', () => {
        expect(getRequiredChecks(CONFIG_ROOT)).toEqual([])
    })

    it('returns an empty list when the config declares no checks', () => {
        writeFileSync(join(CONFIG_ROOT, '.project/config.toml'), '[project]\nname = "Test"\n', 'utf8')

        expect(getRequiredChecks(CONFIG_ROOT)).toEqual([])
    })

    it('returns the configured check commands', () => {
        writeFileSync(
            join(CONFIG_ROOT, '.project/config.toml'),
            '[project]\nname = "Test"\n\n[checks]\ncommands = ["pnpm test", "pnpm lint"]\n',
            'utf8'
        )

        expect(getRequiredChecks(CONFIG_ROOT)).toEqual(['pnpm test', 'pnpm lint'])
    })

    it('ignores non-string entries so a malformed config cannot break the gate', () => {
        writeFileSync(
            join(CONFIG_ROOT, '.project/config.toml'),
            '[project]\nname = "Test"\n\n[checks]\ncommands = ["pnpm test", 42]\n',
            'utf8'
        )

        expect(getRequiredChecks(CONFIG_ROOT)).toEqual(['pnpm test'])
    })
})
