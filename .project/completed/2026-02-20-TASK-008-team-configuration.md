---
title: "Team configuration — config.toml + identity resolution"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-M
estimated_hours: 8
actual_hours: 0
status: backlog
blockers: [TASK-004]
tags: [team, configuration, collaboration]
related_files:
  - src/core/team.ts
  - src/commands/team.ts
  - src/templates/base/.project/config.toml
---

# Task: Team Configuration

## Objective

Adicionar suporte a times via `config.toml`. O AIPIM precisa saber quem são os membros do time e quem é o usuário atual na máquina — sem perguntar, automaticamente, via `git config`.

**Success:**
- [ ] `config.toml` com schema de projeto e membros
- [ ] Identity resolution: `AIPIM_USER` > `git config user.email` > anônimo
- [ ] CLI `aipim team add/list` para gerenciar membros
- [ ] Todos os eventos passam a incluir `actor` resolvido
- [ ] MCP tools de assignment funcionais

## Implementation

### config.toml template

```toml
[project]
name = "MyApp"
description = "Descrição do projeto"

[[team]]
id = "rmarsigli"
name = "Rafhael Marsigli"
email = "oi@rafhael.com.br"
role = "tech-lead"
areas = ["backend", "architecture"]

[[team]]
id = "joao"
name = "João Silva"
email = "joao@empresa.com"
role = "dev"
areas = ["frontend"]
```

### src/core/team.ts

```typescript
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import TOML from 'smol-toml'  // ou @iarna/toml

export interface TeamMember {
  id: string
  name: string
  email: string
  role?: string
  areas?: string[]
}

export interface ProjectConfig {
  project: { name: string; description?: string }
  team: TeamMember[]
}

export function loadConfig(projectRoot: string): ProjectConfig | null {
  const configPath = join(projectRoot, '.project/config.toml')
  if (!existsSync(configPath)) return null
  return TOML.parse(readFileSync(configPath, 'utf8')) as ProjectConfig
}

export function resolveActor(projectRoot: string): string {
  // 1. Variável de ambiente
  if (process.env.AIPIM_USER) return process.env.AIPIM_USER

  // 2. git config user.email → bate com config.toml
  try {
    const { execSync } = require('child_process')
    const email = execSync('git config user.email', { encoding: 'utf8' }).trim()
    const config = loadConfig(projectRoot)
    const member = config?.team.find(m => m.email === email)
    if (member) return member.id
    return email  // fallback: usa o email direto
  } catch {
    return 'unknown'
  }
}

export function getMember(projectRoot: string, id: string): TeamMember | null {
  const config = loadConfig(projectRoot)
  return config?.team.find(m => m.id === id) ?? null
}
```

### Comandos CLI

```bash
aipim team list          # lista membros do config.toml
aipim team add           # wizard interativo para adicionar membro
aipim team whoami        # mostra quem é o usuário atual
```

## Definition of Done

- [ ] `smol-toml` (ou `@iarna/toml`) no package.json
- [ ] `src/core/team.ts` com `loadConfig`, `resolveActor`, `getMember`
- [ ] Template `config.toml` adicionado ao `aipim install`
- [ ] `resolveActor()` integrado em `appendEvent()` do TASK-001
- [ ] CLI `aipim team list/add/whoami`
- [ ] MCP tool `assign_task` adicionado ao write tools
- [ ] Sem config.toml → funciona como solo dev (actor = git email)

## Git

Commit: `feat(team): add config.toml, identity resolution, and team CLI commands`
