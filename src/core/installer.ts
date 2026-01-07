import fs from 'fs-extra'
import path from 'path'
import { mergeGuidelines } from './merger'
import { InstallConfig, DetectedProject } from '@/types'

export async function installProject(config: InstallConfig, detected: DetectedProject): Promise<void> {
    const templatesDir = path.join(__dirname, '../templates')

    await createProjectStructure(templatesDir)

    for (const ai of config.ais) {
        await generatePrompt(ai, config, templatesDir)
    }

    await makeScriptsExecutable()
}

async function createProjectStructure(templatesDir: string): Promise<void> {
    const baseDir = path.join(templatesDir, 'base/.project')
    const targetDir = '.project'

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

    const dirs = [
        'backlog',
        'completed',
        'decisions',
        'docs',
        'ideas',
        'reports'
    ]

    for (const dir of dirs) {
        await fs.ensureDir(path.join(targetDir, dir))
    }
}

async function generatePrompt(ai: string, config: InstallConfig, templatesDir: string): Promise<void> {
    const basePath = path.join(templatesDir, 'base/project-manager.md')
    let basePrompt = await fs.readFile(basePath, 'utf-8')
    
    if (config.guidelines && config.guidelines.length > 0) {
        basePrompt = await mergeGuidelines(basePrompt, config.guidelines, templatesDir)
    }

    const filename = getPromptFilename(ai)

    await fs.writeFile(filename, basePrompt, 'utf-8')
}

function getPromptFilename(ai: string): string {
    const filenames: Record<string, string> = {
        'claude-code': 'CLAUDE.md',
        'claude-ai': 'CLAUDE.md',
        'gemini': 'GEMINI.md',
        'chatgpt': 'CHATGPT.md'
    }

    return filenames[ai] || `${ai.toUpperCase()}.md`
}

async function makeScriptsExecutable(): Promise<void> {
    const scripts = [
        '.project/scripts/pre-session.sh',
        '.project/scripts/validate-dod.sh'
    ]

    for (const script of scripts) {
        if (await fs.pathExists(script)) {
            await fs.chmod(script, '755')
        }
    }
}
