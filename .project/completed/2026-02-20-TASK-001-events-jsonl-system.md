---
title: "Implement JSONL event system"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: []
tags: [architecture, data-layer, mvp, 2.0]
related_files:
  - src/core/events.ts
  - src/types/index.ts
---

# Task: Implement JSONL Event System

## Objective

Criar o módulo `src/core/events.ts` que centraliza toda leitura e escrita do `events.jsonl`. Este é o núcleo da nova arquitetura — a fonte imutável da verdade do projeto.

**Success:**
- [ ] `events.ts` exporta tipos e funções de append/read
- [ ] Eventos são append-only (nunca editados, nunca deletados)
- [ ] Leitura retorna eventos ordenados por timestamp
- [ ] Tipos cobrem todos os state transitions necessários

## Context

**Por quê:** O AIPIM atual armazena estado em markdown sem histórico de mudanças. A IA não tem como saber quando uma task mudou de status, quem fez, ou qual era o estado em determinado ponto. O event log resolve isso com uma estrutura simples e compatível com git.

**Arquivo:** `.project/events.jsonl` — uma linha por evento, JSON por linha, append-only, versionado no git.

**Dependências:** Nenhuma — este módulo é a base de tudo.

## Implementation

### Tipos de eventos (src/types/index.ts — adicionar)

```typescript
export type EventType =
  | 'task.created'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.content_updated'
  | 'task.comment_added'
  | 'task.priority_changed'
  | 'task.dependency_added'
  | 'task.dependency_removed'
  | 'task.completed'
  | 'decision.logged'
  | 'session.started'
  | 'session.ended'

export interface BaseEvent {
  id: string           // ULID ou timestamp+random
  type: EventType
  timestamp: string    // ISO 8601
  actor: string        // git config user.email ou AIPIM_USER
  projectRoot?: string // hash do repo para multi-projeto
}

export interface TaskCreatedEvent extends BaseEvent {
  type: 'task.created'
  taskId: string
  title: string
  taskType: string     // feat, fix, chore, etc
  priority: string
  filePath: string     // caminho relativo do .md
}

export interface TaskStatusChangedEvent extends BaseEvent {
  type: 'task.status_changed'
  taskId: string
  from: string
  to: string
}

export interface TaskAssignedEvent extends BaseEvent {
  type: 'task.assigned'
  taskId: string
  assignee: string     // member id
}

export interface TaskCommentAddedEvent extends BaseEvent {
  type: 'task.comment_added'
  taskId: string
  text: string
}

export interface TaskCompletedEvent extends BaseEvent {
  type: 'task.completed'
  taskId: string
  notes?: string
  actualHours?: number
}

export interface DecisionLoggedEvent extends BaseEvent {
  type: 'decision.logged'
  title: string
  rationale: string
  taskId?: string
  filePath?: string
}

export interface TaskContentUpdatedEvent extends BaseEvent {
  type: 'task.content_updated'
  taskId: string
  commit?: string      // git commit hash se disponível
}

export type AipimEvent =
  | TaskCreatedEvent
  | TaskStatusChangedEvent
  | TaskAssignedEvent
  | TaskCommentAddedEvent
  | TaskCompletedEvent
  | DecisionLoggedEvent
  | TaskContentUpdatedEvent
```

### Módulo events.ts (src/core/events.ts — criar)

```typescript
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'

const EVENTS_FILE = '.project/events.jsonl'

function generateId(): string {
  // timestamp ms + 4 random chars
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function getActor(): string {
  // AIPIM_USER > git config user.email > 'unknown'
  if (process.env.AIPIM_USER) return process.env.AIPIM_USER
  try {
    const { execSync } = await import('child_process')
    return execSync('git config user.email', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function appendEvent(
  projectRoot: string,
  partial: Omit<AipimEvent, 'id' | 'timestamp' | 'actor'>
): AipimEvent {
  const event: AipimEvent = {
    ...partial,
    id: generateId(),
    timestamp: new Date().toISOString(),
    actor: getActor(),
  } as AipimEvent

  const filePath = join(projectRoot, EVENTS_FILE)
  appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8')
  return event
}

export function readEvents(projectRoot: string): AipimEvent[] {
  const filePath = join(projectRoot, EVENTS_FILE)
  if (!existsSync(filePath)) return []

  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as AipimEvent)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export function readEventsForTask(
  projectRoot: string,
  taskId: string
): AipimEvent[] {
  return readEvents(projectRoot).filter(
    e => 'taskId' in e && e.taskId === taskId
  )
}
```

### .gitattributes (raiz do projeto ou .project/)

```
.project/events.jsonl merge=union
```

Isso garante que merges de equipe nunca geram conflito no event log — git concatena os eventos das duas versões automaticamente.

## Definition of Done

- [ ] `src/core/events.ts` criado e exportando `appendEvent`, `readEvents`, `readEventsForTask`
- [ ] Tipos adicionados em `src/types/index.ts`
- [ ] `.gitattributes` com `merge=union` para `events.jsonl`
- [ ] Testes unitários cobrindo append, read, ordering por timestamp
- [ ] Build passa: `npm run build`
- [ ] Lint passa: `npm run lint`

## Git

Commit: `feat(core): implement append-only JSONL event system`
