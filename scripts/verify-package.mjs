#!/usr/bin/env node
/**
 * Publish guard: fails when package.json declares an artifact that was never built.
 *
 * This exists because `ui/dist` shipped as an empty promise in 2.1.0 through 2.3.0 —
 * `files` listed it, but the root build only ran tsup, so every published tarball was
 * missing the UI and `aipim ui` silently served nothing. A missing build artifact is
 * exactly the kind of thing a check should catch, not a changelog.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Returns the entries of package.json `files` that are missing or empty.
 *
 * A directory that exists but has no contents counts as missing: an empty `ui/dist`
 * is a build that did not happen, not a build with nothing to say.
 */
export function findMissingArtifacts(root) {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const declared = Array.isArray(pkg.files) ? pkg.files : []

    return declared.filter((entry) => {
        const full = join(root, entry)
        if (!existsSync(full)) return true
        return statSync(full).isDirectory() && readdirSync(full).length === 0
    })
}

// Only act when run as a script, so importing it for tests stays side-effect free.
if (process.argv[1] && process.argv[1].endsWith('verify-package.mjs')) {
    const missing = findMissingArtifacts(process.cwd())

    if (missing.length > 0) {
        console.error(
            `\nRefusing to publish: package.json declares files that were not built:\n` +
                missing.map((m) => `  - ${m}`).join('\n') +
                `\n\nRun \`pnpm run build:release\` (builds the CLI and the UI) and try again.\n`
        )
        process.exit(1)
    }

    console.log('Package artifacts verified.')
}
