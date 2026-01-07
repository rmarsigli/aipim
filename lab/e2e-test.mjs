/**
 * AIPM E2E Test Suite
 * Run with: node lab/e2e-test.mjs
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.join(__dirname)

const CLI = path.join(__dirname, '../dist/cli.js')
const TEMP_DIR = path.join(root, 'test-project')

function run(cmd, cwd = TEMP_DIR) {
    try {
        console.log(`> ${cmd}`)
        return execSync(cmd, { cwd, studio: 'inherit', encoding: 'utf-8' })
    } catch (e) {
        console.error(`Command failed: ${cmd}`)
        console.error(e.stdout || e.message)
        throw e
    }
}

function assert(condition, msg) {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`)
    }
    console.log(`✔ ${msg}`)
}

async function main() {
    console.log('Starting E2E Tests...')
    
    // Cleanup
    if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEMP_DIR)

    // 1. Install
    console.log('\n--- Test 1: Install ---')
    run(`node ${CLI} install --ai claude-code --yes`, TEMP_DIR)
    assert(fs.existsSync(path.join(TEMP_DIR, '.project')), '.project created')
    assert(fs.existsSync(path.join(TEMP_DIR, 'CLAUDE.md')), 'CLAUDE.md created')

    // 2. Doctor (Pass)
    console.log('\n--- Test 2: Doctor (Pass) ---')
    const doctorOut = run(`node ${CLI} validate`, TEMP_DIR)
    assert(doctorOut.includes('All checks passed'), 'Doctor passed')

    // 3. Task Init
    console.log('\n--- Test 3: Task Init ---')
    run(`node ${CLI} task init feat "Login System"`, TEMP_DIR)
    const backlogFiles = fs.readdirSync(path.join(TEMP_DIR, '.project/backlog'))
    const taskFile = backlogFiles.find(f => f.startsWith('TASK-001'))
    assert(!!taskFile, 'Task 001 created')
    const backlogContent = fs.readFileSync(path.join(TEMP_DIR, '.project/backlog.md'), 'utf-8')
    assert(backlogContent.includes('Login System'), 'Backlog index updated')

    // 4. Modify File (Signature Check)
    console.log('\n--- Test 4: Modify File & Update ---')
    const claudePath = path.join(TEMP_DIR, 'CLAUDE.md')
    const originalClaude = fs.readFileSync(claudePath, 'utf-8')
    fs.writeFileSync(claudePath, originalClaude + '\n# Customization', 'utf-8')
    
    // Run Update
    // Run Update (Must provide config checks to avoid prompts)
    run(`node ${CLI} update --force --ai claude-code`, TEMP_DIR)
    // Wait, UpdateOptions.force? 
    // In strict mode, `force` might imply overwrite, but our current logic maps `force` -> `yes` (skip confirmation).
    // The Updater logic: checks status. If modified -> skip.
    // Unless we strictly passed `force` to Updater? 
    // In `update.ts`, `yes: options.yes || options.force`. 
    // So it skips confirmation. But `Updater.update` doesn't take "overwriteModified" option yet?
    // Let's check `updater.ts`. It iterates scanner results.
    // If status === 'modified', it logs reason and returns 'skipped'.
    // So it should PRESERVE.

    const newClaude = fs.readFileSync(claudePath, 'utf-8')
    assert(newClaude.includes('# Customization'), 'Custom content preserved')
    
    // 5. Doctor (Warn)
    console.log('\n--- Test 5: Doctor (Modified) ---')
    const doctorOut2 = run(`node ${CLI} validate`, TEMP_DIR)
    console.log('Doctor Output:', doctorOut2) // Debug
    // Doctor passes even with modified files, but status says "Valid structure (X user customizations found)"
    assert(doctorOut2.includes('user customizations found'), 'Doctor detects customization')

    // 6. Backup Check
    console.log('\n--- Test 6: Backup ---')
    const backupsDir = path.join(TEMP_DIR, '.project-backups')
    assert(fs.existsSync(backupsDir), 'Backup directory created')

    console.log('\n✨ All E2E Tests Passed!')
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
