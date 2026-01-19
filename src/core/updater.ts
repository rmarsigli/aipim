import { projectScanner, FileScanResult } from './scanner.js'
import { createBackup } from './installer.js'
import { signatureManager } from './signature.js'
import { mergeGuidelines } from './merger.js'
import { logger } from '@/utils/logger.js'
import { InstallConfig } from '@/types/index.js'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { validatePath } from '@/utils/path-validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface UpdateResult {
    file: string
    status: 'updated' | 'created' | 'skipped' | 'error'
    reason?: string
}

export class Updater {
    /**
     * Performs a safe update of the project.
     */
    public async update(projectRoot: string, config: InstallConfig): Promise<UpdateResult[]> {
        logger.info('Analyzing project state...')

        // 1. Scan current state
        const scanResults = await projectScanner.scan(projectRoot)
        const results: UpdateResult[] = []

        // 2. Create Backup
        try {
            const backupPath = await createBackup(projectRoot, config.dryRun)
            if (backupPath) {
                logger.success(`Backup created at: ${backupPath}`)
            }
        } catch (error) {
            logger.error('Failed to create backup. Aborting update for safety.')
            throw error
        }

        // 3. Resolve Templates Directory (similar to installer)
        const templatesDir = this.resolveTemplatesDir()

        // 4. Plan and Apply Updates
        for (const scan of scanResults) {
            const result = await this.updateFile(scan, config, templatesDir)
            results.push(result)
        }

        return results
    }

    private async updateFile(scan: FileScanResult, config: InstallConfig, templatesDir: string): Promise<UpdateResult> {
        // Determine template source based on relative path
        // Currently we map CLAUDE.md -> base/project-manager.md (merged)
        // And we map .project/* -> base/.project/*
        // This mapping logic needs to be robust. For now, let's focus on CLAUDE.md/AI Prompts

        if (config.dryRun) {
            logger.info(`[DRY RUN] Processing ${scan.relativePath} (Status: ${scan.status})`)
        }

        if (scan.status === 'modified' || scan.status === 'legacy') {
            logger.warn(`Skipping user-modified file: ${scan.relativePath}`)
            return { file: scan.relativePath, status: 'skipped', reason: 'User modified' }
        }

        // Logic to get new content...
        // This is the tricky part: we need to generate what the content *should* be.
        // We reuse installer logic here.
        let newContent = ''

        try {
            if (this.isPromptFile(scan.relativePath)) {
                newContent = await this.generatePromptContent(config, templatesDir)
            } else {
                // It's a static file from .project
                const sourcePath = path.join(templatesDir, 'base', scan.relativePath)
                if (await fs.pathExists(sourcePath)) {
                    newContent = await fs.readFile(sourcePath, 'utf-8')
                } else {
                    return { file: scan.relativePath, status: 'skipped', reason: 'Source template not found' }
                }
            }

            // Sign the new content
            const signedContent = signatureManager.sign(newContent)

            if (!config.dryRun) {
                const safeScanPath = validatePath(scan.path)
                await fs.ensureDir(path.dirname(safeScanPath))
                await fs.writeFile(safeScanPath, signedContent, 'utf-8')
            }

            return {
                file: scan.relativePath,
                status: scan.status === 'missing' ? 'created' : 'updated'
            }
        } catch (error) {
            return { file: scan.relativePath, status: 'error', reason: (error as Error).message }
        }
    }

    private isPromptFile(filename: string): boolean {
        return ['CLAUDE.md', 'GEMINI.md', 'CHATGPT.md'].includes(filename)
    }

    private async generatePromptContent(config: InstallConfig, templatesDir: string): Promise<string> {
        const basePath = path.join(templatesDir, 'base/project-manager.md')
        let basePrompt = await fs.readFile(basePath, 'utf-8')

        if (config.guidelines && config.guidelines.length > 0) {
            basePrompt = await mergeGuidelines(basePrompt, config.guidelines, templatesDir)
        }
        return basePrompt
    }

    private resolveTemplatesDir(): string {
        let templatesDir = path.join(__dirname, 'templates')
        if (!fs.existsSync(templatesDir)) templatesDir = path.join(__dirname, '../templates')
        if (!fs.existsSync(templatesDir)) templatesDir = path.join(process.cwd(), 'src/templates')
        return templatesDir
    }
}

export const updater = new Updater()
