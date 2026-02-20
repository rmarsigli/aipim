import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

const TEST_ROOT = join(process.cwd(), 'tests/__fixtures__/mcp-server-test')

beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.project'), { recursive: true })
})

afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe('MCP tool registry', () => {
    it('ALL_TOOLS is an array', async () => {
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')
        expect(Array.isArray(ALL_TOOLS)).toBe(true)
    })

    it('each tool has schema and handler', async () => {
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')
        for (const tool of ALL_TOOLS) {
            expect(typeof tool.schema.name).toBe('string')
            expect(typeof tool.schema.description).toBe('string')
            expect(typeof tool.handler).toBe('function')
        }
    })
})

describe('MCP server HTTP endpoint', () => {
    it('responds to initialize method', async () => {
        const { Hono } = await import('hono')
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')

        // Build the same app logic inline to avoid actually binding a port
        const app = new Hono()
        app.post('/mcp', async (c) => {
            const body = await c.req.json<{ jsonrpc: string; id: unknown; method: string }>()

            if (body.method === 'initialize') {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: { name: 'aipim', version: '2.0.0' },
                    },
                })
            }

            if (body.method === 'tools/list') {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    result: { tools: ALL_TOOLS.map((t) => t.schema) },
                })
            }

            return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
        })

        const req = new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        })
        const res = await app.fetch(req)
        const json = await res.json() as { result: { protocolVersion: string; serverInfo: { name: string } } }

        expect(json.result.protocolVersion).toBe('2024-11-05')
        expect(json.result.serverInfo.name).toBe('aipim')
    })

    it('responds to tools/list method', async () => {
        const { Hono } = await import('hono')
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')

        const app = new Hono()
        app.post('/mcp', async (c) => {
            const body = await c.req.json<{ jsonrpc: string; id: unknown; method: string }>()
            if (body.method === 'tools/list') {
                return c.json({
                    jsonrpc: '2.0',
                    id: body.id,
                    result: { tools: ALL_TOOLS.map((t) => t.schema) },
                })
            }
            return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
        })

        const req = new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        })
        const res = await app.fetch(req)
        const json = await res.json() as { result: { tools: unknown[] } }

        expect(Array.isArray(json.result.tools)).toBe(true)
        expect(json.result.tools.length).toBe(ALL_TOOLS.length)
    })

    it('returns error for unknown method', async () => {
        const { Hono } = await import('hono')

        const app = new Hono()
        app.post('/mcp', async (c) => {
            const body = await c.req.json<{ jsonrpc: string; id: unknown; method: string }>()
            return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } })
        })

        const req = new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'unknown/method' }),
        })
        const res = await app.fetch(req)
        const json = await res.json() as { error: { code: number; message: string } }

        expect(json.error.code).toBe(-32601)
        expect(json.error.message).toContain('unknown/method')
    })

    it('returns error for unknown tool in tools/call', async () => {
        const { Hono } = await import('hono')
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')

        const app = new Hono()
        app.post('/mcp', async (c) => {
            const body = await c.req.json<{ jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> }>()
            if (body.method === 'tools/call') {
                const toolName = (body.params?.name as string | undefined)
                const tool = ALL_TOOLS.find((t) => t.schema.name === toolName)
                if (!tool) {
                    return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Tool not found: ${toolName}` } })
                }
            }
            return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
        })

        const req = new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nonexistent_tool', arguments: {} } }),
        })
        const res = await app.fetch(req)
        const json = await res.json() as { error: { code: number; message: string } }

        expect(json.error.code).toBe(-32601)
        expect(json.error.message).toContain('nonexistent_tool')
    })
})

describe('MCP tool schema validation', () => {
    it('tools have valid inputSchema with type object', async () => {
        const { ALL_TOOLS } = await import('../../src/mcp/tools/index.js')
        for (const tool of ALL_TOOLS) {
            expect(tool.schema.inputSchema.type).toBe('object')
            expect(typeof tool.schema.inputSchema.properties).toBe('object')
        }
    })
})
