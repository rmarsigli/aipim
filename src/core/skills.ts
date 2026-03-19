import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { logger } from '@/utils/logger.js'
import { signatureManager } from '@/core/signature.js'

export interface Skill {
    id: string
    name: string
    description: string
    templateRelativePath: string
}

export class SkillRegistry {
    private skills: Skill[] = [
        {
            id: 'pest',
            name: 'Pest PHP',
            description: 'Best practices for the Pest PHP testing framework',
            templateRelativePath: 'skills/pest.md'
        },
        {
            id: 'tailwind',
            name: 'TailwindCSS v4',
            description: 'Maintainable utility-first class management guidelines',
            templateRelativePath: 'skills/tailwind.md'
        },
        {
            id: 'typescript',
            name: 'Strict TypeScript',
            description: 'Strict TypeScript rules banning any and enforcing explicit returns',
            templateRelativePath: 'skills/typescript.md'
        },
        {
            id: 'laravel',
            name: 'Laravel',
            description: 'Eloquent, controllers, policies, queues and config best practices',
            templateRelativePath: 'skills/laravel.md'
        },
        {
            id: 'react',
            name: 'React',
            description: 'Functional components, hooks rules, state and effect guidelines',
            templateRelativePath: 'skills/react.md'
        },
        {
            id: 'vue',
            name: 'Vue 3',
            description: 'Composition API, script setup, reactivity and composable guidelines',
            templateRelativePath: 'skills/vue.md'
        },
        {
            id: 'rest-api',
            name: 'REST API Design',
            description: 'HTTP verbs, status codes, versioning, pagination and naming conventions',
            templateRelativePath: 'skills/rest-api.md'
        },
        {
            id: 'php',
            name: 'Modern PHP',
            description: 'Type declarations, enums, match, readonly and PSR-12 guidelines',
            templateRelativePath: 'skills/php.md'
        },
        {
            id: 'security',
            name: 'Secure Coding',
            description: 'Input validation, SQL injection, XSS, secrets and auth guidelines',
            templateRelativePath: 'skills/security.md'
        },
        {
            id: 'vitest',
            name: 'Vitest / Jest',
            description: 'Test structure, mocking, isolation and async assertion guidelines',
            templateRelativePath: 'skills/vitest.md'
        },
        {
            id: 'svelte',
            name: 'Svelte 5',
            description: 'Runes, $state, $derived, $effect and $props guidelines',
            templateRelativePath: 'skills/svelte.md'
        },
        {
            id: 'python',
            name: 'Python',
            description: 'Type hints, dataclasses, pathlib, async and exception guidelines',
            templateRelativePath: 'skills/python.md'
        },
        {
            id: 'rust',
            name: 'Rust',
            description: 'Ownership, Result, iterators, traits and unsafe guidelines',
            templateRelativePath: 'skills/rust.md'
        },
        {
            id: 'langchain',
            name: 'LangChain / LangGraph',
            description: 'LCEL, structured output, agent state and observability guidelines',
            templateRelativePath: 'skills/langchain.md'
        },
        {
            id: 'django',
            name: 'Django',
            description: 'ORM, views, signals, migrations and settings best practices',
            templateRelativePath: 'skills/django.md'
        },
        {
            id: 'fastapi',
            name: 'FastAPI',
            description: 'Pydantic models, dependency injection, async routes and routers',
            templateRelativePath: 'skills/fastapi.md'
        },
        {
            id: 'docker',
            name: 'Docker',
            description: 'Layer caching, multi-stage builds, non-root user and secrets guidelines',
            templateRelativePath: 'skills/docker.md'
        },
        {
            id: 'prisma',
            name: 'Prisma ORM',
            description: 'Singleton client, transactions, migrations and type-safe queries',
            templateRelativePath: 'skills/prisma.md'
        },
        {
            id: 'nextjs',
            name: 'Next.js App Router',
            description: 'Server components, data fetching, Server Actions and metadata guidelines',
            templateRelativePath: 'skills/nextjs.md'
        }
    ]

    public list(): Skill[] {
        return this.skills
    }

    public get(id: string): Skill | undefined {
        return this.skills.find((s) => s.id === id)
    }

    public getTemplatesDir(): string {
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)

        let templatesDir = path.join(__dirname, 'templates')

        if (!fs.existsSync(templatesDir)) {
            templatesDir = path.join(__dirname, '../templates')
        }

        if (!fs.existsSync(templatesDir)) {
            templatesDir = path.join(process.cwd(), 'src/templates')
        }

        return templatesDir
    }

    public async resolveTemplate(skillId: string): Promise<string> {
        const skill = this.get(skillId)
        if (!skill) {
            throw new Error(`Skill '${skillId}' not found.`)
        }

        const templatesDir = this.getTemplatesDir()
        const fullPath = path.join(templatesDir, skill.templateRelativePath)

        if (await fs.pathExists(fullPath)) {
            return await fs.readFile(fullPath, 'utf-8')
        }

        throw new Error(`Skill template not found at: ${fullPath}`)
    }

    public async injectSkill(skillId: string, projectRoot: string): Promise<void> {
        const templateContent = await this.resolveTemplate(skillId)

        // Check if Laravel Boost
        const boostDir = path.join(projectRoot, '.ai/guidelines')
        const isBoost = await fs.pathExists(boostDir)

        if (isBoost) {
            const targetFile = path.join(boostDir, `skill-${skillId}.blade.php`)
            await fs.writeFile(targetFile, templateContent, 'utf-8')
            logger.success(
                `Skill '${skillId}' successfully injected into Boost guidelines: .ai/guidelines/skill-${skillId}.blade.php`
            )
            return
        }

        // Standard Mode
        const filesToUpdate = ['CLAUDE.md', 'GEMINI.md']
        let updatedCount = 0

        for (const file of filesToUpdate) {
            const filePath = path.join(projectRoot, file)
            if (!(await fs.pathExists(filePath))) continue

            let content = await fs.readFile(filePath, 'utf-8')

            // Prevent duplicate
            if (content.includes(templateContent.trim())) {
                logger.warn(`Skill '${skillId}' is already injected in ${file}. Skipping.`)
                continue
            }

            const slotEndMarker = '{{/SLOT:guidelines}}'
            const insertionIndex = content.indexOf(slotEndMarker)

            if (insertionIndex === -1) {
                logger.warn(`Could not find ${slotEndMarker} in ${file}. Appending to the end.`)
                content = content + '\n\n' + templateContent + '\n'
            } else {
                content =
                    content.slice(0, insertionIndex) +
                    '\n' +
                    templateContent.trim() +
                    '\n\n' +
                    content.slice(insertionIndex)
            }

            const signedContent = signatureManager.sign(content)
            await fs.writeFile(filePath, signedContent, 'utf-8')
            updatedCount++
            logger.success(`Skill '${skillId}' injected and signed in ${file}`)
        }

        if (updatedCount === 0) {
            logger.warn('No supported AI guideline files (CLAUDE.md, GEMINI.md) found to inject the skill.')
        }
    }
}

export const skillRegistry = new SkillRegistry()
