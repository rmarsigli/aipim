---
title: "Svelte UI — Kanban board with drag-and-drop"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-L
estimated_hours: 16
actual_hours: 0
status: backlog
blockers: [TASK-011]
tags: [ui, kanban, frontend]
related_files:
  - ui/src/routes/Kanban.svelte
  - ui/src/components/TaskCard.svelte
  - ui/src/components/Column.svelte
---

# Task: Kanban Board

## Objective

Implementar o board Kanban como view principal da UI. Tasks organizadas em colunas por status, com drag-and-drop que emite eventos ao mover entre colunas.

**Success:**
- [ ] 5 colunas: Backlog, In Progress, Review, Done, Blocked
- [ ] Drag-and-drop entre colunas emite `task.status_changed` via `POST /api/events`
- [ ] Cards mostram: título, ID, assignee avatar, prioridade, tipo
- [ ] Atualização em tempo real via SSE (sem reload)
- [ ] Responsivo para telas < 1200px (scroll horizontal)

## Layout

```
┌─ Backlog ──────┬─ In Progress ──┬─ Review ───────┬─ Done ─────────┬─ Blocked ──────┐
│  (N tasks)     │  (N tasks)     │  (N tasks)     │  (N tasks)     │  (N tasks)     │
│                │                │                │                │                │
│  ┌──────────┐  │  ┌──────────┐  │  ┌──────────┐  │  ┌──────────┐  │  ┌──────────┐  │
│  │ TASK-006 │  │  │ TASK-003 │  │  │ TASK-002 │  │  │ TASK-001 │  │  │ TASK-005 │  │
│  │ Payment  │  │  │ Auth     │  │  │ Dark Mode│  │  │ Setup CI │  │  │ Reports  │  │
│  │ P1-S     │  │  │ P1-M     │  │  │ P2-M     │  │  │ ✓ done   │  │  │ 🔴 7d   │  │
│  │ @joao    │  │  │ @rmar    │  │  │ @ana     │  │  │          │  │  │ @joao    │  │
│  └──────────┘  │  └──────────┘  │  └──────────┘  │  └──────────┘  │  └──────────┘  │
└────────────────┴────────────────┴────────────────┴────────────────┴────────────────┘
```

## Implementation

```svelte
<!-- ui/src/routes/Kanban.svelte -->
<script>
  import { onMount } from 'svelte'
  import Column from '../components/Column.svelte'
  import { setupSSE } from '../lib/sse.ts'
  import { applyEvent } from '../lib/state.ts'

  const COLUMNS = ['backlog', 'in-progress', 'review', 'done', 'blocked']

  let tasks = $state([])

  onMount(async () => {
    // Carrega tasks iniciais
    const res = await fetch('/api/tasks')
    tasks = await res.json()

    // SSE: atualiza quando eventos chegam
    setupSSE((event) => {
      tasks = applyEvent(tasks, event)
    })
  })

  function tasksByStatus(status) {
    return tasks.filter(t => t.status === status)
  }

  async function onDrop(taskId, newStatus) {
    // Otimista: atualiza UI imediatamente
    tasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)

    // Persiste via API
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task.status_changed',
        taskId,
        to: newStatus
      })
    })
  }
</script>

<div class="kanban">
  {#each COLUMNS as status}
    <Column
      {status}
      tasks={tasksByStatus(status)}
      on:drop={({ detail }) => onDrop(detail.taskId, status)}
    />
  {/each}
</div>
```

```svelte
<!-- ui/src/components/TaskCard.svelte -->
<script>
  let { task } = $props()

  // Drag and drop nativo HTML5 — sem lib extra
  function onDragStart(e) {
    e.dataTransfer.setData('taskId', task.id)
  }
</script>

<div
  class="task-card priority-{task.priority.toLowerCase()}"
  draggable="true"
  ondragstart={onDragStart}
  onclick={() => goto(`/ui/task/${task.id}`)}
>
  <span class="task-id">{task.id}</span>
  <h3>{task.title}</h3>
  <div class="meta">
    <span class="priority">{task.priority}</span>
    {#if task.assignee}
      <span class="assignee">@{task.assignee}</span>
    {/if}
  </div>
</div>
```

## Cores por prioridade

```css
.priority-p1-s { border-left: 3px solid #ef4444; }  /* vermelho */
.priority-p1-m { border-left: 3px solid #f97316; }  /* laranja */
.priority-p1-l { border-left: 3px solid #f97316; }
.priority-p2-s { border-left: 3px solid #eab308; }  /* amarelo */
.priority-p2-m { border-left: 3px solid #eab308; }
.priority-p3   { border-left: 3px solid #6b7280; }  /* cinza */
```

## Definition of Done

- [ ] Kanban renderiza todas as 5 colunas com tasks reais
- [ ] Drag-and-drop funciona entre colunas
- [ ] Move emite evento via API e atualiza SQLite
- [ ] SSE: mover uma task em outro browser atualiza o Kanban automaticamente
- [ ] Cards clicáveis → abre task detail (TASK-013)
- [ ] Colunas Blocked mostram tempo bloqueado em dias

## Git

Commit: `feat(ui): implement Kanban board with drag-and-drop and SSE updates`
