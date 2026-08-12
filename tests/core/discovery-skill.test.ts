import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { installDiscoverySkill, CLAUDE_SKILL_PATH, PROMPT_PATH } from '../../src/core/discovery-skill.js'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/discovery-skill-test')
const TEMPLATES = join(process.cwd(), 'src/templates')

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('installDiscoverySkill', () => {
    it('should always write the harness-neutral playbook', () => {
        const { written } = installDiscoverySkill(TEST_ROOT, TEMPLATES)

        expect(written).toEqual([PROMPT_PATH])
        expect(existsSync(join(TEST_ROOT, PROMPT_PATH))).toBe(true)
        expect(existsSync(join(TEST_ROOT, CLAUDE_SKILL_PATH))).toBe(false)
    })

    it('should also write a Claude Code skill when that harness is in play', () => {
        const { written } = installDiscoverySkill(TEST_ROOT, TEMPLATES, { claudeCode: true })

        expect(written).toEqual([PROMPT_PATH, CLAUDE_SKILL_PATH])
        expect(existsSync(join(TEST_ROOT, CLAUDE_SKILL_PATH))).toBe(true)
    })

    it('should describe explicit invocation, never intent', () => {
        installDiscoverySkill(TEST_ROOT, TEMPLATES, { claudeCode: true })
        const skill = readFileSync(join(TEST_ROOT, CLAUDE_SKILL_PATH), 'utf8')

        // A description phrased around intent is what makes a skill fire on its
        // own — the one thing discovery must never do.
        expect(skill).toContain('Use ONLY when the user explicitly asks')
        expect(skill).toContain('Never invoke this on your own initiative')
    })

    it('should be idempotent across repeated installs', () => {
        installDiscoverySkill(TEST_ROOT, TEMPLATES, { claudeCode: true })
        const first = readFileSync(join(TEST_ROOT, CLAUDE_SKILL_PATH), 'utf8')

        installDiscoverySkill(TEST_ROOT, TEMPLATES, { claudeCode: true })
        expect(readFileSync(join(TEST_ROOT, CLAUDE_SKILL_PATH), 'utf8')).toBe(first)
    })

    it('should fail loudly when the template is missing', () => {
        expect(() => installDiscoverySkill(TEST_ROOT, join(TEST_ROOT, 'nowhere'))).toThrow('template not found')
    })
})
