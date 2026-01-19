import { logger } from '@/utils/logger.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { FILES } from '@/constants.js'
import {
    getProjectName,
    getCurrentBranch,
    getRecentCommits,
    getRecentDecisions,
    parseContext,
    parseTask
} from '@/utils/context.js'
import { copyToClipboard } from '@/utils/clipboard.js'
import { validatePath } from '@/utils/path-validator.js'

export interface StartOptions {
    print?: boolean
    file?: string
    full?: boolean
    verbose?: boolean
    logger?: { log: (msg: string) => void }
    copy?: boolean
}

export async function start(options: StartOptions = {}): Promise<void> {
    const log = options.logger?.log || console.log
    const cwd = process.cwd()
    const projectDir = join(cwd, '.project')

    // Check if .project exists
    if (!existsSync(projectDir)) {
        logger.error('No .project directory found. Run `aipim install` first.')
        process.exit(1)
    }

    logger.info('Generating session prompt...')

    const prompt = await generateSessionPrompt(projectDir, cwd, options)

    if (options.print) {
        // Print mode

        log('\n' + chalk.blue('═'.repeat(60)))
        log(chalk.blue.bold('  AIPIM SESSION PROMPT'))
        log(chalk.blue('═'.repeat(60)) + '\n')
        log(prompt)
        log('\n' + chalk.blue('═'.repeat(60)))
        log(chalk.gray('Copy the prompt above and paste into your AI chat.'))
        log(chalk.blue('═'.repeat(60)) + '\n')
    } else if (options.file) {
        // File mode
        const fs = await import('fs-extra')
        const safePath = validatePath(options.file)
        await fs.writeFile(safePath, prompt)
        logger.success(`Session prompt saved to: ${safePath}`)
    } else if (options.copy) {
        // Clipboard mode (try to copy, fallback to print)
        const copied = await copyToClipboard(prompt)
        if (copied) {
            log('')
            log(chalk.green('[OK]') + ' Session prompt copied to clipboard!')
            log('')
            log(chalk.gray('Next steps:'))
            log(chalk.gray('  1. Open your AI chat (Claude.ai, Gemini, ChatGPT)'))
            log(chalk.gray('  2. Paste with Ctrl+V (or Cmd+V on Mac)'))
            log(chalk.gray('  3. Start developing!'))
            log('')
        } else {
            logger.warn('Could not copy to clipboard. Printing instead...')
            // Fallback to print mode
            await start({ ...options, print: true })
        }
    }
}

async function generateSessionPrompt(projectDir: string, cwd: string, options: StartOptions): Promise<string> {
    const parts: string[] = []

    // Header
    const projectName = getProjectName(cwd)
    const timestamp = new Date().toISOString().split('T')[0]
    parts.push(`# AIPIM Development Session - ${timestamp}`)
    parts.push('')
    parts.push(`## Project: ${projectName}`)
    parts.push('')

    // Context.md
    const contextPath = join(projectDir, FILES.CONTEXT_FILE)
    if (existsSync(contextPath)) {
        const context = readFileSync(contextPath, 'utf-8')
        const { frontmatter, currentState, nextAction } = parseContext(context)

        const activeBranches = Array.isArray(frontmatter.active_branches)
            ? (frontmatter.active_branches as string[])
            : []

        parts.push(`**Session:** ${String(frontmatter.session) || 'N/A'}`)
        parts.push(`**Branch:** ${activeBranches[0] || (await getCurrentBranch(cwd))}`)
        parts.push(`**Next Action:** ${nextAction || 'Not specified'}`)
        parts.push('')

        parts.push('## Current State')
        parts.push('')
        parts.push(currentState || 'No context available.')
        parts.push('')
    } else {
        logger.warn(`No ${FILES.CONTEXT_FILE} found`)
        parts.push(`**Status:** No ${FILES.CONTEXT_FILE} found (run after first session)`)
        parts.push('')
    }

    // Current task
    const taskPath = join(projectDir, FILES.CURRENT_TASK_FILE)
    if (existsSync(taskPath)) {
        const task = readFileSync(taskPath, 'utf-8')
        const taskInfo = parseTask(task)

        parts.push('## Active Task')
        parts.push('')
        parts.push(`**${taskInfo.title}** (${taskInfo.estimated_hours}h estimated)`)
        parts.push('')
        if (taskInfo.status === 'in-progress') {
            parts.push(`Status: In Progress (${taskInfo.actual_hours}h actual)`)
            if (taskInfo.currentPhase) {
                parts.push(`Current Phase: ${taskInfo.currentPhase}`)
            }
        }
        parts.push('')
    } else {
        parts.push('## Active Task')
        parts.push('')
        parts.push('**None** - No current task')
        parts.push('')
        parts.push('Available tasks in backlog/')
        parts.push('')
    }

    // Recent commits
    const commits = await getRecentCommits(cwd, options.full ? 10 : 3)
    if (commits.length > 0) {
        parts.push('## Recent Commits')
        parts.push('')
        commits.forEach((commit: { hash: string; message: string }, i: number) => {
            parts.push(`${i + 1}. \`${commit.hash}\` ${commit.message}`)
        })
        parts.push('')
    }

    // Recent decisions
    const decisions = getRecentDecisions(projectDir, options.full ? 5 : 1)
    if (decisions.length > 0) {
        parts.push('## Recent Decisions')
        parts.push('')
        decisions.forEach((decision) => {
            parts.push(`**${decision.file}:** ${decision.title}`)
        })
        parts.push('')
    }

    // Footer
    parts.push('---')
    parts.push('')
    parts.push("**I'm ready to continue development. Please:**")
    parts.push('1. Confirm you understand the project state')
    parts.push('2. Suggest the next immediate step')
    parts.push('')

    return parts.join('\n')
}
