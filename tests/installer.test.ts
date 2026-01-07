import { installProject } from '../src/core/installer.js'
import { createTempDir, cleanupTempDir } from './setup.js'
import { InstallConfig, DetectedProject } from '../src/types/index.js'
import fs from 'fs-extra'
import path from 'path'
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

describe('installProject', () => {
    let tempDir: string
    let originalCwd: string

    const mockDetected: DetectedProject = {
        framework: 'react',
        frameworkVersion: '^18.0.0',
        packageManager: 'pnpm',
        hasGit: true,
        hasNodeModules: true,
        existingSetup: {
            hasProject: false,
            hasPrompts: []
        }
    }

    const mockConfig: InstallConfig = {
        ais: ['claude-code'],
        guidelines: [],
        version: 'compact',
        skipConfirmation: true
    }

    beforeEach(async () => {
        originalCwd = process.cwd()
        tempDir = await createTempDir()
        process.chdir(tempDir)
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        await cleanupTempDir(tempDir)
    })

    test('creates .project directory structure', async () => {
        await installProject(mockConfig, mockDetected)

        expect(await fs.pathExists('.project')).toBe(true)
        expect(await fs.pathExists('.project/backlog')).toBe(true)
        expect(await fs.pathExists('.project/completed')).toBe(true)
        expect(await fs.pathExists('.project/decisions')).toBe(true)
        expect(await fs.pathExists('.project/docs')).toBe(true)
        expect(await fs.pathExists('.project/ideas')).toBe(true)
        expect(await fs.pathExists('.project/reports')).toBe(true)
    })

    test('creates CLAUDE.md for claude-code', async () => {
        await installProject(mockConfig, mockDetected)

        expect(await fs.pathExists('CLAUDE.md')).toBe(true)
        const content = await fs.readFile('CLAUDE.md', 'utf-8')
        expect(content).toContain('Project Management System')
    })

    test('creates GEMINI.md for gemini', async () => {
        const config = { ...mockConfig, ais: ['gemini'] }
        await installProject(config, mockDetected)

        expect(await fs.pathExists('GEMINI.md')).toBe(true)
    })

    test('creates multiple prompt files', async () => {
        const config = { ...mockConfig, ais: ['claude-code', 'gemini', 'chatgpt'] }
        await installProject(config, mockDetected)

        expect(await fs.pathExists('CLAUDE.md')).toBe(true)
        expect(await fs.pathExists('GEMINI.md')).toBe(true)
        expect(await fs.pathExists('CHATGPT.md')).toBe(true)
    })

    test('makes scripts executable', async () => {
        await installProject(mockConfig, mockDetected)

        const preSessionStats = await fs.stat('.project/scripts/pre-session.sh')
        const validateStats = await fs.stat('.project/scripts/validate-dod.sh')

        // Check executable bit (755 = rwxr-xr-x)
        // Skip on Windows as chmod/stat behavior varies significantly
        if (process.platform !== 'win32') {
            expect(preSessionStats.mode & 0o111).toBeTruthy()
            expect(validateStats.mode & 0o111).toBeTruthy()
        }
    })

    test('ignores missing scripts during chmod', async () => {
        // Mock pathExists to return false for scripts
        jest.spyOn(fs, 'pathExists').mockImplementation(async (p) => {
            if (typeof p === 'string' && p.includes('scripts/')) return false
            return true
        })

        await installProject(mockConfig, mockDetected)
        // Should not throw
    })

    test('merges guidelines when provided', async () => {
        const config = { ...mockConfig, guidelines: ['react'] }
        await installProject(config, mockDetected)

        const content = await fs.readFile('CLAUDE.md', 'utf-8')
        expect(content).toContain('React')
    })

    test('does not overwrite existing files with overwrite: false', async () => {
        await fs.ensureDir('.project')
        await fs.writeFile('.project/existing.md', 'original content')

        await installProject(mockConfig, mockDetected)

        const content = await fs.readFile('.project/existing.md', 'utf-8')
        expect(content).toBe('original content')
    })

    test('throws error if templates directory not found', async () => {
        // Mock fs.existsSync to always return false
        jest.spyOn(fs, 'existsSync').mockReturnValue(false)

        await expect(installProject(mockConfig, mockDetected)).rejects.toThrow('Templates directory not found')
    })

    test('throws helpful error on permission denied', async () => {
        jest.spyOn(fs, 'copy').mockImplementationOnce(() => Promise.reject({ code: 'EACCES' }))
        
        await expect(installProject(mockConfig, mockDetected)).rejects.toThrow('Permission denied')
    })

    test('throws helpful error on disk full', async () => {
        jest.spyOn(fs, 'copy').mockImplementationOnce(() => Promise.reject({ code: 'ENOSPC' }))
        
        await expect(installProject(mockConfig, mockDetected)).rejects.toThrow('Disk full')
    })
})
