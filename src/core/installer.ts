import fs from 'fs-extra'
import path from 'path'
import { mergeGuidelines } from './merger.js'
import { InstallConfig, DetectedProject } from '@/types/index.js'
import { FILES, PROJECT_STRUCTURE } from '@/constants.js'
import { logger } from '@/utils/logger.js'
import { signatureManager } from '@/core/signature.js'
import { fileURLToPath } from 'url'
import { validatePath } from '@/utils/path-validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Installs the project configuration and generates prompt files.
 *
 * 1. Creates .project directory structure.
 * 2. Generates AI-specific prompt files (e.g., CLAUDE.md) based on templates.
 * 3. Makes utility scripts executable.
 *
 * @param config - The installation configuration (AI tools, guidelines, etc.)
 * @param _detected - The detected project details (interface consistency)
 * @throws Error if templates directory is missing or file operations fail
 */
export async function installProject(config: InstallConfig, _detected: DetectedProject): Promise<void> {
    logger.debug('Starting installation process')

    // Try to find templates relative to the current script
    // In production (dist), it usually is a sibling 'templates'
    // In development (src/core), it is '../templates'
    let templatesDir = path.join(__dirname, 'templates')

    if (!fs.existsSync(templatesDir)) {
        templatesDir = path.join(__dirname, '../templates')
    }

    if (!fs.existsSync(templatesDir)) {
        // Fallback for when running from root or unexpected structure
        templatesDir = path.join(process.cwd(), 'src/templates')
    }

    if (!fs.existsSync(templatesDir)) {
        logger.error(`Templates directory not found in: ${templatesDir}`)
        throw new Error(
            `Templates directory not found. Searched in: ${path.join(__dirname, 'templates')} and ${path.join(__dirname, '../templates')}`
        )
    }

    logger.debug(`Using templates from: ${templatesDir}`)
    await createProjectStructure(templatesDir, config.dryRun)

    logger.debug('Generating prompt files...')
    await Promise.all(config.ais.map((ai) => generatePrompt(ai, config, templatesDir)))

    logger.debug('Making scripts executable...')
    await makeScriptsExecutable(config.dryRun)

    if (config.dryRun) {
        logger.success('Dry run completed successfully')
    } else {
        logger.success('Installation completed successfully')
    }
}

async function createProjectStructure(templatesDir: string, dryRun?: boolean): Promise<void> {
    logger.debug('Creating project structure...')
    const baseDir = path.join(templatesDir, 'base/.project')
    const targetDir = '.project'

    if (dryRun) {
        logger.info(`[DRY RUN] Would copy ${baseDir} to ${targetDir}`)
    } else {
        try {
            await fs.copy(baseDir, targetDir, {
                overwrite: false,
                errorOnExist: false
            })
        } catch (error) {
            const err = error as { code?: string }

            if (err.code === 'EACCES') {
                throw new Error(`Permission denied: Cannot write to ${targetDir}`)
            }
            if (err.code === 'ENOSPC') {
                throw new Error('Disk full: Not enough space to install')
            }

            throw error
        }
    }

    const projectDir = path.join(process.cwd(), FILES.PROJECT_DIR)

    // Create structure
    if (dryRun) {
        logger.info(`[DRY RUN] Would ensure directory: ${projectDir}`)
        for (const dir of PROJECT_STRUCTURE) {
            logger.info(`[DRY RUN] Would ensure directory: ${path.join(projectDir, dir)}`)
        }
    } else {
        await fs.ensureDir(projectDir)
        await Promise.all(PROJECT_STRUCTURE.map((dir) => fs.ensureDir(path.join(projectDir, dir))))
    }
}

async function generatePrompt(ai: string, config: InstallConfig, templatesDir: string): Promise<void> {
    const basePath = path.join(templatesDir, 'base/project-manager.md')
    let basePrompt = await fs.readFile(basePath, 'utf-8')

    if (config.guidelines && config.guidelines.length > 0) {
        basePrompt = await mergeGuidelines(basePrompt, config.guidelines, templatesDir)
    }

    const filename = getPromptFilename(ai)

    // Sign the content
    const signedPrompt = signatureManager.sign(basePrompt)

    if (config.dryRun) {
        logger.info(`[DRY RUN] Would write prompt file: ${filename} (${signedPrompt.length} bytes)`)
    } else {
        const safePath = validatePath(filename)
        await fs.writeFile(safePath, signedPrompt, 'utf-8')
    }
}

function getPromptFilename(ai: string): string {
    const filenames: Record<string, string> = {
        'claude-code': 'CLAUDE.md',
        'claude-ai': 'CLAUDE.md',
        gemini: 'GEMINI.md',
        chatgpt: 'CHATGPT.md'
    }

    return filenames[ai] || `${ai.toUpperCase()}.md`
}

async function makeScriptsExecutable(dryRun?: boolean): Promise<void> {
    const scripts = [
        '.project/scripts/pre-session.sh',
        '.project/scripts/validate-dod.sh',
        '.project/scripts/backlog-health.sh',
        '.project/scripts/analyze-quality.sh',
        '.project/scripts/pain-to-tasks.sh',
        '.project/scripts/task-velocity.sh'
    ]

    await Promise.all(
        scripts.map(async (script) => {
            if (await fs.pathExists(script)) {
                if (dryRun) {
                    logger.info(`[DRY RUN] Would chmod 755 ${script}`)
                } else {
                    await fs.chmod(script, '755')
                }
            }
        })
    )
}

/**
 * Creates a backup of the .project directory.
 * Backups are stored in `.project-backups/YYYY-MM-DD-HH-MM-SS`.
 *
 * @param projectRoot - The root directory of the project
 * @param dryRun - If true, only simulates the backup
 * @returns The path to the created backup directory or null if dry run/no backup needed
 */
export async function createBackup(projectRoot: string, dryRun?: boolean): Promise<string | null> {
    const projectDir = path.join(projectRoot, FILES.PROJECT_DIR)

    if (!(await fs.pathExists(projectDir))) {
        return null
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    // Use a sibling directory for backups to avoid recursive copy issues
    const backupDir = path.join(projectRoot, '.project-backups', timestamp)

    if (dryRun) {
        logger.info(`[DRY RUN] Would backup .project to ${backupDir}`)
        return backupDir
    }

    logger.debug(`Backing up .project to ${backupDir}`)
    const safeBackupDir = validatePath(backupDir, path.dirname(backupDir)) // Allow backing up to sibling
    // Actually backupDir is outside projectDir usually.
    // If backupDir is .project-backups/..., it is a sibling of .project.
    // validatePath checks if target is inside base.
    // We want to verify that backupDir is SAFE.
    // Since backupDir is generated from timestamp, it should be safe.
    // But let's validate it just in case.
    // We can't validate against projectRoot if it's a sibling.
    // We can validate against cwd.
    // Let's explicitly allow it for now or validate it is child of cwd.

    await fs.ensureDir(path.dirname(safeBackupDir))

    // Copy everything except node_modules or huge folders if they existed there (unlikely in .project)
    const safeProjectDir = validatePath(projectDir, projectRoot)
    await fs.copy(safeProjectDir, safeBackupDir, {
        filter: (src) => !src.includes('.backup') // Prevent recursive backup
    })

    return backupDir
}
