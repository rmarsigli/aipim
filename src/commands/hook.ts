import { Command } from 'commander'
import { existsSync } from 'fs'
import { join } from 'path'
import { readEvents } from '@/core/events.js'
import { rebuild, openDb } from '@/core/db.js'
import { buildSessionContext, evaluateStopHook, installHooks } from '@/core/hooks.js'
import { logger } from '@/utils/logger.js'
import { output } from '@/utils/output.js'

/**
 * Opens the read model, derived fresh from the event log.
 * Returns null when the directory is not an AIPIM project.
 */
function withProject<T>(fn: (db: ReturnType<typeof openDb>, projectRoot: string) => T): T | null {
    const projectRoot = process.cwd()
    if (!existsSync(join(projectRoot, '.project'))) return null

    rebuild(projectRoot, readEvents(projectRoot))
    const db = openDb(projectRoot)
    try {
        return fn(db, projectRoot)
    } finally {
        db.close()
    }
}

export function registerHookCommand(program: Command): void {
    const hook = program
        .command('hook')
        .description('Claude Code hook entry points (invoked by the harness, not by hand)')

    hook.command('install')
        .description('Register AIPIM hooks in .claude/settings.json')
        .action(() => {
            try {
                const path = installHooks(process.cwd())
                logger.success(`Hooks registered in ${path}`)
            } catch (error) {
                logger.error(error instanceof Error ? error.message : String(error))
                process.exit(1)
            }
        })

    hook.command('session-start')
        .description('Emit the current project state as session context')
        .action(() => {
            // A hook must never break the session it is attached to: any failure
            // degrades to silence rather than an error the user has to debug.
            try {
                const context = withProject((db, projectRoot) => buildSessionContext(db, projectRoot))
                if (context === null) return

                output.print(
                    JSON.stringify({
                        hookSpecificOutput: {
                            hookEventName: 'SessionStart',
                            additionalContext: context
                        }
                    })
                )
            } catch {
                // Silent by design — see above.
            }
        })

    hook.command('stop')
        .description('Check that in-progress work has been verified before the agent finishes')
        .action(() => {
            try {
                const result = withProject((db, projectRoot) =>
                    evaluateStopHook(db, projectRoot, readEvents(projectRoot))
                )
                if (result === null || !result.block) return

                output.print(JSON.stringify({ decision: 'block', reason: result.reason }))
            } catch {
                // Never block on an internal error — that would trap the session.
            }
        })
}
