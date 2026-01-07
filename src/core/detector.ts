import fs from 'fs-extra'
import path from 'path'
import { FRAMEWORKS, LOCK_FILES, PROMPT_FILES } from '../config/frameworks'
import { DetectedProject, FrameworkConfig } from '../types'

export async function detectProject(cwd: string = process.cwd()): Promise<DetectedProject> {
    const pkgPath = path.join(cwd, 'package.json')
    const pkg = (await fs.pathExists(pkgPath)) ? await fs.readJson(pkgPath) : null
    
    const [hasGit, hasNodeModules, hasProject, promptFiles] = await Promise.all([
        fs.pathExists(path.join(cwd, '.git')),
        fs.pathExists(path.join(cwd, 'node_modules')),
        fs.pathExists(path.join(cwd, '.project')),
        filterExistingFiles(cwd, PROMPT_FILES)
    ])

    const { framework, frameworkVersion } = detectFramework(pkg)

    return {
        framework,
        frameworkVersion,
        packageManager: await detectPackageManager(cwd),
        hasGit,
        hasNodeModules,
        existingSetup: {
            hasProject,
            hasPrompts: promptFiles
        }
    }
}

function detectFramework(pkg: any): { framework: string | null; frameworkVersion: string | null } {
    if (!pkg) return { framework: null, frameworkVersion: null }

    const match = FRAMEWORKS.find((sig: FrameworkConfig) => sig.check(pkg))
    
    if (!match) return { framework: null, frameworkVersion: null }

    const version = getDepVersion(pkg, match.id) || getDepVersion(pkg, match.id.split('-')[0])

    return {
        framework: match.id,
        frameworkVersion: version
    }
}

async function detectPackageManager(cwd: string): Promise<string | null> {
    for (const [file, manager] of Object.entries(LOCK_FILES)) {
        if (await fs.pathExists(path.join(cwd, file))) return manager
    }
    return null
}

const getDepVersion = (pkg: any, name: string): string => pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]

async function filterExistingFiles(cwd: string, files: string[]): Promise<string[]> {
    const existing: string[] = []
    for (const file of files) {
        if (await fs.pathExists(path.join(cwd, file))) existing.push(file)
    }
    return existing
}

export function getFrameworkDisplayName(frameworkId: string | null): string {
    if (!frameworkId) return ''
    return FRAMEWORKS.find(f => f.id === frameworkId)?.name || frameworkId
}
