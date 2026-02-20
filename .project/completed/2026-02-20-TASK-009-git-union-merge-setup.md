---
title: "Git union merge driver — collaboration without conflicts"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P2-S
estimated_hours: 3
actual_hours: 0
status: backlog
blockers: [TASK-001]
tags: [git, collaboration, team]
related_files:
  - src/templates/base/.gitattributes
  - src/core/installer.ts
---

# Task: Git Union Merge Driver for events.jsonl

## Objective

Configurar o `merge=union` driver do git para o `events.jsonl` — garantindo que merges de equipe nunca gerem conflito no event log. Quando dois devs adicionam eventos simultaneamente e fazem merge, o git concatena os dois automaticamente.

**Success:**
- [ ] `.gitattributes` gerado pelo `aipim install` com a configuração correta
- [ ] Usuários existentes podem adicionar manualmente com `aipim team setup-git`
- [ ] Documentação clara de por que isso é necessário

## Context

**Por quê:** Sem o union merge driver, dois devs que adicionam eventos ao mesmo tempo vão gerar um conflito de merge no `events.jsonl`. Com o driver, o git mantém os dois conjuntos de linhas automaticamente — sempre correto para um log append-only.

**Como funciona:**
```
Dev A faz push: evt_100
Dev B faz push: evt_101 (rejeitado, não está up to date)
Dev B faz pull: git usa union merge → mantém evt_100 + evt_101
Dev B faz push: sucesso, ambos os eventos preservados
```

**Por que é seguro:** O event log é append-only por design. Nunca há um caso onde descartar eventos de um lado seja correto. O union merge é matematicamente correto para esse padrão.

## Implementation

### .gitattributes (adicionado ao template do install)

```gitattributes
# AIPIM: prevent merge conflicts in event log
# The union driver keeps all lines from both sides — always correct for append-only logs
.project/events.jsonl merge=union
```

### Integrar no installer (src/core/installer.ts)

```typescript
// Na função installProject(), adicionar .gitattributes ao projeto
const gitattributesPath = join(projectRoot, '.gitattributes')
const gitattributesLine = '\n# AIPIM\n.project/events.jsonl merge=union\n'

if (existsSync(gitattributesPath)) {
  const current = readFileSync(gitattributesPath, 'utf8')
  if (!current.includes('events.jsonl merge=union')) {
    appendFileSync(gitattributesPath, gitattributesLine)
  }
} else {
  writeFileSync(gitattributesPath, gitattributesLine.trimStart())
}
```

### Comando para projetos existentes

```bash
aipim team setup-git
# Adiciona .gitattributes se não existir
# Informa o usuário do que foi feito e por quê
```

## Definition of Done

- [ ] `.gitattributes` com `merge=union` gerado pelo `aipim install`
- [ ] Não sobrescreve `.gitattributes` existente — só adiciona a linha
- [ ] `aipim team setup-git` para projetos migrados
- [ ] Teste: simular merge com dois eventos adicionados e verificar que ambos ficam

## Git

Commit: `feat(team): configure git union merge driver for events.jsonl`
