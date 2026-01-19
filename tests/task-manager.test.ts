import { taskManager } from '../src/core/task-manager.js'
import { createTempDir, cleanupTempDir } from './setup.js'
import fs from 'fs-extra'
import path from 'path'
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'

describe('TaskManager', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await createTempDir()
        // Setup base structure
        await fs.ensureDir(path.join(tempDir, '.project/backlog'))
    })

    afterEach(async () => {
        await cleanupTempDir(tempDir)
    })

    test('creates first task correctly', async () => {
        const filePath = await taskManager.initTask(tempDir, { type: 'feat', name: 'User Login' })
        
        expect(filePath).toContain('TASK-001-user-login.md')
        expect(await fs.pathExists(filePath)).toBe(true)
        
        const content = await fs.readFile(filePath, 'utf-8')
        expect(content).toContain('feat: User Login')
        expect(content).toContain('<!-- @aipim-signature:')
    })

    test('increments task ID', async () => {
        await fs.writeFile(path.join(tempDir, '.project/backlog/TASK-001-test.md'), '')
        
        const filePath = await taskManager.initTask(tempDir, { type: 'fix', name: 'Bug' })
        expect(filePath).toContain('TASK-002-bug.md')
    })

    test('updates backlog.md', async () => {
        await taskManager.initTask(tempDir, { type: 'chore', name: 'Cleanup' })
        
        const backlogPath = path.join(tempDir, '.project/backlog.md')
        expect(await fs.pathExists(backlogPath)).toBe(true)
        
        const content = await fs.readFile(backlogPath, 'utf-8')
        expect(content).toContain('| 001 | chore | [Cleanup](backlog/TASK-001-cleanup.md) | Todo |')
    })
})
