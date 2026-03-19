import { jest } from '@jest/globals'
import { skillRegistry } from '../../src/core/skills.js'
import { addSkill } from '../../src/commands/add.js'
import { listSkills } from '../../src/commands/list.js'

const mockSkill = {
    id: 'typescript',
    name: 'Strict TypeScript',
    description: 'Strict TypeScript rules',
    templateRelativePath: 'skills/typescript.md'
}

describe('addSkill()', () => {
    let exitSpy: jest.SpiedFunction<typeof process.exit>
    let getSpy: jest.SpiedFunction<typeof skillRegistry.get>
    let injectSpy: jest.SpiedFunction<typeof skillRegistry.injectSkill>

    beforeEach(() => {
        jest.clearAllMocks()
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
        getSpy = jest.spyOn(skillRegistry, 'get')
        injectSpy = jest.spyOn(skillRegistry, 'injectSkill')
    })

    afterEach(() => {
        exitSpy.mockRestore()
        getSpy.mockRestore()
        injectSpy.mockRestore()
    })

    it('calls injectSkill when skill exists', async () => {
        getSpy.mockReturnValue(mockSkill)
        injectSpy.mockResolvedValue(undefined)

        await addSkill('typescript')

        expect(getSpy).toHaveBeenCalledWith('typescript')
        expect(injectSpy).toHaveBeenCalledWith('typescript', process.cwd())
        expect(exitSpy).not.toHaveBeenCalled()
    })

    it('exits with code 1 when skill is not found', async () => {
        getSpy.mockReturnValue(undefined)
        injectSpy.mockResolvedValue(undefined)

        await addSkill('nonexistent')

        expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits with code 1 when injectSkill throws', async () => {
        getSpy.mockReturnValue(mockSkill)
        injectSpy.mockRejectedValue(new Error('Write failed'))

        await addSkill('typescript')

        expect(exitSpy).toHaveBeenCalledWith(1)
    })
})

describe('listSkills()', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>
    let listSpy: jest.SpiedFunction<typeof skillRegistry.list>

    beforeEach(() => {
        jest.clearAllMocks()
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        listSpy = jest.spyOn(skillRegistry, 'list')
    })

    afterEach(() => {
        consoleSpy.mockRestore()
        listSpy.mockRestore()
    })

    it('prints each skill id and name', () => {
        listSpy.mockReturnValue([
            mockSkill,
            { id: 'react', name: 'React', description: 'React guidelines', templateRelativePath: 'skills/react.md' }
        ])

        listSkills()

        const output = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n')
        expect(output).toContain('typescript')
        expect(output).toContain('react')
    })

    it('prints a fallback message when no skills are available', () => {
        listSpy.mockReturnValue([])

        listSkills()

        const output = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n')
        expect(output).toContain('No skills available')
    })
})
