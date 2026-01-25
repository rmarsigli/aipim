import path from 'path'
import fs from 'fs-extra'

export interface Guideline {
    id: string
    name: string
    templateRelativePath: string
}

export class GuidelineRegistry {
    private guidelines: Guideline[] = [
        {
            id: 'nextjs',
            name: 'Next.js (App Router)',
            templateRelativePath: 'guidelines/nextjs.md'
        },
        {
            id: 'astro',
            name: 'Astro (modern)',
            templateRelativePath: 'guidelines/astro.md'
        },
        {
            id: 'node',
            name: 'Node.js (Generic)',
            templateRelativePath: 'guidelines/node.md'
        },
        {
            id: 'vue',
            name: 'Vue 3',
            templateRelativePath: 'guidelines/vue.md'
        },
        {
            id: 'rust',
            name: 'Rust (Production)',
            templateRelativePath: 'guidelines/rust.md'
        }
    ]

    public list(): Guideline[] {
        return this.guidelines
    }

    public get(id: string): Guideline | undefined {
        return this.guidelines.find((g) => g.id === id)
    }

    public async resolveTemplate(guidelineId: string, templatesDir: string): Promise<string> {
        const guideline = this.get(guidelineId)
        if (!guideline) {
            throw new Error(`Guideline '${guidelineId}' not found.`)
        }

        const fullPath = path.join(templatesDir, guideline.templateRelativePath)

        if (await fs.pathExists(fullPath)) {
            return await fs.readFile(fullPath, 'utf-8')
        }

        // Fallback: If not found in primary templates dir, check others (handled by caller usually, but good to be safe)
        // For now, strict check.
        throw new Error(`Guideline template not found at: ${fullPath}`)
    }
}

export const guidelineRegistry = new GuidelineRegistry()
