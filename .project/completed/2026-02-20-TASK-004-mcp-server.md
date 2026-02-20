---
title: "MCP server — Hono + aipim mcp start"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: [TASK-001, TASK-002, TASK-003]
tags: [mcp, server, integration, mvp, 2.0]
related_files:
  - src/mcp/server.ts
  - src/commands/mcp.ts
---

# Task: MCP Server — Hono + `aipim mcp start`

## Objective

Criar o servidor MCP usando Hono. Um processo único que ao iniciar: roda a migração se necessário, reconstrói o SQLite a partir do `events.jsonl`, e expõe o endpoint `/mcp` para Claude Code, Cursor, Windsurf e demais ferramentas compatíveis.

**Success:**
- [ ] `aipim mcp start` sobe o servidor na porta 3141 (configurável)
- [ ] Migração automática se `events.jsonl` não existir
- [ ] SQLite reconstruído no startup
- [ ] Endpoint `/mcp` funcional e compatível com o protocolo MCP
- [ ] Claude Code consegue conectar via `claude mcp add`

## Context

**Por quê:** O fluxo atual exige copy-paste manual de prompts. Com MCP, a IA acessa o estado do projeto diretamente — sem intermediário humano, sem contexto desatualizado.

**Protocolo MCP:** JSON-RPC 2.0 sobre HTTP. A IA envia `tools/call` com nome e args, o servidor executa e retorna o resultado. A spec está em modelcontextprotocol.io.

**Dependências:** TASK-001, TASK-002, TASK-003 concluídas.

**Package:** `hono` + `@hono/node-server` + implementação manual do protocolo MCP (ou `@modelcontextprotocol/sdk` se disponível e estável).

## Implementation

### Estrutura do servidor (src/mcp/server.ts)

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { readEvents } from '../core/events.js'
import { rebuild, openDb } from '../core/db.js'
import { migrate } from '../core/migrator.js'
import { ALL_TOOLS } from './tools/index.js'

export async function startMcpServer(projectRoot: string, port = 3141) {
  // 1. Migração automática
  await migrate(projectRoot)

  // 2. Rebuild SQLite
  const events = readEvents(projectRoot)
  rebuild(projectRoot, events)

  const db = openDb(projectRoot)
  const app = new Hono()

  // MCP handshake — lista ferramentas disponíveis
  app.post('/mcp', async (c) => {
    const body = await c.req.json()

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
        result: { tools: ALL_TOOLS.map(t => t.schema) },
      })
    }

    if (body.method === 'tools/call') {
      const tool = ALL_TOOLS.find(t => t.schema.name === body.params.name)
      if (!tool) {
        return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Tool not found' } })
      }
      try {
        const result = await tool.handler({ db, projectRoot, events: readEvents(projectRoot) }, body.params.arguments)
        return c.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } })
      } catch (err) {
        return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: String(err) } })
      }
    }

    return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
  })

  serve({ fetch: app.fetch, port }, () => {
    console.log(`AIPIM MCP server running at http://localhost:${port}/mcp`)
    console.log(`Add to Claude Code: claude mcp add aipim http://localhost:${port}/mcp`)
  })
}
```

### Comando CLI (src/commands/mcp.ts)

```typescript
export function registerMcpCommand(program: Command): void {
  const mcp = program.command('mcp').description('MCP server management')

  mcp.command('start')
    .description('Start the MCP server for AI tool integration')
    .option('-p, --port <port>', 'Port to listen on', '3141')
    .option('--project <path>', 'Project root', process.cwd())
    .action(async (opts) => {
      await startMcpServer(opts.project, parseInt(opts.port))
    })
}
```

### Configuração Claude Code

Após subir o servidor, o usuário adiciona uma vez:
```bash
claude mcp add aipim http://localhost:3141/mcp
```

Ou via `claude_desktop_config.json` / `.cursor/mcp.json` para Cursor.

## Definition of Done

- [ ] `hono` e `@hono/node-server` no package.json
- [ ] `src/mcp/server.ts` com startup sequence (migrate → rebuild → serve)
- [ ] `aipim mcp start` registrado no CLI
- [ ] `tools/list` retorna schema de todas as ferramentas (TASK-005 e TASK-006)
- [ ] `tools/call` despacha para o handler correto
- [ ] Servidor aceita conexão do Claude Code (`claude mcp add`)
- [ ] Erro gracioso se porta em uso (sugerir `--port`)
- [ ] README atualizado com instruções de setup MCP

## Git

Commit: `feat(mcp): add Hono MCP server with auto-migrate and SQLite rebuild`
