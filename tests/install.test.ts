import { detectProject } from '../src/core/detector'
import fs from 'fs-extra'
import path from 'path'

describe('Install Command', () => {
    describe('detectProject', () => {
        let tempDir: string

        beforeEach(async () => {
            tempDir = path.join(__dirname, '.temp-test')
            await fs.ensureDir(tempDir)
            process.chdir(tempDir)
        })

        afterEach(async () => {
            process.chdir(path.join(__dirname, '..'))
            await fs.remove(tempDir)
        })

        test('detects React project', async () => {
            await fs.writeJson('package.json', {
                dependencies: { react: '^18.0.0' }
            })
            await fs.writeFile('vite.config.js', '')

            const detected = await detectProject()

            expect(detected.framework).toBe('react-vite')
        })

        test('detects Astro project', async () => {
            await fs.writeJson('package.json', {
                dependencies: { astro: '^4.0.0' }
            })
            await fs.writeFile('astro.config.mjs', '')

            const detected = await detectProject()

            expect(detected.framework).toBe('astro')
        })

        test('detects pnpm', async () => {
            await fs.writeFile('pnpm-lock.yaml', '')

            const detected = await detectProject()

            expect(detected.packageManager).toBe('pnpm')
        })

        test('detects existing setup', async () => {
            await fs.ensureDir('.project')
            await fs.writeFile('CLAUDE.md', '')

            const detected = await detectProject()

            expect(detected.existingSetup.hasProject).toBe(true)
            expect(detected.existingSetup.hasPrompts).toContain('CLAUDE.md')
        })
    })
})
