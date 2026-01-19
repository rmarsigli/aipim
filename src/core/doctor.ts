import fs from 'fs-extra'
import path from 'path'
import { FILES, PROJECT_STRUCTURE } from '@/constants.js'
import { logger } from '@/utils/logger.js'
import { validatePath } from '@/utils/path-validator.js'
import { projectScanner } from './scanner.js'

export interface CheckResult {
    id: string
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
}

export class Doctor {
    public async diagnose(projectRoot: string): Promise<CheckResult[]> {
        const results: CheckResult[] = []

        // 1. Check Project Structure
        results.push(await this.checkStructure(path.join(projectRoot, FILES.PROJECT_DIR)))

        // 2. Check Permissions (Scripts)
        results.push(...(await this.checkPermissions(projectRoot)))

        // 3. Check Template Integrity
        results.push(await this.checkIntegrity(projectRoot))

        return results
    }

    public async checkStructure(projectDir: string): Promise<CheckResult> {
        const safeProjectDir = validatePath(projectDir)
        if (!(await fs.pathExists(safeProjectDir))) {
            logger.error(`Project directory not found: ${safeProjectDir}`)
            return { id: 'structure', name: 'Project Structure', status: 'fail', message: '.project directory missing' }
        }

        const missing = []
        for (const dir of PROJECT_STRUCTURE) {
            if (!(await fs.pathExists(path.join(safeProjectDir, dir)))) {
                missing.push(dir)
            }
        }

        if (missing.length > 0) {
            return {
                id: 'structure',
                name: 'Project Structure',
                status: 'warn',
                message: `Missing directories: ${missing.join(', ')}`
            }
        }

        return { id: 'structure', name: 'Project Structure', status: 'pass', message: 'Directory structure is valid' }
    }

    private async checkPermissions(root: string): Promise<CheckResult[]> {
        const scripts = ['pre-session.sh', 'validate-dod.sh']
        const results: CheckResult[] = []

        if (process.platform === 'win32') {
            results.push({
                id: 'permissions',
                name: 'Script Permissions',
                status: 'pass',
                message: 'Skipped execution check on Windows'
            })
            return results
        }

        for (const script of scripts) {
            const scriptPath = path.join(root, FILES.PROJECT_DIR, 'scripts', script)
            if (await fs.pathExists(scriptPath)) {
                const stats = await fs.stat(scriptPath)
                const isExecutable = !!(stats.mode & 0o111)

                if (!isExecutable) {
                    results.push({
                        id: `perm-${script}`,
                        name: `Permission: ${script}`,
                        status: 'fail',
                        message: 'Script is not executable (run chmod +x)'
                    })
                } else {
                    results.push({
                        id: `perm-${script}`,
                        name: `Permission: ${script}`,
                        status: 'pass',
                        message: 'Executable bit set'
                    })
                }
            }
        }

        return results
    }

    private async checkIntegrity(root: string): Promise<CheckResult> {
        const scanResults = await projectScanner.scan(root)
        const modified = scanResults.filter((r) => r.status === 'modified')
        const legacy = scanResults.filter((r) => r.status === 'legacy')

        if (legacy.length > 0) {
            return {
                id: 'integrity',
                name: 'Project Integrity',
                status: 'warn',
                message: `${legacy.length} legacy file(s) detected (no signature). Run update to migrate.`
            }
        }

        if (modified.length > 0) {
            return {
                id: 'integrity',
                name: 'Project Integrity',
                status: 'pass',
                message: `Valid structure (${modified.length} user customizations found)`
            }
        }

        return {
            id: 'integrity',
            name: 'Project Integrity',
            status: 'pass',
            message: 'All files match official templates'
        }
    }
}

export const doctor = new Doctor()
