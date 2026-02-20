---
title: "MCP read tools — get_project_context, get_next_task, list_tasks, get_task, get_blockers"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-M
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: [TASK-004]
tags: [mcp, tools, mvp, 2.0]
related_files:
  - src/mcp/tools/read.ts
  - src/mcp/tools/index.ts
---

# Task: MCP Read Tools

## Objective

Implementar as ferramentas MCP de leitura que a IA usa para entender o estado atual do projeto sem nenhuma intervenção humana.

**Success:**
- [ ] 5 ferramentas de leitura implementadas e registradas
- [ ] Respostas estruturadas e informativas o suficiente para a IA tomar decisões
- [ ] Conteúdo dos `.md` incluído quando relevante (task detail)
- [ ] Ordenação de tasks por prioridade real (P1-S primeiro)

## Tools

### `get_project_context`
Visão geral do projeto. A IA chama isso no início de toda sessão.

```typescript
// Input: nenhum
// Output:
{
  project: { name, description },
  stats: {
    total: number,
    byStatus: { backlog: N, 'in-progress': N, review: N, done: N, blocked: N }
  },
  currentTask: Task | null,        // task com status in-progress
  nextTask: Task | null,           // próxima task no backlog por prioridade
  blockers: Task[],                // tasks bloqueadas
  recentEvents: Event[],           // últimos 10 eventos
  session: { number, branch }      // do context.md
}
```

### `get_next_task`
Próxima task disponível por prioridade real. Resolve o bug alfabético atual.

```typescript
// Input: nenhum
// Output: Task completa com conteúdo do .md
{
  id: 'TASK-007',
  title: '...',
  priority: 'P1-S',
  filePath: '.project/backlog/...',
  content: '...markdown completo...',  // readFileSync do .md
  comments: Comment[],
  dependencies: string[]
}
```

### `list_tasks`
Lista tasks com filtros opcionais.

```typescript
// Input:
{
  status?: 'backlog' | 'in-progress' | 'review' | 'done' | 'blocked',
  assignee?: string,
  priority?: 'P1' | 'P2' | 'P3',
  limit?: number   // default 20
}
// Output: Task[] ordenado por prioridade
```

### `get_task`
Detalhe completo de uma task específica, incluindo histórico de eventos e comentários.

```typescript
// Input: { taskId: 'TASK-001' }
// Output:
{
  ...task,
  content: string,      // conteúdo do .md
  events: Event[],      // histórico específico da task
  comments: Comment[]
}
```

### `get_blockers`
Tasks bloqueadas com contexto de quanto tempo estão paradas.

```typescript
// Input: nenhum
// Output:
[{
  ...task,
  blockedSince: string,   // timestamp do último status_changed
  blockedForDays: number
}]
```

## Implementation

```typescript
// src/mcp/tools/read.ts
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { queryTasks, getNextTask, getBlockers, getTask } from '../../core/db.js'

export const readTools = [
  {
    schema: {
      name: 'get_project_context',
      description: 'Get a full overview of the project state. Call this at the start of every session.',
      inputSchema: { type: 'object', properties: {} }
    },
    handler: async ({ db, projectRoot }) => {
      // lê context.md para session info
      // agrega stats do SQLite
      // retorna visão consolidada
    }
  },

  {
    schema: {
      name: 'get_next_task',
      description: 'Get the next task to work on, ordered by real priority (P1-S first, not alphabetical).',
      inputSchema: { type: 'object', properties: {} }
    },
    handler: async ({ db, projectRoot }) => {
      const task = getNextTask(db)
      if (!task) return { message: 'No tasks in backlog. All done!' }
      const content = existsSync(join(projectRoot, task.file_path))
        ? readFileSync(join(projectRoot, task.file_path), 'utf8')
        : null
      return { ...task, content }
    }
  },

  {
    schema: {
      name: 'list_tasks',
      description: 'List tasks with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['backlog', 'in-progress', 'review', 'done', 'blocked'] },
          assignee: { type: 'string' },
          priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          limit: { type: 'number' }
        }
      }
    },
    handler: async ({ db }, args) => queryTasks(db, args)
  },

  {
    schema: {
      name: 'get_task',
      description: 'Get full details of a specific task including its markdown content and event history.',
      inputSchema: {
        type: 'object',
        required: ['taskId'],
        properties: { taskId: { type: 'string' } }
      }
    },
    handler: async ({ db, projectRoot }, { taskId }) => {
      const task = getTask(db, taskId)
      if (!task) return { error: `Task ${taskId} not found` }
      const content = task.file_path && existsSync(join(projectRoot, task.file_path))
        ? readFileSync(join(projectRoot, task.file_path), 'utf8')
        : null
      return { ...task, content }
    }
  },

  {
    schema: {
      name: 'get_blockers',
      description: 'Get all blocked tasks with how long they have been blocked.',
      inputSchema: { type: 'object', properties: {} }
    },
    handler: async ({ db }) => getBlockers(db)
  }
]
```

## Definition of Done

- [ ] 5 ferramentas implementadas em `src/mcp/tools/read.ts`
- [ ] Registradas em `src/mcp/tools/index.ts`
- [ ] `get_next_task` retorna prioridade real, não ordem alfabética
- [ ] `get_task` inclui conteúdo do `.md` quando o arquivo existe
- [ ] `get_project_context` funciona mesmo sem context.md (projeto novo)
- [ ] Testes: cada tool com input válido e edge cases (task inexistente, backlog vazio)

## Git

Commit: `feat(mcp): implement read tools (context, next_task, list, get, blockers)`
