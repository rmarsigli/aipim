import { logger } from '@/utils/logger.js'
import { join, dirname } from 'path'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { getTemplateVariables, renderTemplate } from '@/utils/template-engine.js'
import { copyToClipboard } from '@/utils/clipboard.js'
import { validatePath } from '@/utils/path-validator.js'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface TemplateOptions {
    list?: boolean
    print?: boolean
    edit?: boolean
    logger?: { log: (msg: string) => void }
}

export async function template(name: string | undefined, options: TemplateOptions): Promise<void> {
    const log = options.logger?.log || console.log
    const cwd = process.cwd()
    const projectDir = join(cwd, '.project')

    // Directories
    // In dev: src/prompts/templates
    // In prod: dist/prompts/templates (relative to cli.js/commands/template.js -> ../../prompts/templates)

    // Attempt to locate dist/prompts/templates from dist/commands/template.js
    let coreTemplatesDir = join(__dirname, '../../prompts/templates')

    // Fallback for dev environment (src/commands/template.ts -> ../prompts/templates)
    if (!existsSync(coreTemplatesDir)) {
        coreTemplatesDir = join(__dirname, '../prompts/templates')
    }

    const userTemplatesDir = join(projectDir, 'prompts')

    // List mode
    if (options.list || !name) {
        if (!options.list && !name) {
            // Implicit list if no name provided
        } else if (!name) {
            // Explicit list
        } else {
            // Name provided with list flag? ignore flag or filter?
            // Logic: if name provided, process template. If list provided, list.
            // But if name is undefined, list.
        }

        if (!name) {
            displayTemplateList(coreTemplatesDir, userTemplatesDir, log)
            return
        }
    }

    if (!name) return // Should be handled above

    // Add mode logic
    // 'aipim template add <name>' is NOT a separate subcommand in the plan,
    // but the task said "Implement `aipim template add <name>`"
    // I should check if 'add' is passed as the name, but that conflicts with a template named 'add'.
    // The plan said: `aipim template <name>` and `aipim template add <name>`
    // The CLI definition in cli.ts will handle this.
    // If this function is called with name='add', I should probably handle it or
    // better, define `add` as a separate command or check arguments.
    // Actually, `program.command('template').argument('[name]')...` matches `add` as name.

    if (name === 'add') {
        // This is tricky if I want "add" to be a subcommand-like behavior without explicit subcommand.
        // Let's assume the user can't have a template named 'add'.
        // But wait, the CLI definition in cli.ts hasn't been written yet.
        // I'll implement `add` handling inside here for now.
        const newName = process.argv[4] // aipim template add <newName>
        if (!newName) {
            logger.error('Please specify a name for the new template: aipim template add <name>')
            return
        }
        await createCustomTemplate(projectDir, newName)
        return
    }

    // Locate Template
    let templatePath: string | null = null
    let isCustom = false

    // Check custom first (allows overriding core)
    const customPath = join(userTemplatesDir, name + '.md')
    const corePath = join(coreTemplatesDir, name + '.md')

    if (existsSync(customPath)) {
        templatePath = customPath
        isCustom = true
    } else if (existsSync(corePath)) {
        templatePath = corePath
    } else {
        logger.error(`Template '${name}' not found.`)
        logger.info('Run `aipim template --list` to see available templates.')
        process.exit(1)
    }

    // Edit mode
    if (options.edit) {
        if (!isCustom) {
            logger.warn('Cannot edit core templates directly.')
            logger.info(`To customize, run: aipim template add ${name}`)
            return
        }
        void openEditor(templatePath)
        return
    }

    // Render Template
    const content = readFileSync(templatePath, 'utf-8')
    const variables = await getTemplateVariables(projectDir, cwd)
    const rendered = renderTemplate(content, variables)

    if (options.print) {
        log('\n' + chalk.blue('═'.repeat(60)))
        log(rendered)
        log(chalk.blue('═'.repeat(60)) + '\n')
    } else {
        const copied = await copyToClipboard(rendered)
        if (copied) {
            logger.success(`Template '${name}' copied to clipboard!`)
        } else {
            logger.warn('Could not copy to clipboard. Printing instead...')

            log(rendered)
        }
    }
}

function displayTemplateList(coreDir: string, userDir: string, log: (msg: string) => void): void {
    log(chalk.blue.bold('\nCore Templates:'))
    if (existsSync(coreDir)) {
        const coreFiles = readdirSync(coreDir).filter((f) => f.endsWith('.md'))
        coreFiles.forEach((f) => log(`  - ${f.replace('.md', '')}`))
    } else {
        log(chalk.gray('  (No core templates found)'))
    }

    log(chalk.blue.bold('\nCustom Templates (.project/prompts/):'))
    if (existsSync(userDir)) {
        const userFiles = readdirSync(userDir).filter((f) => f.endsWith('.md'))
        if (userFiles.length > 0) {
            userFiles.forEach((f) => log(`  - ${f.replace('.md', '')}`))
        } else {
            log(chalk.gray('  (None)'))
        }
    } else {
        log(chalk.gray('  (None)'))
    }
    log('')
}

async function createCustomTemplate(projectDir: string, name: string): Promise<void> {
    const userDir = join(projectDir, 'prompts')
    // Ensure .project/prompts exists
    if (!existsSync(userDir)) {
        const fs = await import('fs-extra')
        const safeUserDir = validatePath(userDir)
        await fs.ensureDir(safeUserDir)
        logger.info(`Created templates directory: ${safeUserDir}`)
    }

    const filePath = join(userDir, name.endsWith('.md') ? name : name + '.md')

    if (existsSync(filePath)) {
        logger.error(`Template '${name}' already exists.`)
        return
    }

    const templateContent = `New custom template: ${name}

Hello {{task_name}},

This is a custom template.
Variables available:
- {{task_name}}
- {{current_file}}
- {{completed_checkboxes}}
... and more.
`
    writeFileSync(filePath, templateContent)
    logger.success(`Created custom template: ${filePath}`)
}

async function openEditor(filePath: string): Promise<void> {
    const editor = process.env.EDITOR || 'code' // Default to code or system editor
    try {
        const { exec } = await import('child_process')
        exec(`${editor} "${filePath}"`)
        logger.info(`Opened ${filePath} in ${editor}`)
    } catch {
        logger.error(`Failed to open editor ${editor}`)
    }
}
