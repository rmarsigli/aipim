import fs from 'fs-extra'
import path from 'path'
import { FILES } from '@/constants.js'

import { signatureManager } from './signature.js'
import { fileURLToPath } from 'url'
import { validatePath } from '@/utils/path-validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface TaskConfig {
    type: string
    name: string
}

export class TaskManager {
    /**
     * Initializes a new task in the project backlog.
     *
     * 1. Calculates the next available Task ID.
     * 2. Creates a new task file from the standard template.
     * 3. Updates the backlog index file.
     * 4. Signs the generated files.
     *
     * @param projectRoot - The root directory of the project
     * @param config - Task configuration (type and name)
     * @returns The absolute path to the created task file
     */
    public async initTask(projectRoot: string, config: TaskConfig): Promise<string> {
        const projectDir = path.join(projectRoot, FILES.PROJECT_DIR)
        const backlogDir = path.join(projectDir, 'backlog')
        const templatesDir = this.resolveTemplatesDir()

        await fs.ensureDir(backlogDir)

        // 1. Calculate ID
        const nextId = await this.getNextId(backlogDir)
        const safeName = config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const filename = `TASK-${nextId}-${safeName}.md`
        const filePath = path.join(backlogDir, filename)

        // 2. Create File
        const templatePath = path.join(templatesDir, 'base/.project/_templates/task-template.md')
        let content = ''

        if (await fs.pathExists(templatePath)) {
            content = await fs.readFile(templatePath, 'utf-8')
        } else {
            // Fallback content if template missing
            content = defaultTaskTemplate
        }

        // Replace placeholders
        const date = new Date().toISOString()
        content = content
            .replace(/title: "Task Name"/, `title: "${config.type}: ${config.name}"`) // Frontmatter
            .replace(/# Task: \[Task Name\]/, `# Task: ${config.type}: ${config.name}`) // Header
            .replace(/created: .*/, `created: ${date}`)
            .replace(/last_updated: .*/, `last_updated: ${date}`)

        // Sign it
        const signedContent = signatureManager.sign(content)
        const safeFilePath = validatePath(filePath)
        await fs.writeFile(safeFilePath, signedContent, 'utf-8')

        // 3. Update backlog.md
        await this.updateBacklogIndex(projectRoot, { id: nextId, type: config.type, name: config.name, filename })

        return safeFilePath
    }

    private async getNextId(backlogDir: string): Promise<string> {
        // Ensure dir exists before reading
        if (!(await fs.pathExists(backlogDir))) return '001'

        const files = await fs.readdir(backlogDir)
        // Look for TASK-XXX-
        const ids = files
            .map((f) => {
                const match = f.match(/^TASK-(\d+)-/)
                return match ? parseInt(match[1], 10) : 0
            })
            .sort((a, b) => b - a) // Descending

        const next = (ids[0] || 0) + 1
        return next.toString().padStart(3, '0')
    }

    private async updateBacklogIndex(
        root: string,
        task: { id: string; type: string; name: string; filename: string }
    ): Promise<void> {
        const backlogFile = path.join(root, FILES.PROJECT_DIR, 'backlog.md')

        // Ensure backlog.md exists
        if (!(await fs.pathExists(backlogFile))) {
            await fs.writeFile(
                backlogFile,
                `# Project Backlog\n\n| ID | Type | Task | Status | Priority |\n|----|------|------|--------|----------|\n`
            )
        }

        let content = await fs.readFile(backlogFile, 'utf-8')

        // Append new line
        const line = `| ${task.id} | ${task.type} | [${task.name}](backlog/${task.filename}) | Todo | P2-M |`

        if (content.endsWith('\n')) {
            content += line + '\n'
        } else {
            content += '\n' + line + '\n'
        }

        const signedContent = signatureManager.sign(content)
        const safeBacklogFile = validatePath(backlogFile)
        await fs.writeFile(safeBacklogFile, signedContent, 'utf-8')
    }

    private resolveTemplatesDir(): string {
        let templatesDir = path.join(__dirname, '../templates')
        if (!fs.existsSync(templatesDir)) {
            templatesDir = path.join(__dirname, '../../templates')
        }
        if (!fs.existsSync(templatesDir) || !fs.existsSync(path.join(templatesDir, 'base'))) {
            templatesDir = path.join(process.cwd(), 'src/templates')
        }
        return templatesDir
    }
}

const defaultTaskTemplate = `---
title: "Task Name"
created: 2025-01-01
status: todo
---

# Task: [Task Name]
`

export const taskManager = new TaskManager()
