import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readEvents } from '../core/events.js'
import { rebuild, openDb } from '../core/db.js'
import { migrate } from '../core/migrator.js'
import { CORE_TOOLS } from './tools/index.js'
import { activeSkillRegistry } from './skills/registry.js'
import { registerApiRoutes } from './api.js'
import { version } from '../version.js'

// MCP specification version — update only when the protocol itself changes
const MCP_PROTOCOL_VERSION = '2024-11-05'

// Maximum time a tool handler may run before the request is rejected
const TOOL_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number, toolName: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`)), ms)
        )
    ])
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// bundled into dist/cli.js → ../ui/dist
const UI_DIST = join(__dirname, '../ui/dist')

export async function startMcpServer(projectRoot: string, port = 3141): Promise<void> {
    // 1. Migrate 1.x markdown files → events.jsonl (no-op if already migrated)
    await migrate(projectRoot)

    // 2. Rebuild SQLite from events
    const events = readEvents(projectRoot)
    rebuild(projectRoot, events)

    const db = openDb(projectRoot)
    const app = new Hono()

    registerApiRoutes(app, db, projectRoot)

    // Serve Svelte UI static files if ui/dist/ exists
    if (existsSync(UI_DIST)) {
        app.use(
            '/ui/*',
            serveStatic({
                root: UI_DIST,
                rewriteRequestPath: (path) => path.replace(/^\/ui/, '')
            })
        )
        // SPA fallback: any unmatched /ui/* route gets index.html
        app.get('/ui/*', (c) => c.html(readFileSync(join(UI_DIST, 'index.html'), 'utf8')))
    }

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
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    serverInfo: { name: 'aipim', version }
                }
            })
        }

        if (body.method === 'notifications/initialized') {
            return c.json({ jsonrpc: '2.0', id: body.id, result: {} })
        }

        if (body.method === 'tools/list') {
            const activeTools = activeSkillRegistry.getActiveTools(projectRoot)
            const allTools = [...CORE_TOOLS, ...activeTools]

            return c.json({
                jsonrpc: '2.0',
                id: body.id,
                result: { tools: allTools.map((t) => t.schema) }
            })
        }

        if (body.method === 'tools/call') {
            const params = body.params ?? {}
            const toolName = params.name as string | undefined
            const toolArgs = (params.arguments ?? {}) as Record<string, unknown>

            const activeTools = activeSkillRegistry.getActiveTools(projectRoot)
            const allTools = [...CORE_TOOLS, ...activeTools]

            const tool = allTools.find((t) => t.schema.name === toolName)
            if (!tool) {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    error: { code: -32601, message: `Tool not found: ${toolName}` }
                })
            }

            try {
                const result = await withTimeout(
                    Promise.resolve(tool.handler({ db, projectRoot, events: readEvents(projectRoot) }, toolArgs)),
                    tool.timeoutMs ?? TOOL_TIMEOUT_MS,
                    toolName ?? 'unknown'
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
                console.log(`REST API available at  http://localhost:${port}/api/tasks`)
                if (existsSync(UI_DIST)) {
                    console.log(`UI available at        http://localhost:${port}/ui/`)
                }
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
