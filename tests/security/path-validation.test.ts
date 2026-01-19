import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import path from 'path'

// Mock implementation
const mockLstat = jest.fn()
const mockRealpath = jest.fn()

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('fs-extra', () => ({
    default: {
        lstat: mockLstat,
        realpath: mockRealpath,
        // Add other methods if needed by other imports (but path-validator only uses lstat, realpath logic)
        pathExists: jest.fn(),
        ensureDir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        copy: jest.fn(),
    }
}))

describe('Path Validator', () => {
    // Use OS-specific project root to avoid Windows drive letter issues
    const projectRoot = process.platform === 'win32'
        ? 'C:\\Users\\user\\project'
        : '/home/user/project'
    let validatePath: any
    let validatePathSafe: any
    let SecurityError: any

    beforeEach(async () => {
        jest.clearAllMocks()
        // Re-import module to ensure mocks are applied
        const module = await import('@/utils/path-validator.js')
        validatePath = module.validatePath
        validatePathSafe = module.validatePathSafe
        SecurityError = module.SecurityError
    })

    describe('validatePath', () => {
        it('should allow paths inside base directory', () => {
            const result = validatePath('src/index.ts', projectRoot)
            const expected = path.join(projectRoot, 'src/index.ts')
            expect(path.normalize(result)).toBe(path.normalize(expected))
        })

        it('should allow relative paths staying inside', () => {
            const result = validatePath('./src/../package.json', projectRoot)
            const expected = path.join(projectRoot, 'package.json')
            expect(path.normalize(result)).toBe(path.normalize(expected))
        })

        it('should allow absolute paths inside base', () => {
            const absPath = path.join(projectRoot, 'src/utils/file.ts')
            const result = validatePath(absPath, projectRoot)
            expect(path.normalize(result)).toBe(path.normalize(absPath))
        })

        it('should block parent directory traversal (../)', () => {
            expect(() => {
                validatePath('../outside.ts', projectRoot)
            }).toThrow(SecurityError)
        })

        it('should block multiple levels up (../../)', () => {
            expect(() => {
                validatePath('../../etc/passwd', projectRoot)
            }).toThrow(SecurityError)
        })

        it('should block absolute paths outside base', () => {
            expect(() => {
                validatePath('/etc/passwd', projectRoot)
            }).toThrow(SecurityError)
        })
    })

    describe('validatePathSafe (Symlinks)', () => {
        it('should allow normal files', async () => {
            mockLstat.mockResolvedValue({ isSymbolicLink: () => false } as any)

            const result = await validatePathSafe('src/normal.ts', projectRoot)
            const expected = path.join(projectRoot, 'src/normal.ts')
            expect(path.normalize(result)).toBe(path.normalize(expected))
        })

        it('should allow safe symlinks (pointing inside)', async () => {
            const realPath = path.join(projectRoot, 'src/real.ts')

            mockLstat.mockResolvedValue({ isSymbolicLink: () => true } as any)
            mockRealpath.mockResolvedValue(realPath)

            const result = await validatePathSafe('src/link.ts', projectRoot)
            expect(path.normalize(result)).toBe(path.normalize(realPath))
        })

        it('should block symlinks pointing outside', async () => {
            const realPath = '/etc/passwd'

            mockLstat.mockResolvedValue({ isSymbolicLink: () => true } as any)
            mockRealpath.mockResolvedValue(realPath)

            await expect(validatePathSafe('src/badlink.ts', projectRoot))
                .rejects.toThrow(SecurityError)
        })

        it('should ignore ENOENT (file not found) for write operations', async () => {
             mockLstat.mockRejectedValue({ code: 'ENOENT' })

             const result = await validatePathSafe('newfile.ts', projectRoot)
             const expected = path.join(projectRoot, 'newfile.ts')
             expect(path.normalize(result)).toBe(path.normalize(expected))
        })
    })
})
