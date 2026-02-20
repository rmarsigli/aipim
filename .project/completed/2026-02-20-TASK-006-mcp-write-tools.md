---
title: "MCP write tools — complete_task, update_status, add_comment, log_decision, create_task"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: [TASK-005]
tags: [mcp, tools, mvp, 2.0]
related_files:
  - src/mcp/tools/write.ts
---

# Task: MCP Write Tools

## Objective

Implementar as ferramentas MCP de escrita — as que permitem à IA atualizar o estado do projeto. Toda escrita passa por `appendEvent()` no JSONL e `applyEvent()` no SQLite. Nunca escrita direta no banco.

**Success:**
- [ ] 5 ferramentas de escrita implementadas
- [ ] Toda mudança de estado gera um evento no JSONL
- [ ] SQLite atualizado imediatamente via `applyEvent()` (sem rebuild completo)
- [ ] Operações destrutivas (complete) movem o arquivo `.md` para `completed/`

## Tools

### `complete_task`
Marca uma task como concluída. Move o `.md` para `completed/`, emite evento.

```typescript
// Input:
{ taskId: string, notes?: string, actualHours?: number }
// Output:
{ success: true, taskId, completedAt, fileMoved: string }
```

### `update_task_status`
Atualiza o status de uma task.

```typescript
// Input:
{ taskId: string, status: 'in-progress' | 'review' | 'blocked' | 'backlog', reason?: string }
// Output:
{ success: true, taskId, from: string, to: string }
```

### `add_comment`
Adiciona um comentário a uma task. Imutável — não pode ser editado depois.

```typescript
// Input:
{ taskId: string, text: string }
// Output:
{ success: true, commentId, taskId, text, actor, timestamp }
```

### `log_decision`
Registra uma decisão arquitetural (ADR). Pode ou não estar associada a uma task.

```typescript
// Input:
{ title: string, rationale: string, taskId?: string }
// Output:
{ success: true, decisionId, filePath }
// Cria: .project/decisions/YYYY-MM-DD-ADR{NNN}-{slug}.md
```

### `create_task`
Cria uma nova task — alternativa ao `aipim task init` via CLI.

```typescript
// Input:
{ title: string, taskType: string, priority: string, description?: string }
// Output:
{ success: true, taskId, filePath }
```

## Implementation

```typescript
// src/mcp/tools/write.ts
import { appendEvent, readEvents } from '../../core/events.js'
import { applyEvent, openDb } from '../../core/db.js'
import { rename, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

export const writeTools = [
  {
    schema: {
      name: 'complete_task',
      description: 'Mark a task as done. Moves the .md file to completed/ and logs the event.',
      inputSchema: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          notes: { type: 'string' },
          actualHours: { type: 'number' }
        }
      }
    },
    handler: async ({ db, projectRoot }, { taskId, notes, actualHours }) => {
      const task = getTask(db, taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)

      // Move .md para completed/
      const date = new Date().toISOString().split('T')[0]
      const destFile = `.project/completed/${date}-${taskId}-${basename(task.file_path)}`
      renameSync(join(projectRoot, task.file_path), join(projectRoot, destFile))

      // Emite evento
      const event = appendEvent(projectRoot, {
        type: 'task.completed',
        taskId,
        notes,
        actualHours
      })

      // Atualiza SQLite imediatamente
      applyEvent(db, event)

      return { success: true, taskId, completedAt: event.timestamp, fileMoved: destFile }
    }
  },

  {
    schema: {
      name: 'update_task_status',
      description: 'Update the status of a task.',
      inputSchema: {
        type: 'object',
        required: ['taskId', 'status'],
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['backlog', 'in-progress', 'review', 'blocked'] },
          reason: { type: 'string' }
        }
      }
    },
    handler: async ({ db, projectRoot }, { taskId, status, reason }) => {
      const task = getTask(db, taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)

      const event = appendEvent(projectRoot, {
        type: 'task.status_changed',
        taskId,
        from: task.status,
        to: status,
      })
      applyEvent(db, event)

      if (reason) {
        const commentEvent = appendEvent(projectRoot, {
          type: 'task.comment_added',
          taskId,
          text: `Status changed to ${status}: ${reason}`,
        })
        applyEvent(db, commentEvent)
      }

      return { success: true, taskId, from: task.status, to: status }
    }
  },

  {
    schema: {
      name: 'add_comment',
      description: 'Add a comment to a task. Comments are immutable once written.',
      inputSchema: {
        type: 'object',
        required: ['taskId', 'text'],
        properties: {
          taskId: { type: 'string' },
          text: { type: 'string' }
        }
      }
    },
    handler: async ({ db, projectRoot }, { taskId, text }) => {
      const event = appendEvent(projectRoot, { type: 'task.comment_added', taskId, text })
      applyEvent(db, event)
      return { success: true, commentId: event.id, taskId, text, timestamp: event.timestamp }
    }
  },

  {
    schema: {
      name: 'log_decision',
      description: 'Log an architectural decision (ADR). Creates a .md file in decisions/.',
      inputSchema: {
        type: 'object',
        required: ['title', 'rationale'],
        properties: {
          title: { type: 'string' },
          rationale: { type: 'string' },
          taskId: { type: 'string' }
        }
      }
    },
    handler: async ({ db, projectRoot }, { title, rationale, taskId }) => {
      // Cria .md do ADR
      const date = new Date().toISOString().split('T')[0]
      const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const filePath = `.project/decisions/${date}-ADR-${slug}.md`
      writeAdrFile(join(projectRoot, filePath), { title, rationale, taskId, date })

      const event = appendEvent(projectRoot, { type: 'decision.logged', title, rationale, taskId, filePath })
      applyEvent(db, event)
      return { success: true, decisionId: event.id, filePath }
    }
  },

  {
    schema: {
      name: 'create_task',
      description: 'Create a new task in the backlog.',
      inputSchema: {
        type: 'object',
        required: ['title', 'taskType', 'priority'],
        properties: {
          title: { type: 'string' },
          taskType: { type: 'string', enum: ['feat', 'fix', 'chore', 'docs', 'refactor', 'test'] },
          priority: { type: 'string', enum: ['P1-S', 'P1-M', 'P1-L', 'P2-S', 'P2-M', 'P2-L', 'P3'] },
          description: { type: 'string' }
        }
      }
    },
    handler: async ({ db, projectRoot }, args) => {
      // Usa taskManager.initTask() existente ou lógica similar
      // Emite task.created event
    }
  }
]
```

## Definition of Done

- [ ] 5 ferramentas implementadas em `src/mcp/tools/write.ts`
- [ ] Toda escrita vai por `appendEvent()` → `applyEvent()` (nunca SQLite direto)
- [ ] `complete_task` move o `.md` para `completed/` corretamente
- [ ] `log_decision` cria o arquivo `.md` do ADR na pasta `decisions/`
- [ ] Testes: cada tool com cenário de sucesso e erro (task não existe, status inválido)
- [ ] Build e lint passam

## Git

Commit: `feat(mcp): implement write tools (complete, status, comment, decision, create)`
