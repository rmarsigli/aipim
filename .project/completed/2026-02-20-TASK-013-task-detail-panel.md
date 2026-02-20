---
title: "Svelte UI — Task detail panel with inline markdown editing"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-L
estimated_hours: 12
actual_hours: 0
status: backlog
blockers: [TASK-012]
tags: [ui, frontend, editor]
related_files:
  - ui/src/routes/Task.svelte
  - ui/src/components/MarkdownEditor.svelte
  - ui/src/components/CommentThread.svelte
---

# Task: Task Detail Panel

## Objective

View de detalhe de uma task: exibe o conteúdo do `.md`, permite edição inline, mostra histórico de eventos e thread de comentários.

**Success:**
- [ ] Renderiza o markdown completo da task
- [ ] Modo de edição com preview (toggle view/edit)
- [ ] Salvar → `POST /api/events` com `task.content_updated` + escreve no `.md`
- [ ] Thread de comentários com input e submit
- [ ] Timeline de eventos da task (quando criou, quem mudou status, etc.)
- [ ] Header com metadata: status, prioridade, assignee, tipo

## Layout

```
┌─ TASK-003 — Auth System ─────────────────────────────────[Edit]─┐
│  Status: in-progress   Priority: P1-M   Assignee: @rmarsigli    │
│  Type: feat            Created: 2026-02-10   Branch: feat/auth  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ## Objetivo                                                     │
│  Implementar autenticação JWT com refresh token automático...    │
│                                                                  │
│  ## Critérios de Aceite                                          │
│  - [x] Login com email/senha                                     │
│  - [ ] Refresh token                                             │
│  - [ ] Logout em todos os dispositivos                           │
│                                                                  │
├─ Comments ───────────────────────────────────────────────────────┤
│  @ana · 2h ago                                                   │
│  "Revisei o fluxo de refresh token, tem edge case no logout..."  │
│                                                                  │
│  [Add a comment...]                              [Send]          │
├─ History ────────────────────────────────────────────────────────┤
│  2026-02-15 · @rmarsigli · Status: backlog → in-progress        │
│  2026-02-10 · @rmarsigli · Task created                         │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation

```svelte
<!-- ui/src/routes/Task.svelte -->
<script>
  let { params } = $props()
  let task = $state(null)
  let editing = $state(false)
  let editContent = $state('')
  let newComment = $state('')

  onMount(async () => {
    const res = await fetch(`/api/tasks/${params.id}`)
    task = await res.json()
    editContent = task.content
  })

  async function saveContent() {
    await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify({ type: 'task.content_updated', taskId: task.id })
    })
    // Escreve o .md via endpoint dedicado
    await fetch(`/api/tasks/${task.id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content: editContent })
    })
    task.content = editContent
    editing = false
  }

  async function submitComment() {
    if (!newComment.trim()) return
    await fetch('/api/events', {
      method: 'POST',
      body: JSON.stringify({ type: 'task.comment_added', taskId: task.id, text: newComment })
    })
    task.comments = [...task.comments, { text: newComment, actor: 'me', created_at: new Date().toISOString() }]
    newComment = ''
  }
</script>

{#if task}
  <div class="task-detail">
    <header>
      <h1>{task.id} — {task.title}</h1>
      <div class="meta">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <span>@{task.assignee ?? 'unassigned'}</span>
      </div>
      <button onclick={() => editing = !editing}>
        {editing ? 'Cancel' : 'Edit'}
      </button>
    </header>

    {#if editing}
      <textarea bind:value={editContent} class="editor" />
      <button onclick={saveContent}>Save</button>
    {:else}
      <MarkdownRenderer content={task.content} />
    {/if}

    <CommentThread comments={task.comments} on:submit={({ detail }) => submitComment(detail)} />

    <EventHistory events={task.events} />
  </div>
{/if}
```

## Libraries

- `marked` ou `@svelteness/markdown` para render do markdown
- Sem editor pesado (CodeMirror é opcional para v2) — `<textarea>` com preview é suficiente para MVP da UI

## Definition of Done

- [ ] Rota `/ui/task/:id` funcional
- [ ] Markdown renderizado corretamente
- [ ] Toggle view/edit funcional
- [ ] Salvar escreve no `.md` e emite evento
- [ ] Thread de comentários funcional
- [ ] Histórico de eventos da task visível
- [ ] Back button para Kanban

## Git

Commit: `feat(ui): add task detail view with markdown editing and comment thread`
