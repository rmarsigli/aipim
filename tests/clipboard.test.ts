import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { copyToClipboard } from '@/utils/clipboard.js'
import { spawn } from 'child_process'

// Handle ESM mocking for child_process
const mockSpawn = jest.fn()

jest.unstable_mockModule('child_process', () => ({
    spawn: mockSpawn,
    execSync: jest.fn() // Should not be called
}))

// We need to re-import the module under test after mocking
let clipboardModule: any

describe('Clipboard Utils', () => {
    beforeEach(async () => {
        jest.clearAllMocks()
        mockSpawn.mockImplementation(() => {
            return {
                on: jest.fn((event, cb) => {
                    if (event === 'close') cb(0) // Success by default
                }),
                stdin: {
                    write: jest.fn(),
                    end: jest.fn()
                },
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                unref: jest.fn()
            }
        })
        
        // Dynamic import to apply mocks
        clipboardModule = await import('@/utils/clipboard.js')
    })

    it('should try clipboardy first', async () => {
        // Mock clipboardy? It's hard because it's a dynamic import in the source.
        // If we can't mock it easily, we test the fallback.
        // Assuming clipboardy might fail or we want to test fallback.
        // Actually, if we are in test env, clipboardy might work if installed.
        // But we want to test the spawning logic.
        
        // Let's force clipboardy to fail to test fallback paths
        jest.unstable_mockModule('clipboardy', () => ({
            default: {
                write: jest.fn().mockRejectedValue(new Error('No clipboard'))
            }
        }))
        
        // Re-import
        clipboardModule = await import('@/utils/clipboard.js')
        
        // Mock platform
        Object.defineProperty(process, 'platform', {
            value: 'darwin'
        })

        const result = await clipboardModule.copyToClipboard('test text')
        
        expect(mockSpawn).toHaveBeenCalledWith('pbcopy', [])
        expect(result).toBe(true)
    })

    it('should fallback to xclip on linux', async () => {
        jest.unstable_mockModule('clipboardy', () => ({
            default: { write: jest.fn().mockRejectedValue(new Error('Fail')) }
        }))
        clipboardModule = await import('@/utils/clipboard.js')

        Object.defineProperty(process, 'platform', { value: 'linux' })

        await clipboardModule.copyToClipboard('linux text')
        
        expect(mockSpawn).toHaveBeenCalledWith('xclip', ['-selection', 'clipboard'])
    })
})
