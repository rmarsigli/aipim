---
title: "Svelte UI — Event timeline view"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: [TASK-011]
tags: [ui, frontend, history]
related_files:
  - ui/src/routes/Timeline.svelte
---

# Task: Event Timeline View

## Objective

View que renderiza o `events.jsonl` como uma timeline visual e cronológica. Responde à pergunta: "o que aconteceu no projeto hoje? essa semana?"

**Success:**
- [ ] Timeline cronológica de todos os eventos do projeto
- [ ] Filtros: por data, por actor, por tipo de evento, por task
- [ ] Eventos agrupados por dia
- [ ] Cada evento clicável → abre a task relacionada
- [ ] Updates em tempo real via SSE

## Layout

```
Timeline ──────────────────────────────────────────────────────────
Filter: [All types ▼]  [All members ▼]  [Last 7 days ▼]

── Hoje, 20 fev ────────────────────────────────────────────────────
  15:32  @joao        ✓ Completed TASK-001 (Setup CI)  · 2h effort
  14:10  @rmarsigli   💬 Comment on TASK-003: "JWT refresh implementado"
  11:00  @rmarsigli   → Status TASK-003: backlog → in-progress

── Ontem, 19 fev ───────────────────────────────────────────────────
  17:45  @ana         📋 Decision logged: "Usar Hono over Express"
  16:20  @joao        + Task created TASK-006 (Payment integration)
  14:00  @rmarsigli   👤 Assigned TASK-003 to @rmarsigli
```

## Implementation

```svelte
<!-- ui/src/routes/Timeline.svelte -->
<script>
  let events = $state([])
  let filter = $state({ type: 'all', actor: 'all', days: 7 })

  const EVENT_ICONS = {
    'task.created': '＋',
    'task.completed': '✓',
    'task.status_changed': '→',
    'task.comment_added': '💬',
    'task.assigned': '👤',
    'decision.logged': '📋',
  }

  const EVENT_LABELS = {
    'task.created': (e) => `Task created: ${e.taskId}`,
    'task.completed': (e) => `Completed ${e.taskId}`,
    'task.status_changed': (e) => `${e.taskId}: ${e.from} → ${e.to}`,
    'task.comment_added': (e) => `Comment on ${e.taskId}`,
    'task.assigned': (e) => `Assigned ${e.taskId} to @${e.assignee}`,
    'decision.logged': (e) => `Decision: ${e.title}`,
  }

  onMount(async () => {
    const res = await fetch(`/api/events?days=${filter.days}`)
    events = await res.json()

    setupSSE((event) => {
      events = [event, ...events]
    })
  })

  // Agrupa por dia
  let groupedByDay = $derived(
    Object.groupBy(
      filteredEvents,
      (e) => e.timestamp.split('T')[0]
    )
  )
</script>

<div class="timeline">
  <FilterBar bind:filter />

  {#each Object.entries(groupedByDay) as [date, dayEvents]}
    <div class="day-group">
      <h2 class="day-header">{formatDate(date)}</h2>
      {#each dayEvents as event}
        <div class="event-item" onclick={() => event.taskId && goto(`/ui/task/${event.taskId}`)}>
          <span class="icon">{EVENT_ICONS[event.type] ?? '·'}</span>
          <span class="time">{formatTime(event.timestamp)}</span>
          <span class="actor">@{event.actor}</span>
          <span class="description">{EVENT_LABELS[event.type]?.(event)}</span>
        </div>
      {/each}
    </div>
  {/each}
</div>
```

## Definition of Done

- [ ] Timeline renderiza eventos em ordem cronológica reversa
- [ ] Agrupamento por dia funcional
- [ ] Filtros por tipo, actor e período
- [ ] Clique em evento com taskId abre o task detail
- [ ] SSE: novo evento aparece no topo sem reload
- [ ] Empty state: "No events yet. Start working on a task."

## Git

Commit: `feat(ui): add event timeline view with filters and SSE updates`
