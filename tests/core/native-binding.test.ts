import { describe, it, expect } from '@jest/globals'
import { isMissingNativeBinding, MISSING_BINDING_HELP } from '../../src/core/db.js'

describe('isMissingNativeBinding', () => {
    it('recognises the bindings-lookup failure better-sqlite3 throws', () => {
        const error = new Error(
            'Could not locate the bindings file. Tried:\n' +
                ' → /app/node_modules/better-sqlite3/build/better_sqlite3.node\n' +
                ' → /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
        )
        expect(isMissingNativeBinding(error)).toBe(true)
    })

    it('recognises a module-not-found on the binding itself', () => {
        expect(isMissingNativeBinding(new Error("Cannot find module 'better_sqlite3.node'"))).toBe(true)
    })

    it('accepts a thrown non-Error', () => {
        expect(isMissingNativeBinding('Could not locate the bindings file')).toBe(true)
    })

    it('does not claim ordinary SQLite failures', () => {
        expect(isMissingNativeBinding(new Error('SQLITE_CANTOPEN: unable to open database file'))).toBe(false)
        expect(isMissingNativeBinding(new Error('database disk image is malformed'))).toBe(false)
        expect(isMissingNativeBinding(null)).toBe(false)
    })
})

describe('MISSING_BINDING_HELP', () => {
    it('names the cause and both fixes, since neither is guessable', () => {
        expect(MISSING_BINDING_HELP).toContain('pnpm blocks package install scripts by default')
        expect(MISSING_BINDING_HELP).toContain('pnpm approve-builds -g')
        expect(MISSING_BINDING_HELP).toContain('onlyBuiltDependencies')
    })

    it('explains why earlier commands worked, which is the confusing part', () => {
        expect(MISSING_BINDING_HELP).toContain('loads lazily')
    })

    it('scopes the package.json form to projects — it does not take effect for global installs', () => {
        const declarative = MISSING_BINDING_HELP.slice(MISSING_BINDING_HELP.indexOf('To declare'))
        expect(declarative).toContain('in a project')
        expect(declarative).not.toContain('-g')
    })
})
