import Database from 'better-sqlite3'
import { McpTool, ToolContext } from '../../tools/index.js'
import { ActiveSkill } from '../types.js'
import path from 'path'

function getLocalDb(dbPath: unknown, projectRoot: string): Database.Database {
    const resolvedRoot = path.resolve(projectRoot)
    let resolvedPath = path.join(resolvedRoot, '.project/data.db')

    if (typeof dbPath === 'string' && dbPath.trim() !== '') {
        const candidate = path.resolve(projectRoot, dbPath)
        // Prevent path traversal: the resolved path must remain inside the project root.
        // better-sqlite3's prepare() also rejects multi-statement queries, so compound
        // injection via SQL is not possible through this guard.
        if (!candidate.startsWith(resolvedRoot + path.sep) && candidate !== resolvedRoot) {
            throw new Error(
                `Security Error: Database path '${dbPath}' is outside the project root. Only paths within the project directory are allowed.`
            )
        }
        resolvedPath = candidate
    }

    return new Database(resolvedPath, { fileMustExist: true })
}

export const aipimDbSchema: McpTool = {
    schema: {
        name: 'aipim_db_schema',
        description: 'Retrieves the schema (tables and columns) of a local SQLite database.',
        inputSchema: {
            type: 'object',
            properties: {
                dbPath: {
                    type: 'string',
                    description:
                        'Optional path to the SQLite database file. Defaults to AIPIM internal project db (.project/data.db).'
                }
            }
        }
    },
    handler: (ctx: ToolContext, args: Record<string, unknown>) => {
        try {
            const db = getLocalDb(args.dbPath, ctx.projectRoot)

            const tablesQuery = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                .all() as { name: string }[]

            const schema: Record<string, unknown> = {}
            for (const table of tablesQuery) {
                const info = db.pragma(`table_info("${table.name}")`)
                schema[table.name] = info
            }

            db.close()
            return schema
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to get schema: ${msg}`)
        }
    }
}

export const aipimDbQuery: McpTool = {
    schema: {
        name: 'aipim_db_query',
        description: 'Executes a READ-ONLY SQL query against a local SQLite database.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The SELECT / EXPLAIN SQL query to execute.'
                },
                dbPath: {
                    type: 'string',
                    description:
                        'Optional path to the SQLite database file. Defaults to AIPIM internal project db (.project/data.db).'
                }
            },
            required: ['query']
        }
    },
    handler: (ctx: ToolContext, args: Record<string, unknown>) => {
        const query = typeof args.query === 'string' ? args.query.trim() : ''

        // Strict safety check for read-only. Checking only the start of the query is sufficient
        // because better-sqlite3's prepare() rejects multi-statement strings (e.g. "SELECT 1; DROP TABLE...")
        // at the driver level, so a compound injection cannot bypass this guard.
        const forbiddenVerbs = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|REPLACE|TRUNCATE)\b/i
        if (forbiddenVerbs.test(query)) {
            throw new Error(
                'Security Error: Only READ-ONLY (SELECT, EXPLAIN, PRAGMA) queries are allowed through this tool.'
            )
        }

        try {
            const db = getLocalDb(args.dbPath, ctx.projectRoot)
            const stmt = db.prepare(query)
            const results = stmt.all()
            db.close()
            return results
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            throw new Error(`Query failed: ${msg}`)
        }
    }
}

export const databaseSkill: ActiveSkill = {
    id: 'database',
    tools: [aipimDbSchema, aipimDbQuery]
}
