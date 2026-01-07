import ora from 'ora'
import chalk from 'chalk'
import { detectProject } from '@/core/detector'
import { installProject } from '@/core/installer'
import { promptConfiguration } from '@/prompts/install'
import { InstallConfig } from '@/types'

export async function install(options: any = {}): Promise<void> {
    try {
        const spinner = ora('Detecting project...').start()
        const detected = await detectProject()
        spinner.succeed('Project detected')
        
        if (detected.framework) {
            console.log(chalk.gray(`   ✓ Found: ${detected.framework} project`))
        }
        if (detected.hasGit) {
            console.log(chalk.gray('   ✓ Git repository: Yes'))
        }
        if (detected.packageManager) {
            console.log(chalk.gray(`   ✓ Package manager: ${detected.packageManager}`))
        }
        
        let config: InstallConfig | null
        
        if (options.preset) {
            console.log(chalk.yellow('\n⚠️  Preset feature coming soon, using interactive mode\n'))
            config = await promptConfiguration(detected, options)
        } else if (options.ai && options.guidelines) {
            config = {
                ais: Array.isArray(options.ai) ? options.ai : [options.ai],
                guidelines: Array.isArray(options.guidelines) ? options.guidelines : [options.guidelines],
                version: options.full ? 'full' : 'compact',
                skipConfirmation: options.yes || false
            }
        } else {
            config = await promptConfiguration(detected, options)
        }
        
        if (!config) {
            console.log(chalk.red('\n❌ Installation cancelled\n'))
            return
        }
        
        spinner.start('Installing...')
        
        await installProject(config, detected)
        
        spinner.succeed('Installation complete!')
        
        console.log(chalk.green('\n🎉 Installation complete!\n'))
        console.log('Next steps:')
        console.log(chalk.gray('  1. Run: .project/scripts/pre-session.sh'))
        console.log(chalk.gray('  2. Create first task: cp .project/_templates/v1/task-template.md .project/current-task.md'))
        console.log(chalk.gray('  3. Start coding with AI!\n'))
        
        if (config.ais.includes('claude-code') || config.ais.includes('claude-ai')) {
            console.log(chalk.blue('📚 Start your AI session with:'))
            console.log(chalk.blue('   "Follow session start protocol and continue development"\n'))
        }
        
    } catch (error) {
        throw error
    }
}
