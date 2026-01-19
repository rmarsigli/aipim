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
     * @param projectRoot The root of the project (where node_modules/package.json usually are)
     * @param filesToScan List of relative paths to scan (optional, defaults to standard AIPIM files)
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

        for (const relativePath of targets) {
            const absolutePath = path.join(projectRoot, relativePath)
            let status: FileStatus = 'missing'

            if (await fs.pathExists(absolutePath)) {
                try {
                    const content = await fs.readFile(absolutePath, 'utf-8')
                    status = signatureManager.verify(content)
                } catch {
                    // treat read errors as missing or specific error?
                    // For now, if we can't read, we can't verify, treating as legacy/unknown might be safer
                    // but 'missing' is technically wrong if it exists.
                    // Let's assume 'legacy' for unreadable/binary edge cases to avoid overwrite.
                    status = 'legacy'
                }
            }

            results.push({
                path: absolutePath,
                relativePath,
                status
            })
        }

        return results
    }
}

export const projectScanner = new ProjectScanner()
