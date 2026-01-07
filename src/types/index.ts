export interface FrameworkConfig {
    id: string
    name: string
    template: string
    check: (pkg: any) => boolean
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
    version: 'compact' | 'full'
    skipConfirmation: boolean
}
