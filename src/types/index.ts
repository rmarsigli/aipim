export interface PackageJson {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    [key: string]: unknown
}

export interface FrameworkConfig {
    id: string
    name: string
    template: string
    check: (pkg: PackageJson) => boolean
}

export interface DetectedProject {
    framework: string | null
    frameworkVersion: string | null
    packageManager: string | null
    hasGit: boolean
    hasNodeModules: boolean
    existingSetup: {
        hasProject: boolean
        hasPrompts: string[]
    }
}

export interface InstallConfig {
    ais: string[]
    guidelines: string[]
    dryRun?: boolean
    version: 'compact' | 'full'
    skipConfirmation: boolean
}

export interface InstallOptions {
    yes?: boolean
    preset?: string
    ai?: string[]
    guidelines?: string[]
    compact?: boolean
    full?: boolean
    dryRun?: boolean
}

export interface UpdateOptions {
    force?: boolean
    dryRun?: boolean
    yes?: boolean
}
