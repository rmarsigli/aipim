import { jest } from '@jest/globals'
import fs from 'fs-extra'
import path from 'path'
import { skillRegistry } from '../../src/core/skills.js'
import { signatureManager } from '../../src/core/signature.js'

jest.mock('fs-extra')

describe('SkillRegistry', () => {
    let tempDir: string

    beforeEach(() => {
        jest.clearAllMocks()
        tempDir = '/tmp/aipim-test-' + Date.now()
        jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined as never)
    })

    describe('get and list', () => {
        it('should return available skills', () => {
            const skills = skillRegistry.list()
            expect(skills.length).toBeGreaterThan(0)
            expect(skillRegistry.get('pest')).toBeDefined()
        })

        it('should return undefined for invalid skill', () => {
            expect(skillRegistry.get('nonexistent')).toBeUndefined()
        })
    })

    describe('injectSkill', () => {
        it('should inject skill into Laravel Boost if .ai/guidelines exists', async () => {
            jest.spyOn(fs, 'pathExists').mockImplementation(async (filePath: string) => {
                if (filePath.endsWith('.ai/guidelines')) return true
                if (filePath.includes('skills/pest.md')) return true
                return false
            })

            jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
                if (String(filePath).includes('pest.md')) return '### Skill: Pest PHP'
                return ''
            })

            await skillRegistry.injectSkill('pest', tempDir)

            const expectedPath = path.join(tempDir, '.ai/guidelines/skill-pest.blade.php')
            expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, '### Skill: Pest PHP', 'utf-8')
        })

        it('should inject into CLAUDE.md for standard mode', async () => {
            jest.spyOn(fs, 'pathExists').mockImplementation(async (filePath: string) => {
                if (filePath.endsWith('.ai/guidelines')) return false
                if (filePath.endsWith('CLAUDE.md')) return true
                if (filePath.endsWith('GEMINI.md')) return false
                if (filePath.includes('skills/pest.md')) return true
                return false
            })

            jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
                if (String(filePath).includes('pest.md')) return '### Skill: Pest PHP'
                if (String(filePath).endsWith('CLAUDE.md')) return 'Some text\\n{{/SLOT:guidelines}}\\nFooter'
                return ''
            })

            jest.spyOn(signatureManager, 'sign').mockReturnValue('SignedContent')

            await skillRegistry.injectSkill('pest', tempDir)

            expect(fs.writeFile).toHaveBeenCalledWith(
                path.join(tempDir, 'CLAUDE.md'),
                'SignedContent',
                'utf-8'
            )
        })

        it('should skip injection if already exists in CLAUDE.md', async () => {
            jest.spyOn(fs, 'pathExists').mockImplementation(async (filePath: string) => {
                if (filePath.endsWith('.ai/guidelines')) return false
                if (filePath.endsWith('CLAUDE.md')) return true
                if (filePath.includes('skills/pest.md')) return true
                return false
            })

            jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
                if (String(filePath).includes('pest.md')) return '### Skill: Pest PHP'
                if (String(filePath).endsWith('CLAUDE.md')) return 'Prefix\\n### Skill: Pest PHP\\n{{/SLOT:guidelines}}'
                return ''
            })

            await skillRegistry.injectSkill('pest', tempDir)

            // Should not overwrite because it's already there
            expect(fs.writeFile).not.toHaveBeenCalled()
        })
    })
})
