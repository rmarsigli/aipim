---
title: "Svelte UI — project setup, Vite build, static serving"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-M
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: [TASK-010]
tags: [ui, svelte, frontend]
related_files:
  - ui/package.json
  - ui/vite.config.ts
  - ui/src/app.svelte
  - src/mcp/server.ts
---

# Task: Svelte UI — Project Setup

## Objective

Criar o projeto Svelte dentro de `ui/` com Vite como build tool. O build final gera arquivos estáticos que o Hono serve em `/ui/*`. Ao rodar `aipim ui`, o servidor sobe e abre o browser automaticamente.

**Success:**
- [ ] `ui/` com Svelte 5 + Vite configurado
- [ ] `npm run build` em `ui/` gera `ui/dist/` com arquivos estáticos
- [ ] Hono serve `ui/dist/` em `/ui/*`
- [ ] `aipim ui` sobe servidor + abre browser em `localhost:3141/ui`
- [ ] Hot reload em desenvolvimento (`aipim ui --dev`)
- [ ] Bundle final < 100KB gzipped

## Stack

```
Svelte 5 (runes)        ← framework UI
Vite                    ← build tool, dev server
TailwindCSS v4          ← styling (< 10KB em produção com purge)
svelte-routing          ← client-side routing simples
EventSource API         ← SSE nativo do browser (sem lib extra)
```

**Por que Svelte 5 com runes:**
```svelte
<!-- Store reativo sem boilerplate -->
<script>
  let tasks = $state([])
  let filter = $state('all')

  $effect(() => {
    fetch(`/api/tasks?status=${filter}`)
      .then(r => r.json())
      .then(data => tasks = data)
  })
</script>
```

## Estrutura

```
ui/
├── src/
│   ├── App.svelte           ← root, routing
│   ├── routes/
│   │   ├── Dashboard.svelte ← /ui/
│   │   ├── Kanban.svelte    ← /ui/kanban
│   │   ├── Task.svelte      ← /ui/task/:id
│   │   └── Timeline.svelte  ← /ui/timeline
│   ├── components/
│   │   ├── TaskCard.svelte
│   │   ├── StatusBadge.svelte
│   │   └── PriorityBadge.svelte
│   ├── lib/
│   │   ├── api.ts           ← fetch wrappers para /api/*
│   │   └── sse.ts           ← EventSource wrapper com auto-reconnect
│   └── app.css              ← Tailwind imports
├── package.json
├── vite.config.ts
└── index.html
```

## Hono serving o build

```typescript
// Em server.ts — após build do ui/
import { serveStatic } from '@hono/node-server/serve-static'

app.use('/ui/*', serveStatic({
  root: './ui/dist',
  rewriteRequestPath: (path) => path.replace(/^\/ui/, '')
}))

// SPA fallback — qualquer rota não encontrada serve index.html
app.get('/ui/*', (c) => c.html(readFileSync('./ui/dist/index.html', 'utf8')))
```

## Comando CLI

```typescript
mcp.command('ui')
  .description('Start the UI server and open in browser')
  .option('--no-open', 'Do not open browser automatically')
  .option('--dev', 'Start in development mode with hot reload')
  .action(async (opts) => {
    if (opts.dev) {
      // Inicia Vite dev server em paralelo com Hono
    } else {
      await startMcpServer(projectRoot, port)
      if (opts.open) open(`http://localhost:${port}/ui`)
    }
  })
```

## Definition of Done

- [ ] `ui/` criado com Svelte 5 + Vite + Tailwind
- [ ] `npm run build` funciona e gera `ui/dist/`
- [ ] Hono serve os arquivos estáticos corretamente
- [ ] `aipim ui` abre `localhost:3141/ui` no browser
- [ ] App carrega em < 500ms
- [ ] Bundle < 100KB gzipped

## Git

Commit: `feat(ui): initialize Svelte 5 + Vite project with Hono static serving`
