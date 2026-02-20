---
title: "REST API — /api/* endpoints on Hono server for Svelte UI"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: [TASK-004, TASK-005, TASK-006]
tags: [api, ui, backend]
related_files:
  - src/mcp/server.ts
  - src/mcp/api.ts
---

# Task: REST API for Svelte UI

## Objective

Adicionar rotas `/api/*` no servidor Hono existente para alimentar a Svelte UI. O servidor MCP já existe após TASK-004 — essa task só adiciona as rotas REST e o endpoint SSE para real-time.

**Success:**
- [ ] Rotas `/api/tasks`, `/api/tasks/:id`, `/api/events`, `/api/stats`
- [ ] `POST /api/events` — escreve eventos (UI salva mudanças assim)
- [ ] `GET /api/events/stream` — SSE para real-time
- [ ] CORS configurado para `localhost` (UI abre no browser)

## Endpoints

```
GET  /api/tasks              → lista tasks (com filtros via query params)
GET  /api/tasks/:id          → task + conteúdo .md + comentários
POST /api/events             → adiciona evento (body: partial event)
GET  /api/events             → histórico paginado
GET  /api/events/stream      → SSE stream de novos eventos
GET  /api/stats              → stats consolidadas (byStatus, velocity)
GET  /api/team               → membros do time
GET  /api/decisions          → ADRs
```

## Implementation

```typescript
// src/mcp/api.ts — adicionar ao app Hono existente
import { streamSSE } from 'hono/streaming'

export function registerApiRoutes(app: Hono, { db, projectRoot }) {
  app.use('/api/*', cors({ origin: 'http://localhost:*' }))

  app.get('/api/tasks', (c) => {
    const { status, assignee, priority } = c.req.query()
    return c.json(queryTasks(db, { status, assignee, priority }))
  })

  app.get('/api/tasks/:id', (c) => {
    const task = getTask(db, c.req.param('id'))
    if (!task) return c.json({ error: 'Not found' }, 404)
    const content = readTaskContent(projectRoot, task.file_path)
    return c.json({ ...task, content })
  })

  app.post('/api/events', async (c) => {
    const partial = await c.req.json()
    const event = appendEvent(projectRoot, partial)
    applyEvent(db, event)
    // Notifica listeners SSE
    eventEmitter.emit('event', event)
    return c.json(event, 201)
  })

  // SSE — UI mantém conexão aberta, recebe eventos em tempo real
  app.get('/api/events/stream', (c) => {
    return streamSSE(c, async (stream) => {
      const handler = (event) => {
        stream.writeSSE({ data: JSON.stringify(event), event: event.type })
      }
      eventEmitter.on('event', handler)
      // Cleanup quando cliente desconecta
      c.req.raw.signal.addEventListener('abort', () => {
        eventEmitter.off('event', handler)
      })
      // Mantém stream vivo
      while (!c.req.raw.signal.aborted) {
        await new Promise(r => setTimeout(r, 30000))
        stream.writeSSE({ data: '', event: 'ping' })
      }
    })
  })

  app.get('/api/stats', (c) => {
    // aggregate queries no SQLite
    return c.json(getStats(db))
  })
}
```

## Definition of Done

- [ ] Todas as rotas implementadas e documentadas
- [ ] SSE funcionando: abrir `/api/events/stream` no browser, POST em `/api/events`, evento aparece
- [ ] CORS correto para desenvolvimento local
- [ ] Erros retornam JSON com campo `error`
- [ ] Paginação em `/api/events` (limit + offset)

## Git

Commit: `feat(api): add REST endpoints and SSE stream for Svelte UI`
