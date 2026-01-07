import chalk from 'chalk'

export async function update(options: any = {}): Promise<void> {
    console.log(chalk.yellow('\n⚠️  Update command coming in v1.1!\n'))
    console.log('For now, to update:')
    console.log(chalk.gray('  1. Backup your customizations'))
    console.log(chalk.gray('  2. Run: npx ia-project-manager install --yes'))
    console.log(chalk.gray('  3. Restore your customizations\n'))
}
