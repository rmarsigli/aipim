---
title: "Migration script: existing .md files → events.jsonl"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P1-M
estimated_hours: 6
actual_hours: 0
status: backlog
blockers: [TASK-001, TASK-002]
tags: [migration, compatibility, mvp, 2.0]
related_files:
  - src/core/migrator.ts
  - src/commands/migrate.ts
---

# Task: Migration Script — Existing Projects → 2.0

## Objective

Criar um migrador que converte projetos AIPIM existentes (apenas `.md` files) para a nova estrutura com `events.jsonl` + SQLite. A migração deve ser automática, não-destrutiva, e transparente para o usuário.

**Success:**
- [ ] Projetos existentes migram sem perda de dados
- [ ] `events.jsonl` gerado com eventos sintéticos a partir do frontmatter dos `.md`
- [ ] SQLite reconstruído da migração
- [ ] Arquivos `.md` originais permanecem intocados
- [ ] Migração idempotente (rodar duas vezes = mesmo resultado)

## Context

**Por quê:** Usuários do AIPIM 1.x têm `.project/backlog/*.md` e `.project/completed/*.md` sem nenhum `events.jsonl`. Sem migração, eles perdem todo o histórico ao atualizar. A migração gera eventos sintéticos a partir do que pode ser inferido do frontmatter.

**Quando roda:** Automaticamente na primeira execução de `aipim mcp start` se `events.jsonl` não existir. Também disponível como `aipim migrate` para rodar manualmente.

**Dependências:** TASK-001 e TASK-002 devem estar concluídas.

## Implementation

### Lógica de migração (src/core/migrator.ts)

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { appendEvent, readEvents } from './events.js'
import { rebuild } from './db.js'

interface MigrationResult {
  tasksFound: number
  eventsGenerated: number
  skipped: number
}

export async function migrate(projectRoot: string): Promise<MigrationResult> {
  const eventsFile = join(projectRoot, '.project/events.jsonl')

  // Idempotência: se já migrou, não refaz
  if (existsSync(eventsFile)) {
    const existing = readEvents(projectRoot)
    if (existing.length > 0) {
      return { tasksFound: 0, eventsGenerated: 0, skipped: existing.length }
    }
  }

  const events: ReturnType<typeof appendEvent>[] = []
  let tasksFound = 0

  // Migrar backlog
  const backlogDir = join(projectRoot, '.project/backlog')
  if (existsSync(backlogDir)) {
    for (const file of readdirSync(backlogDir).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join(backlogDir, file), 'utf8')
      const { data: fm } = matter(content)
      const taskId = extractTaskId(file)
      if (!taskId) continue

      tasksFound++

      // task.created — do frontmatter
      events.push(appendEvent(projectRoot, {
        type: 'task.created',
        taskId,
        title: fm.title ?? file,
        taskType: extractTaskType(file),
        priority: fm.priority ?? 'P3',
        filePath: `.project/backlog/${file}`,
      }))

      // task.assigned — se tiver no frontmatter
      if (fm.assignee) {
        events.push(appendEvent(projectRoot, {
          type: 'task.assigned',
          taskId,
          assignee: fm.assignee,
        }))
      }
    }
  }

  // Migrar completed
  const completedDir = join(projectRoot, '.project/completed')
  if (existsSync(completedDir)) {
    for (const file of readdirSync(completedDir).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join(completedDir, file), 'utf8')
      const { data: fm } = matter(content)
      const taskId = extractTaskId(file)
      if (!taskId) continue

      tasksFound++

      events.push(appendEvent(projectRoot, {
        type: 'task.created',
        taskId,
        title: fm.title ?? file,
        taskType: extractTaskType(file),
        priority: fm.priority ?? 'P3',
        filePath: `.project/completed/${file}`,
      }))

      events.push(appendEvent(projectRoot, {
        type: 'task.completed',
        taskId,
        notes: 'Migrated from completed/ directory',
        actualHours: fm.actual_hours,
      }))
    }
  }

  // Rebuild SQLite
  rebuild(projectRoot, readEvents(projectRoot))

  return { tasksFound, eventsGenerated: events.length, skipped: 0 }
}

function extractTaskId(filename: string): string | null {
  // "2026-01-25-TASK-001-name.md" → "TASK-001"
  // "2026-01-25-T001-name.md" → "TASK-001"
  const match = filename.match(/TASK-(\d+)|T(\d+)/i)
  if (!match) return null
  const num = (match[1] ?? match[2]).padStart(3, '0')
  return `TASK-${num}`
}

function extractTaskType(filename: string): string {
  if (filename.includes('feat')) return 'feat'
  if (filename.includes('fix')) return 'fix'
  if (filename.includes('chore')) return 'chore'
  return 'feat'
}
```

### Comando CLI (src/commands/migrate.ts)

```typescript
export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Migrate existing AIPIM 1.x project to 2.0 (events + SQLite)')
    .option('--dry-run', 'Show what would be migrated without writing')
    .action(async (opts) => {
      logger.info('Scanning existing project...')
      const result = await migrate(process.cwd(), opts.dryRun)
      logger.success(`Migrated ${result.tasksFound} tasks → ${result.eventsGenerated} events`)
      if (result.skipped > 0) logger.info(`Already migrated: ${result.skipped} events preserved`)
    })
}
```

## Definition of Done

- [ ] `gray-matter` disponível (já existe no package.json)
- [ ] `migrate()` funciona para projetos com backlog/ e completed/ existentes
- [ ] Idempotente: rodar duas vezes não duplica eventos
- [ ] `aipim migrate` CLI command registrado
- [ ] `aipim mcp start` chama migrate automaticamente se necessário
- [ ] Testes com fixtures de projetos 1.x sintéticos
- [ ] Log claro: quantas tasks encontradas, quantos eventos gerados

## Git

Commit: `feat(core): add 1.x to 2.0 migration for events.jsonl`
