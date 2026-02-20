import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { setupGitAttributes } from '../../src/core/installer.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/gitattributes-test')
const GITATTRIBUTES_PATH = join(TEST_ROOT, '.gitattributes')

beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('setupGitAttributes', () => {
    it('creates .gitattributes when file does not exist', async () => {
        await setupGitAttributes(TEST_ROOT)
        const content = readFileSync(GITATTRIBUTES_PATH, 'utf8')
        expect(content).toContain('events.jsonl merge=union')
    })

    it('appends to existing .gitattributes without overwriting', async () => {
        writeFileSync(GITATTRIBUTES_PATH, '* text=auto eol=lf\n', 'utf8')
        await setupGitAttributes(TEST_ROOT)
        const content = readFileSync(GITATTRIBUTES_PATH, 'utf8')
        expect(content).toContain('* text=auto eol=lf')
        expect(content).toContain('events.jsonl merge=union')
    })

    it('is idempotent — does not duplicate the entry', async () => {
        await setupGitAttributes(TEST_ROOT)
        await setupGitAttributes(TEST_ROOT)
        const content = readFileSync(GITATTRIBUTES_PATH, 'utf8')
        const occurrences = (content.match(/events\.jsonl merge=union/g) ?? []).length
        expect(occurrences).toBe(1)
    })

    it('does not write when dryRun is true', async () => {
        await setupGitAttributes(TEST_ROOT, true)
        let exists = false
        try {
            readFileSync(GITATTRIBUTES_PATH, 'utf8')
            exists = true
        } catch {
            exists = false
        }
        expect(exists).toBe(false)
    })

    it('created file starts without a leading newline', async () => {
        await setupGitAttributes(TEST_ROOT)
        const content = readFileSync(GITATTRIBUTES_PATH, 'utf8')
        expect(content.startsWith('\n')).toBe(false)
    })

    it('appended block has a separating newline before the comment', async () => {
        writeFileSync(GITATTRIBUTES_PATH, '* text=auto eol=lf', 'utf8')
        await setupGitAttributes(TEST_ROOT)
        const content = readFileSync(GITATTRIBUTES_PATH, 'utf8')
        // block starts with \n so there is separation from existing content
        expect(content).toContain('\n# AIPIM:')
    })
})
