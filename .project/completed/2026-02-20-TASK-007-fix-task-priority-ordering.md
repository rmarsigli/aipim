---
title: "Fix task next — priority ordering instead of alphabetical"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-S
estimated_hours: 2
actual_hours: 0
status: backlog
blockers: [TASK-002]
tags: [bug, ux, mvp, 2.0]
related_files:
  - src/commands/task.ts
---

# Task: Fix `task next` — Priority Ordering

## Objective

O `aipim task next` atual ordena tasks **alfabeticamente por nome de arquivo**. Um `TASK-001-P3-nice-to-have` sempre vem antes de `TASK-099-P1-S-critical`. Isso é um bug funcional no coração da ferramenta.

**Success:**
- [ ] `task next` retorna a task de maior prioridade real no backlog
- [ ] Ordem: P1-S > P1-M > P1-L > P2-S > P2-M > P2-L > P3
- [ ] Empate de prioridade: mais antiga primeiro (created_at)
- [ ] Após TASK-002 (SQLite), usa query. Antes, fallback por frontmatter.

## Context

**Código atual com bug (src/commands/task.ts:64-73):**
```typescript
const backlogFiles = readdirSync(backlogDir)
    .filter((f) => f.endsWith('.md'))
    .sort()  // ← BUG: alfabético, não por prioridade
const nextTaskFile = backlogFiles[0]
```

**Fix com SQLite (pós TASK-002):**
```typescript
// Usa getNextTask() do db.ts que já tem a query com ORDER BY prioridade correta
const db = openDb(projectRoot)
const nextTask = getNextTask(db)
db.close()
```

**Fix sem SQLite (se esta task rodar antes do TASK-002):**
```typescript
// Parse frontmatter de cada .md, ordena por priority field
const tasks = backlogFiles.map(f => {
  const content = readFileSync(join(backlogDir, f), 'utf8')
  const { data } = matter(content)
  return { file: f, priority: data.priority ?? 'P3', created: data.created ?? f }
})

const priorityOrder = { 'P1-S': 1, 'P1-M': 2, 'P1-L': 3, 'P2-S': 4, 'P2-M': 5, 'P2-L': 6, 'P3': 7 }
tasks.sort((a, b) => {
  const pa = priorityOrder[a.priority] ?? 8
  const pb = priorityOrder[b.priority] ?? 8
  if (pa !== pb) return pa - pb
  return a.created.localeCompare(b.created)
})
const nextTaskFile = tasks[0]?.file
```

## Definition of Done

- [ ] `aipim task next` retorna a task de maior prioridade
- [ ] Testes: backlog com P1-S e P3 → P1-S é retornada
- [ ] Testes: empate de prioridade → mais antiga primeiro
- [ ] Testes: backlog vazio → mensagem correta

## Git

Commit: `fix(task): order next task by real priority instead of filename`
