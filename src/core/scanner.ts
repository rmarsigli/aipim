import fs from 'fs-extra'
import path from 'path'
import { signatureManager, FileStatus } from './signature.js'
import { validatePath } from '@/utils/path-validator.js'

export interface FileScanResult {
    path: string
    relativePath: string
    status: FileStatus
}

export class ProjectScanner {
    /**
     * Scans the project directory and classifies specific files.
     * Verifies file integrity using signatures and identifies missing or legacy files.
     *
     * @param projectRoot - The root of the project (typically containing package.json)
     * @param filesToScan - List of relative paths to scan (optional, defaults to standard AIPIM files)
     * @returns Array of scan results including validity status
     */
    public async scan(projectRoot: string, filesToScan?: string[]): Promise<FileScanResult[]> {
        const results: FileScanResult[] = []

        // Define default files to check if not provided
        // We typically check CLAUDE.md, GEMINI.md, and nested AI guidelines (e.g. .ai/guidelines/aipim.blade.php)
        // .project/ files are created on-demand by commands, not tracked by updater
        const targets = filesToScan || ['CLAUDE.md', 'GEMINI.md', '.ai/guidelines/aipim.blade.php']

        const tasks = targets.map(async (relativePath) => {
            let absolutePath = path.join(projectRoot, relativePath)
            try {
                absolutePath = validatePath(absolutePath, projectRoot)
            } catch {
                // Path validation failed (likely path traversal attempt)
                // Treat as missing/invalid and return safe result
                return {
                    path: path.join(projectRoot, relativePath),
                    relativePath,
                    status: 'missing' as FileStatus
                }
            }

            let status: FileStatus = 'missing'

            if (await fs.pathExists(absolutePath)) {
                try {
                    const content = await fs.readFile(absolutePath, 'utf-8')
                    status = signatureManager.verify(content)
                } catch {
                    status = 'legacy'
                }
            }

            return {
                path: absolutePath,
                relativePath,
                status
            }
        })

        results.push(...(await Promise.all(tasks)))

        return results
    }
}

export const projectScanner = new ProjectScanner()
