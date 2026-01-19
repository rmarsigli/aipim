import { jest } from '@jest/globals'

// Mock dependencies using unstable_mockModule for ESM support
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}))

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        warn: jest.fn(),
    }
}))

jest.unstable_mockModule('../../src/utils/clipboard.js', () => ({
    copyToClipboard: jest.fn(),
}))

jest.unstable_mockModule('../../src/utils/context.js', () => ({
    getProjectName: jest.fn(),
    getCurrentBranch: jest.fn(),
    getRecentCommits: jest.fn(),
    getRecentDecisions: jest.fn(),
    parseContext: jest.fn(),
    parseTask: jest.fn(),
}))

jest.unstable_mockModule('fs-extra', () => ({
    writeFile: jest.fn(),
    default: { writeFile: jest.fn() }
}))

jest.unstable_mockModule('chalk', () => ({
    default: {
        blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
        green: (s: string) => s,
        gray: (s: string) => s,
        bold: (s: string) => s,
    }
}))

// Import dependencies AFTER mocking
const fs = await import('fs')
const { logger } = await import('../../src/utils/logger.js')
const { copyToClipboard } = await import('../../src/utils/clipboard.js')
const contextUtils = await import('../../src/utils/context.js')
const fsExtra = await import('fs-extra')
// Load chalk to ensure mock is applied (though unstable_mockModule handles it)
await import('chalk')
const { start } = await import('../../src/commands/start.js')

describe('start command', () => {
    const mockExit = jest.spyOn(globalThis.process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit: ${code}`)
    }) as any)
    const mockLog = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        // Default mocks
        ;(fs.existsSync as jest.Mock).mockReturnValue(true) // .project exists
        ;(fs.readFileSync as jest.Mock).mockReturnValue('')
        ;(contextUtils.getProjectName as jest.Mock).mockReturnValue('Test Project')
        ;(contextUtils.getCurrentBranch as jest.Mock).mockReturnValue('main')
        ;(contextUtils.getRecentCommits as jest.Mock).mockReturnValue([])
        ;(contextUtils.getRecentDecisions as jest.Mock).mockReturnValue([])
        ;(contextUtils.parseContext as jest.Mock).mockReturnValue({
            frontmatter: { session: 1, active_branches: ['main'] },
            currentState: 'Initial state',
            nextAction: 'Start coding',
        })
        ;(contextUtils.parseTask as jest.Mock).mockReturnValue({
            title: 'Test Task',
            estimated_hours: 2,
            actual_hours: 0,
            status: 'in-progress',
            currentPhase: 'Phase 1',
        })
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    test('exits if .project directory is missing', async () => {
        ;(fs.existsSync as jest.Mock).mockReturnValue(false)
        await expect(start()).rejects.toThrow('process.exit: 1')
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No .project directory found'))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    test('generates prompt with correct project info', async () => {
        await start({ print: true, logger: { log: mockLog } })
        
        const output = mockLog.mock.calls.flat().join('\n')
        expect(output).toContain('Project: Test Project')
        expect(output).toContain('**Session:** 1')
        expect(output).toContain('**Branch:** main')
        expect(output).toContain('**Next Action:** Start coding')
    })

    test('handles missing context.md', async () => {
        ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
            if (path.endsWith('.project')) return true
            if (path.endsWith('context.md')) return false
            return true
        })

        await start({ print: true, logger: { log: mockLog } })
        const output = mockLog.mock.calls.flat().join('\n')
        expect(logger.warn).toHaveBeenCalledWith('No context.md found')
        expect(output).toContain('No context.md found')
    })

    test('handles missing current-task.md', async () => {
         ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
            if (path.endsWith('.project')) return true
            if (path.endsWith('context.md')) return true
            if (path.endsWith('current-task.md')) return false
            return true
        })

        await start({ print: true, logger: { log: mockLog } })
        const output = mockLog.mock.calls.flat().join('\n')
        expect(output).toContain('**None** - No current task')
    })

    test('includes recent commits and decisions if available', async () => {
        ;(contextUtils.getRecentCommits as jest.Mock).mockReturnValue([
            { hash: 'abc', message: 'feat: test' }
        ])
        ;(contextUtils.getRecentDecisions as jest.Mock).mockReturnValue([
            { file: 'ADR-001.md', title: 'Use Jest' }
        ])

        await start({ print: true, logger: { log: mockLog } })
        const output = mockLog.mock.calls.flat().join('\n')
        expect(output).toContain('abc')
        expect(output).toContain('feat: test')
        expect(output).toContain('ADR-001.md')
        expect(output).toContain('Use Jest')
    })

    test('saves to file when --file option is used', async () => {
        const filePath = 'prompt.md'
        await start({ file: filePath, logger: { log: mockLog } })
        expect(fsExtra.writeFile).toHaveBeenCalledWith(expect.stringContaining(filePath), expect.any(String))
        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining(filePath))
    })

    test('copies to clipboard by default', async () => {
        ;(copyToClipboard as jest.Mock).mockResolvedValue(true)
        await start({ logger: { log: mockLog } })
        expect(copyToClipboard).toHaveBeenCalled()
        const output = mockLog.mock.calls.flat().join('\n')
        expect(output).toContain('Session prompt copied to clipboard')
    })

    test('falls back to print if clipboard copy fails', async () => {
        ;(copyToClipboard as jest.Mock).mockResolvedValue(false)
        await start({ logger: { log: mockLog } })
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not copy'))
        const output = mockLog.mock.calls.flat().join('\n')
        expect(output).toContain('AIPIM SESSION PROMPT')
    })
})
