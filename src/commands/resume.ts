import { logger } from '@/utils/logger.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { confirm } from '@inquirer/prompts'
import { start } from './start.js'
import { parseContext, parseTask, calculateProgress, extractCheckpoints, extractObjective } from '@/utils/context.js'

export interface ResumeOptions {
    auto?: boolean
    verbose?: boolean
}

export async function resume(options: ResumeOptions = {}): Promise<void> {
    const cwd = process.cwd()
    const projectDir = join(cwd, '.project')

    // Check if .project exists
    if (!existsSync(projectDir)) {
        logger.error('No .project directory found. Run `aipim install` first.')
        process.exit(1)
    }

    const snapshotPath = join(projectDir, '.interruption-snapshot.json')

    // Check for interruption snapshot first
    if (existsSync(snapshotPath)) {
        try {
            const snapshotContent = readFileSync(snapshotPath, 'utf-8')
            interface Snapshot {
                timestamp: string | number | Date
                reason: string
                task?: {
                    title: string
                }
                git?: {
                    is_dirty: boolean
                    stash_hash?: string
                }
            }

            const snapshot = JSON.parse(snapshotContent) as Snapshot

            // Show interruption banner
            /* eslint-disable no-console */
            console.log('')
            console.log(chalk.red('📎 Interruption Detected'))
            console.log(chalk.gray(`   Paused: ${new Date(snapshot.timestamp).toLocaleString()}`))
            console.log(chalk.gray(`   Reason: ${snapshot.reason}`))
            console.log('')

            console.log(chalk.bold('🎯 Context at pause:'))
            console.log(`   Task: ${snapshot.task?.title || 'Unknown'}`)

            if (snapshot.git?.is_dirty) {
                console.log(chalk.yellow('   ⚠️  Uncommitted changes were detected.'))
                if (snapshot.git.stash_hash) {
                    console.log(chalk.green('      (Stashed automatically)'))
                }
            }
            console.log('')
            /* eslint-enable no-console */

            const action = await confirm({
                message: 'Restore interrupted session?',
                default: true
            })

            if (action) {
                // Restore logic
                if (snapshot.git?.stash_hash) {
                    /* eslint-disable no-console */
                    console.log('🔄 Restoring stashed changes...')
                    try {
                        execSync('git stash pop')
                        console.log('✅ Changes restored.')
                    } catch (e) {
                        console.error(
                            chalk.red(
                                `❌ Failed to pop stash. You may need to resolve conflicts manually. (${String(e)})`
                            )
                        )
                    }
                    /* eslint-enable no-console */
                }

                // Remove snapshot
                execSync(`rm ${snapshotPath}`)

                /* eslint-disable-next-line no-console */
                console.log(chalk.green('\n✅ Context restored. Resuming work...'))
                await start({ print: false })
                return
            } else {
                /* eslint-disable-next-line no-console */
                console.log(chalk.gray('Discarding snapshot...'))
                execSync(`rm ${snapshotPath}`)
            }
        } catch (e) {
            console.error('Error reading snapshot:', e)
        }
    }

    const resumeData = generateResumeSummary(projectDir, cwd)

    // Display summary
    displayResumeSummary(resumeData)

    // Interactive continuation
    if (!options.auto) {
        const answer = await confirm({
            message: 'Ready to continue?',
            default: true
        })

        if (answer) {
            /* eslint-disable no-console */
            console.log('')
            /* eslint-enable no-console */
            await start({ print: false })
        } else {
            /* eslint-disable no-console */
            console.log('')
            console.log(chalk.gray('Run `aipim start` when ready to continue.'))
            console.log('')
            /* eslint-enable no-console */
        }
    } else {
        // Auto mode: go straight to start
        await start({ print: false })
    }
}

interface ResumeSummary {
    sessionAge: {
        text: string
        indicator: string
        hours: number
    }
    task: {
        title: string
        phase: string | null
        estimatedHours: string
        progress: {
            completed: number
            total: number
            percentage: number
        }
        lastCompleted: string[]
        currentItem: string | null
        nextItem: string | null
        objective: string
    } | null
    nextAction: string
    lastCommit: {
        hash: string
        message: string
    } | null
    status: 'active' | 'no-task' | 'completed' | 'fresh'
}

function generateResumeSummary(projectDir: string, cwd: string): ResumeSummary {
    // Parse context.md
    const contextPath = join(projectDir, 'context.md')
    let lastUpdated = new Date()
    let nextAction = 'Not specified'

    if (existsSync(contextPath)) {
        const context = readFileSync(contextPath, 'utf-8')
        const { frontmatter } = parseContext(context)
        if (frontmatter.last_updated) {
            lastUpdated = new Date(frontmatter.last_updated as string)
        }
        nextAction = (frontmatter.next_action as string) || 'Not specified'
    }

    const sessionAge = formatSessionAge(lastUpdated)

    // Parse current task
    const taskPath = join(projectDir, 'current-task.md')
    let taskData: ResumeSummary['task'] = null
    let status: ResumeSummary['status'] = 'no-task'

    if (existsSync(taskPath)) {
        const taskContent = readFileSync(taskPath, 'utf-8')
        const task = parseTask(taskContent)

        if (task.status === 'completed') {
            status = 'completed'
        } else if (task.status === 'in-progress') {
            status = 'active'
        }

        const progress = calculateProgress(taskContent)
        const checkpoints = extractCheckpoints(taskContent)

        taskData = {
            title: task.title,
            phase: task.currentPhase,
            estimatedHours: task.estimated_hours,
            progress,
            lastCompleted: checkpoints.lastCompleted,
            currentItem: checkpoints.current,
            nextItem: checkpoints.next,
            objective: extractObjective(taskContent)
        }
    } else {
        status = 'no-task'
    }

    // Get last commit
    let lastCommit: ResumeSummary['lastCommit'] = null
    try {
        const output = execSync('git log -1 --pretty=format:"%h||%s"', {
            cwd,
            encoding: 'utf-8'
        })
        if (output.trim()) {
            const [hash, ...rest] = output.split('||')
            lastCommit = { hash, message: rest.join('||') }
        }
    } catch {
        // No git or no commits
    }

    // Determine status
    if (sessionAge.hours < 1) {
        status = 'fresh'
    }

    return {
        sessionAge,
        task: taskData,
        nextAction,
        lastCommit,
        status
    }
}

function displayResumeSummary(data: ResumeSummary): void {
    /* eslint-disable no-console */
    console.log('')
    console.log(chalk.blue('═'.repeat(60)))
    console.log(chalk.blue.bold('  AIPIM SESSION RESUME'))
    console.log(chalk.blue('═'.repeat(60)))
    console.log('')

    // Session age
    console.log(`${data.sessionAge.indicator} Last Session: ${chalk.bold(data.sessionAge.text)}`)
    console.log('')

    // Handle different statuses
    if (data.status === 'fresh') {
        console.log(chalk.green('[FRESH] Fresh! You just stopped working.'))
        console.log('')
    }

    if (data.status === 'no-task') {
        console.log(chalk.yellow('[WARN] No active task'))
        console.log(chalk.gray('  Run `aipim task list` to see available tasks'))
        console.log('')
        if (data.lastCommit) {
            console.log(`Last commit: ${chalk.cyan(data.lastCommit.hash)} "${data.lastCommit.message}"`)
        }
        console.log(chalk.blue('═'.repeat(60)))
        return
    }

    if (data.status === 'completed') {
        console.log(chalk.green('[DONE] Task completed!'))
        console.log(chalk.gray('  Choose your next task from the backlog'))
        console.log('')
        if (data.lastCommit) {
            console.log(`Last commit: ${chalk.cyan(data.lastCommit.hash)} "${data.lastCommit.message}"`)
        }
        console.log(chalk.blue('═'.repeat(60)))

        return
    }

    // Active task
    if (data.task) {
        console.log(chalk.bold('You were working on:'), chalk.cyan(data.task.title))
        if (data.task.phase) {
            console.log(chalk.gray(`   ${data.task.phase} (${data.task.estimatedHours}h estimated)`))
        }
        console.log(
            chalk.gray(
                `   Progress: ${data.task.progress.completed}/${data.task.progress.total} checkboxes (${data.task.progress.percentage}%)`
            )
        )
        console.log('')

        // Checkpoints
        console.log(chalk.bold('You stopped at:'))
        if (data.task.lastCompleted.length > 0) {
            data.task.lastCompleted.forEach((item) => {
                console.log(chalk.green(`   [x] ${item}`))
            })
        }
        if (data.task.currentItem) {
            console.log(chalk.yellow(`   >> Working on: ${data.task.currentItem}`))
        }
        if (data.task.nextItem) {
            console.log(chalk.gray(`   -- Next: ${data.task.nextItem}`))
        }
        console.log('')

        // Context
        if (data.task.objective) {
            console.log(chalk.bold('Quick context:'))
            console.log(chalk.gray(`   ${data.task.objective}`))
            console.log('')
        }

        // Suggestion
        console.log(chalk.bold('Suggested next action:'))
        console.log(chalk.gray(`   ${data.nextAction}`))
        console.log('')
    }

    // Last commit
    if (data.lastCommit) {
        console.log(`Last commit: ${chalk.cyan(data.lastCommit.hash)} "${data.lastCommit.message}"`)
        console.log('')
    }

    console.log(chalk.blue('═'.repeat(60)))
    console.log('')
    /* eslint-enable no-console */
}

function formatSessionAge(lastUpdated: Date): { text: string; indicator: string; hours: number } {
    const now = new Date()
    const diffMs = now.getTime() - lastUpdated.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    let text = ''
    let indicator = ''

    if (diffHours < 1) {
        text = 'less than an hour ago'
        indicator = chalk.green('●')
    } else if (diffHours < 2) {
        text = `${diffHours} hour ago`
        indicator = chalk.green('●')
    } else if (diffHours < 24) {
        text = `${diffHours} hours ago`
        indicator = chalk.yellow('●')
    } else if (diffDays === 1) {
        text = '1 day ago'
        indicator = chalk.yellow('●')
    } else if (diffDays < 7) {
        text = `${diffDays} days ago`
        indicator = chalk.yellow('●')
    } else {
        text = `${diffDays} days ago [!] It's been a while!`
        indicator = chalk.red('●')
    }

    return { text, indicator, hours: diffHours }
}
