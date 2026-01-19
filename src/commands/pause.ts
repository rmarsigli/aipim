import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { confirm } from '@inquirer/prompts'
import { git } from '@/utils/git.js'

export const pause = new Command()
    .name('pause')
    .description('Pause the current session and save context due to interruption')
    .requiredOption('-r, --reason <reason>', 'Reason for the interruption')
    .action(async (options: { reason: string }) => {
        const { reason } = options
        const projectDir = process.cwd()
        const projectConfigDir = path.join(projectDir, '.project')
        const currentTaskFile = path.join(projectConfigDir, 'current-task.md')
        const snapshotFile = path.join(projectConfigDir, '.interruption-snapshot.json')

        /* eslint-disable no-console */
        console.log(`\n📎 Pausing session due to: "${reason}"\n`)

        try {
            // 1. Capture Git Status
            const gitStatus = await git(['status', '--porcelain'])
            const isDirty = gitStatus.length > 0

            // 2. Capture Current Task Info
            let currentTask = 'Unknown'
            if (fs.existsSync(currentTaskFile)) {
                const content = fs.readFileSync(currentTaskFile, 'utf-8')
                // Simple regex to get title
                const titleMatch = content.match(/title: "(.*?)"/)
                if (titleMatch) currentTask = titleMatch[1]
            }

            // 3. Prepare Snapshot
            const snapshot = {
                timestamp: new Date().toISOString(),
                reason,
                task: {
                    title: currentTask
                },
                git: {
                    is_dirty: isDirty,
                    stash_hash: null as string | null
                }
            }

            // 4. Stash logic
            if (isDirty) {
                const stash = await confirm({
                    message: 'You have uncommitted changes. Stash them?',
                    default: true
                })

                if (stash) {
                    console.log('🔄 Stashing changes...')
                    console.log('🔄 Stashing changes...')
                    await git(['stash', 'push', '-m', `Paused: ${reason}`])
                    snapshot.git.stash_hash = 'latest'
                    console.log('✅ Changes stashed.')
                }
            }

            // 5. Save Snapshot
            fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2))
            console.log(`✅ Snapshot saved to ${snapshotFile}`)
            console.log(`\n⏸️  Session paused. Run 'aipim resume' when you return.\n`)
        } catch (error) {
            console.error('❌ Error pausing session:', error)
        }
        /* eslint-enable no-console */
    })
