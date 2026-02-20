import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { readEvents } from '../core/events.js'
import { rebuild, openDb } from '../core/db.js'
import { migrate } from '../core/migrator.js'
import { ALL_TOOLS } from './tools/index.js'

export async function startMcpServer(projectRoot: string, port = 3141): Promise<void> {
    // 1. Migrate 1.x markdown files → events.jsonl (no-op if already migrated)
    migrate(projectRoot)

    // 2. Rebuild SQLite from events
    const events = readEvents(projectRoot)
    rebuild(projectRoot, events)

    const db = openDb(projectRoot)
    const app = new Hono()

    app.post('/mcp', async (c) => {
        const body = await c.req.json<{
            jsonrpc: string
            id: unknown
            method: string
            params?: Record<string, unknown>
        }>()

        if (body.method === 'initialize') {
            return c.json({
                jsonrpc: '2.0',
                id: body.id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: { name: 'aipim', version: '2.0.0' }
                }
            })
        }

        if (body.method === 'notifications/initialized') {
            return c.json({ jsonrpc: '2.0', id: body.id, result: {} })
        }

        if (body.method === 'tools/list') {
            return c.json({
                jsonrpc: '2.0',
                id: body.id,
                result: { tools: ALL_TOOLS.map((t) => t.schema) }
            })
        }

        if (body.method === 'tools/call') {
            const params = body.params ?? {}
            const toolName = params.name as string | undefined
            const toolArgs = (params.arguments ?? {}) as Record<string, unknown>

            const tool = ALL_TOOLS.find((t) => t.schema.name === toolName)
            if (!tool) {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    error: { code: -32601, message: `Tool not found: ${toolName}` }
                })
            }

            try {
                const result = await Promise.resolve(
                    tool.handler({ db, projectRoot, events: readEvents(projectRoot) }, toolArgs)
                )
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                })
            } catch (err) {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    error: { code: -32000, message: String(err) }
                })
            }
        }

        return c.json({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32601, message: `Method not found: ${body.method}` }
        })
    })

    await new Promise<void>((resolve, reject) => {
        try {
            serve({ fetch: app.fetch, port }, () => {
                /* eslint-disable no-console */
                console.log(`AIPIM MCP server running at http://localhost:${port}/mcp`)
                console.log(`Add to Claude Code: claude mcp add aipim http://localhost:${port}/mcp`)
                /* eslint-enable no-console */
                resolve()
            })
        } catch (err: unknown) {
            const code = (err as NodeJS.ErrnoException).code
            if (code === 'EADDRINUSE') {
                reject(new Error(`Port ${port} is already in use. Try: aipim mcp start --port <other-port>`))
            } else {
                reject(err instanceof Error ? err : new Error(String(err)))
            }
        }
    })
}
