---
title: "Implement SQLite derived state layer"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-L
estimated_hours: 12
actual_hours: 0
status: backlog
blockers: [TASK-001]
tags: [architecture, data-layer, mvp, 2.0]
related_files:
  - src/core/db.ts
  - src/types/index.ts
---

# Task: Implement SQLite Derived State Layer

## Objective

Criar `src/core/db.ts` — a camada SQLite que mantém o estado atual do projeto, derivado do `events.jsonl`. O banco é gitignored, reconstruível a qualquer momento, e consultável com queries estruturadas.

**Success:**
- [ ] Schema definido com tabelas tasks, comments, decisions
- [ ] `rebuild(events)` reconstrói o banco do zero a partir dos eventos
- [ ] Queries tipadas para os casos de uso do MCP
- [ ] O banco nunca é editado diretamente — só via rebuild ou apply

## Context

**Por quê:** Consultas no markdown atual (ex: "quais tasks bloqueadas?") exigem parsing de múltiplos arquivos. SQLite resolve isso com queries em milissegundos e permite que as ferramentas MCP entreguem respostas estruturadas à IA.

**Regra fundamental:** SQLite é sempre derivado. Se deletar `data.db`, o sistema reconstrói do `events.jsonl` sem perda. Nunca escrever no SQLite diretamente — sempre via `applyEvent()` ou `rebuild()`.

**Dependência:** TASK-001 (events.ts) deve estar concluída.

**Pacote:** `better-sqlite3` — síncrono, sem servidor, padrão do setor para ferramentas locais.

## Implementation

### Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,   -- TASK-001
  title       TEXT NOT NULL,
  task_type   TEXT NOT NULL,      -- feat, fix, chore
  status      TEXT NOT NULL,      -- backlog, in-progress, review, done, blocked
  priority    TEXT NOT NULL,      -- P1-S, P1-M, P1-L, P2-S, P2-M, P2-L, P3
  assignee    TEXT,               -- member id
  file_path   TEXT,               -- caminho relativo do .md
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  actor       TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  rationale   TEXT NOT NULL,
  task_id     TEXT,
  file_path   TEXT,
  actor       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events_log (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,     -- JSON original
  actor       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

### src/core/db.ts

```typescript
import Database from 'better-sqlite3'
import { join } from 'path'
import { AipimEvent } from '../types/index.js'

const DB_FILE = '.project/data.db'

export function openDb(projectRoot: string): Database.Database {
  return new Database(join(projectRoot, DB_FILE))
}

export function rebuild(projectRoot: string, events: AipimEvent[]): void {
  const db = openDb(projectRoot)
  db.pragma('journal_mode = WAL')

  // Drop e recria tabelas
  db.exec(`DROP TABLE IF EXISTS events_log`)
  db.exec(`DROP TABLE IF EXISTS comments`)
  db.exec(`DROP TABLE IF EXISTS decisions`)
  db.exec(`DROP TABLE IF EXISTS tasks`)
  db.exec(SCHEMA)

  // Aplica todos os eventos em ordem
  const applyStmt = db.transaction((events: AipimEvent[]) => {
    for (const event of events) applyEvent(db, event)
  })
  applyStmt(events)
  db.close()
}

export function applyEvent(db: Database.Database, event: AipimEvent): void {
  // Registra no log
  db.prepare(`
    INSERT OR IGNORE INTO events_log (id, type, payload, actor, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.id, event.type, JSON.stringify(event), event.actor, event.timestamp)

  // Aplica efeito no estado
  switch (event.type) {
    case 'task.created':
      db.prepare(`
        INSERT OR IGNORE INTO tasks (id, title, task_type, status, priority, file_path, created_at, updated_at)
        VALUES (?, ?, ?, 'backlog', ?, ?, ?, ?)
      `).run(event.taskId, event.title, event.taskType, event.priority, event.filePath, event.timestamp, event.timestamp)
      break

    case 'task.status_changed':
      db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`)
        .run(event.to, event.timestamp, event.taskId)
      break

    case 'task.assigned':
      db.prepare(`UPDATE tasks SET assignee = ?, updated_at = ? WHERE id = ?`)
        .run(event.assignee, event.timestamp, event.taskId)
      break

    case 'task.comment_added':
      db.prepare(`
        INSERT INTO comments (id, task_id, actor, text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(event.id, event.taskId, event.actor, event.text, event.timestamp)
      break

    case 'task.completed':
      db.prepare(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`)
        .run(event.timestamp, event.taskId)
      break

    case 'decision.logged':
      db.prepare(`
        INSERT INTO decisions (id, title, rationale, task_id, file_path, actor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.title, event.rationale, event.taskId ?? null, event.filePath ?? null, event.actor, event.timestamp)
      break
  }
}
```

### Queries tipadas

```typescript
export function queryTasks(db: Database.Database, filter?: {
  status?: string
  assignee?: string
  priority?: string
}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params: string[] = []
  if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status) }
  if (filter?.assignee) { sql += ' AND assignee = ?'; params.push(filter.assignee) }
  if (filter?.priority) { sql += ' AND priority LIKE ?'; params.push(filter.priority + '%') }
  sql += ' ORDER BY priority ASC, created_at ASC'
  return db.prepare(sql).all(...params)
}

export function getNextTask(db: Database.Database) {
  // Prioridade real: P1-S > P1-M > P1-L > P2-S > ... > P3
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'backlog'
    ORDER BY
      CASE SUBSTR(priority, 1, 2)
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        ELSE 4
      END,
      CASE SUBSTR(priority, 4, 1)
        WHEN 'S' THEN 1
        WHEN 'M' THEN 2
        WHEN 'L' THEN 3
        ELSE 4
      END,
      created_at ASC
    LIMIT 1
  `).get()
}

export function getBlockers(db: Database.Database) {
  return db.prepare(`
    SELECT * FROM tasks WHERE status = 'blocked' ORDER BY updated_at ASC
  `).all()
}
```

### .gitignore

```
.project/data.db
.project/data.db-wal
.project/data.db-shm
```

## Definition of Done

- [ ] `better-sqlite3` adicionado ao `package.json`
- [ ] Schema criado com as 4 tabelas
- [ ] `rebuild()` funciona do zero a partir de events[]
- [ ] `applyEvent()` cobre todos os 7 tipos de evento do TASK-001
- [ ] Queries: `queryTasks`, `getNextTask`, `getBlockers`, `getTask`
- [ ] `.gitignore` atualizado para ignorar `data.db*`
- [ ] Testes: rebuild de eventos sintéticos, queries com filtros
- [ ] Build e lint passam

## Git

Commit: `feat(core): implement SQLite derived state layer`
