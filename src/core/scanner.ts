import fs from 'fs-extra'
import path from 'path'
import { signatureManager, FileStatus } from './signature.js'
import { FILES } from '@/constants.js'

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
        // We typically check CLAUDE.md, GEMINI.md, etc., plus core .project docs
        const targets = filesToScan || [
            'CLAUDE.md',
            'GEMINI.md',
            'CHATGPT.md',
            ...['backlog.md', 'decisions.md', 'completed.md'].map((f) => path.join(FILES.PROJECT_DIR, f))
        ]

        const tasks = targets.map(async (relativePath) => {
            const absolutePath = path.join(projectRoot, relativePath)
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
