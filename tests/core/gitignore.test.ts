import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { setupGitIgnore } from '../../src/core/installer.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/gitignore-test')
const GITIGNORE_PATH = join(TEST_ROOT, '.gitignore')

beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('setupGitIgnore', () => {
    it('creates .gitignore when the file does not exist', async () => {
        await setupGitIgnore(TEST_ROOT)
        const content = readFileSync(GITIGNORE_PATH, 'utf8')

        expect(content).toContain('.project/data.db')
        expect(content).toContain('.project/data.db-wal')
        expect(content).toContain('.project/data.db-shm')
    })

    it('excludes the write-ahead files, not just the database', async () => {
        // -wal and -shm churn hardest of the three; missing them is the usual slip.
        await setupGitIgnore(TEST_ROOT)
        const lines = readFileSync(GITIGNORE_PATH, 'utf8').split('\n')

        expect(lines).toContain('.project/data.db-wal')
        expect(lines).toContain('.project/data.db-shm')
    })

    it('appends to an existing .gitignore without overwriting', async () => {
        writeFileSync(GITIGNORE_PATH, 'node_modules/\ndist/\n', 'utf8')
        await setupGitIgnore(TEST_ROOT)
        const content = readFileSync(GITIGNORE_PATH, 'utf8')

        expect(content).toContain('node_modules/')
        expect(content).toContain('dist/')
        expect(content).toContain('.project/data.db')
    })

    it('is idempotent — does not duplicate the entry', async () => {
        await setupGitIgnore(TEST_ROOT)
        await setupGitIgnore(TEST_ROOT)
        const content = readFileSync(GITIGNORE_PATH, 'utf8')

        expect((content.match(/^\.project\/data\.db$/gm) ?? []).length).toBe(1)
    })

    it('leaves a project that already ignores the database untouched', async () => {
        writeFileSync(GITIGNORE_PATH, 'node_modules/\n.project/data.db\n', 'utf8')
        const before = readFileSync(GITIGNORE_PATH, 'utf8')

        await setupGitIgnore(TEST_ROOT)
        expect(readFileSync(GITIGNORE_PATH, 'utf8')).toBe(before)
    })

    it('does not write when dryRun is true', async () => {
        await setupGitIgnore(TEST_ROOT, true)
        expect(existsSync(GITIGNORE_PATH)).toBe(false)
    })

    it('created file starts without a leading newline', async () => {
        await setupGitIgnore(TEST_ROOT)
        expect(readFileSync(GITIGNORE_PATH, 'utf8').startsWith('\n')).toBe(false)
    })

    it('separates the appended block from existing content', async () => {
        writeFileSync(GITIGNORE_PATH, 'node_modules/', 'utf8')
        await setupGitIgnore(TEST_ROOT)
        expect(readFileSync(GITIGNORE_PATH, 'utf8')).toContain('\n# AIPIM:')
    })
})
