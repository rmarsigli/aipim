import path from 'path'
import fs from 'fs-extra'

/**
 * Custom error for security violations
 */
export class SecurityError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SecurityError'
    }
}

/**
 * Validates that a path stays within allowed boundaries.
 *
 * @param targetPath - Path to validate
 * @param basePath - Base directory (default: process.cwd())
 * @returns Normalized safe path
 * @throws {SecurityError} If path escapes base directory
 */
export function validatePath(targetPath: string, basePath: string = process.cwd()): string {
    // Resolve absolute paths
    const resolvedBase = path.resolve(basePath)
    const resolvedTarget = path.resolve(resolvedBase, targetPath)

    // Check if target is within base
    // Use path.relative to check for traversal correctly across platforms
    const relative = path.relative(resolvedBase, resolvedTarget)

    if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
        throw new SecurityError(`Path traversal detected: ${targetPath} escapes ${basePath}`)
    }

    return resolvedTarget
}

/**
 * Validates path and checks if it's a symlink pointing outside base.
 *
 * @param targetPath - Path to validate
 * @param basePath - Base directory
 * @returns Normalized safe path
 * @throws {SecurityError} If path is unsafe
 */
export async function validatePathSafe(targetPath: string, basePath: string = process.cwd()): Promise<string> {
    const validPath = validatePath(targetPath, basePath)

    // Check if it's a symlink
    try {
        const stats = await fs.lstat(validPath)
        if (stats.isSymbolicLink()) {
            const realPath = await fs.realpath(validPath)
            // Validate real path also within base
            const resolvedBase = path.resolve(basePath)
            const relative = path.relative(resolvedBase, realPath)

            if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
                throw new SecurityError(`Symlink ${targetPath} points outside project: ${realPath}`)
            }
            return realPath
        }
    } catch (error) {
        const err = error as { code?: string }
        if (err.code !== 'ENOENT') throw error
        // Path doesn't exist yet - that's ok for write operations
    }

    return validPath
}
