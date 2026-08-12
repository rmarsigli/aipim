import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
    buildHookSettings,
    mergeHookSettings,
    buildSessionContext,
    installHooks,
    evaluateStopHook,
    AIPIM_HOOK_MARKER,
} from '../../src/core/hooks.js'
import { openDb, rebuild, applyEvent } from '../../src/core/db.js'
import type { AipimEvent } from '../../src/types/index.js'
import Database from 'better-sqlite3'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/hooks-test')

describe('buildHookSettings', () => {
    it('registers a SessionStart hook', () => {
        const settings = buildHookSettings()

        expect(settings.hooks.SessionStart).toBeDefined()
        expect(JSON.stringify(settings.hooks.SessionStart)).toContain('aipim hook session-start')
    })

    it('registers a Stop hook', () => {
        const settings = buildHookSettings()

        expect(JSON.stringify(settings.hooks.Stop)).toContain('aipim hook stop')
    })

    it('marks its hooks so they can be recognised later', () => {
        expect(JSON.stringify(buildHookSettings())).toContain(AIPIM_HOOK_MARKER)
    })
})

describe('mergeHookSettings', () => {
    it('adds hooks to an empty settings file', () => {
        const merged = mergeHookSettings({}, buildHookSettings())

        expect(JSON.stringify(merged)).toContain('aipim hook session-start')
    })

    it('keeps unrelated top-level settings untouched', () => {
        const existing = { permissions: { allow: ['Bash(ls:*)'] } }

        const merged = mergeHookSettings(existing, buildHookSettings()) as Record<string, unknown>

        expect(merged.permissions).toEqual({ allow: ['Bash(ls:*)'] })
    })

    it('keeps hooks the user configured for the same event', () => {
        const existing = {
            hooks: {
                SessionStart: [{ hooks: [{ type: 'command', command: 'echo mine' }] }]
            }
        }

        const merged = mergeHookSettings(existing, buildHookSettings())

        expect(JSON.stringify(merged)).toContain('echo mine')
        expect(JSON.stringify(merged)).toContain('aipim hook session-start')
    })

    it('is idempotent — running twice does not duplicate the hooks', () => {
        const once = mergeHookSettings({}, buildHookSettings())
        const twice = mergeHookSettings(once, buildHookSettings())

        expect(JSON.stringify(twice)).toEqual(JSON.stringify(once))
    })

    it('replaces a previous AIPIM hook instead of stacking a second one', () => {
        const stale = mergeHookSettings({}, {
            hooks: {
                SessionStart: [
                    { hooks: [{ type: 'command', command: `aipim hook session-start --old # ${AIPIM_HOOK_MARKER}` }] }
                ]
            }
        })

        const merged = JSON.stringify(mergeHookSettings(stale, buildHookSettings()))

        expect(merged).not.toContain('--old')
        expect(merged.match(/aipim hook session-start/g)).toHaveLength(1)
    })
})

describe('buildSessionContext', () => {
    let db: Database.Database

    function seedTask(taskId: string, priority = 'P1-S'): void {
        const evt: AipimEvent = {
            id: `evt-${taskId}`,
            type: 'task.created',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId,
            title: `Task ${taskId}`,
            taskType: 'feat',
            priority,
            filePath: `.project/backlog/${taskId}.md`
        }
        applyEvent(db, evt)
    }

    beforeEach(() => {
        mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
        rebuild(TEST_ROOT, [])
        db = openDb(TEST_ROOT)
    })

    afterEach(() => {
        db.close()
        rmSync(TEST_ROOT, { recursive: true, force: true })
    })

    it('says the backlog is empty when there are no tasks', () => {
        expect(buildSessionContext(db, TEST_ROOT)).toContain('No tasks')
    })

    it('names the next ready task', () => {
        seedTask('TASK-001')

        expect(buildSessionContext(db, TEST_ROOT)).toContain('TASK-001')
    })

    it('reports the task in progress', () => {
        seedTask('TASK-001')
        applyEvent(db, {
            id: 'st-1',
            type: 'task.status_changed',
            timestamp: new Date().toISOString(),
            actor: 'test@example.com',
            taskId: 'TASK-001',
            from: 'backlog',
            to: 'in-progress'
        })

        const context = buildSessionContext(db, TEST_ROOT)

        expect(context).toContain('In progress')
        expect(context).toContain('TASK-001')
    })

    it('warns about dependency cycles', () => {
        seedTask('TASK-001')
        seedTask('TASK-002')
        for (const [taskId, dependsOn] of [
            ['TASK-001', 'TASK-002'],
            ['TASK-002', 'TASK-001']
        ]) {
            applyEvent(db, {
                id: `dep-${taskId}`,
                type: 'task.dependency_added',
                timestamp: new Date().toISOString(),
                actor: 'test@example.com',
                taskId,
                dependsOn
            })
        }

        expect(buildSessionContext(db, TEST_ROOT)).toContain('cycle')
    })
})

describe('installHooks', () => {
    beforeEach(() => {
        mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
    })

    afterEach(() => {
        rmSync(TEST_ROOT, { recursive: true, force: true })
    })

    it('creates .claude/settings.json when it does not exist', () => {
        installHooks(TEST_ROOT)

        const written = JSON.parse(readFileSync(join(TEST_ROOT, '.claude/settings.json'), 'utf8'))
        expect(JSON.stringify(written)).toContain('aipim hook session-start')
    })

    it('preserves existing settings when merging', () => {
        mkdirSync(join(TEST_ROOT, '.claude'), { recursive: true })
        writeFileSync(join(TEST_ROOT, '.claude/settings.json'), JSON.stringify({ model: 'opus' }), 'utf8')

        installHooks(TEST_ROOT)

        const written = JSON.parse(readFileSync(join(TEST_ROOT, '.claude/settings.json'), 'utf8'))
        expect(written.model).toBe('opus')
        expect(written.hooks).toBeDefined()
    })

    it('leaves a malformed settings file alone instead of destroying it', () => {
        mkdirSync(join(TEST_ROOT, '.claude'), { recursive: true })
        writeFileSync(join(TEST_ROOT, '.claude/settings.json'), '{ not json', 'utf8')

        expect(() => installHooks(TEST_ROOT)).toThrow('could not be parsed')
        expect(readFileSync(join(TEST_ROOT, '.claude/settings.json'), 'utf8')).toBe('{ not json')
    })
})

describe('evaluateStopHook', () => {
    let db: Database.Database

    function seed(taskId: string): void {
        applyEvent(db, {
            id: `evt-${taskId}`,
            type: 'task.created',
            timestamp: '2026-01-01T00:00:00.000Z',
            actor: 'test@example.com',
            taskId,
            title: `Task ${taskId}`,
            taskType: 'feat',
            priority: 'P1-S',
            filePath: '',
        })
        applyEvent(db, {
            id: `st-${taskId}`,
            type: 'task.status_changed',
            timestamp: '2026-01-01T00:01:00.000Z',
            actor: 'test@example.com',
            taskId,
            from: 'backlog',
            to: 'in-progress',
        })
    }

    function writeConfig(body: string): void {
        writeFileSync(join(TEST_ROOT, '.project/config.toml'), body, 'utf8')
    }

    beforeEach(() => {
        mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
        rebuild(TEST_ROOT, [])
        db = openDb(TEST_ROOT)
    })

    afterEach(() => {
        db.close()
        rmSync(TEST_ROOT, { recursive: true, force: true })
    })

    it('does not block when nothing is in progress', () => {
        expect(evaluateStopHook(db, TEST_ROOT, []).block).toBe(false)
    })

    it('does not block when the project has not opted in', () => {
        seed('TASK-001')
        writeConfig('[project]\nname = "T"\n\n[checks]\ncommands = ["pnpm test"]\n')

        expect(evaluateStopHook(db, TEST_ROOT, []).block).toBe(false)
    })

    it('blocks unverified in-progress work when the project opted in', () => {
        seed('TASK-001')
        writeConfig(
            '[project]\nname = "T"\n\n[checks]\ncommands = ["pnpm test"]\n\n[hooks]\nblock_on_unverified = true\n'
        )

        const result = evaluateStopHook(db, TEST_ROOT, [])

        expect(result.block).toBe(true)
        expect(result.reason).toContain('TASK-001')
    })

    it('does not block once the checks have passed', () => {
        seed('TASK-001')
        writeConfig(
            '[project]\nname = "T"\n\n[checks]\ncommands = ["pnpm test"]\n\n[hooks]\nblock_on_unverified = true\n'
        )
        applyEvent(db, {
            id: 'chk-1',
            type: 'check.run',
            timestamp: '2026-01-02T00:00:00.000Z',
            actor: 'test@example.com',
            taskId: 'TASK-001',
            command: 'pnpm test',
            exitCode: 0,
            passed: true,
        })

        expect(evaluateStopHook(db, TEST_ROOT, []).block).toBe(false)
    })

    it('does not block when the project configures no checks at all', () => {
        seed('TASK-001')
        writeConfig('[project]\nname = "T"\n\n[hooks]\nblock_on_unverified = true\n')

        expect(evaluateStopHook(db, TEST_ROOT, []).block).toBe(false)
    })
})
