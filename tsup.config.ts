import fs from 'fs-extra'
import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/cli.ts'],
    format: ['cjs'],
    shims: true,
    clean: true,
    minify: true,
    target: 'node18',
    outDir: 'dist',
    sourcemap: false,
    splitting: false,
    onSuccess: async () => {
        await fs.copyFile('package.json', 'dist/package.json')
    }
})
