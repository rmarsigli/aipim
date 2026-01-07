import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/cli.ts'],
    format: ['cjs'],
    clean: true,
    minify: true,
    target: 'node18',
    outDir: 'dist',
    sourcemap: false,
    splitting: false,
})
