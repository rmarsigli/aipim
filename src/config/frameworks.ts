import { FrameworkConfig } from '../types'
import fs from 'fs-extra'

const hasDep = (pkg: any, name: string): boolean => pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]
const hasFile = (filename: string): boolean => fs.pathExistsSync(filename)

export const FRAMEWORKS: FrameworkConfig[] = [
    {
        id: 'astro',
        name: 'Astro',
        template: 'astro',
        check: (pkg) => hasDep(pkg, 'astro') || hasFile('astro.config.mjs') || hasFile('astro.config.js')
    },
    {
        id: 'nextjs',
        name: 'Next.js',
        template: 'nextjs',
        check: (pkg) => hasDep(pkg, 'next') || hasFile('next.config.js')
    },
    {
        id: 'react-vite',
        name: 'React (Vite)',
        template: 'react',
        check: (pkg) => hasDep(pkg, 'react') && hasFile('vite.config.js')
    },
    {
        id: 'react-cra',
        name: 'React (CRA)',
        template: 'react',
        check: (pkg) => hasDep(pkg, 'react') && hasDep(pkg, 'react-scripts')
    },
    {
        id: 'react',
        name: 'React',
        template: 'react',
        check: (pkg) => hasDep(pkg, 'react')
    },
    {
        id: 'vue',
        name: 'Vue',
        template: 'vue',
        check: (pkg) => hasDep(pkg, 'vue')
    },
    {
        id: 'svelte',
        name: 'Svelte',
        template: 'svelte',
        check: (pkg) => hasDep(pkg, 'svelte')
    }
]

export const LOCK_FILES: Record<string, string> = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm',
    'bun.lockb': 'bun'
}

export const PROMPT_FILES = ['CLAUDE.md', 'GEMINI.md', 'CHATGPT.md']
