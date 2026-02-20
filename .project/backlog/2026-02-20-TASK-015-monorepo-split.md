---
title: "Monorepo split — pnpm workspaces (@aipim/core, @aipim/mcp, @aipim/ui)"
created: 2026-02-20T00:00:00-03:00
last_updated: 2026-02-20T00:00:00-03:00
priority: P3
estimated_hours: 10
actual_hours: 0
status: backlog
blockers: [TASK-014]
tags: [architecture, monorepo, maintenance]
related_files:
  - pnpm-workspace.yaml
  - packages/core/package.json
  - packages/mcp/package.json
  - packages/ui/package.json
---

# Task: Monorepo Split

## Objective

Separar o AIPIM em um monorepo com 3 pacotes independentes usando pnpm workspaces. Esta task só faz sentido quando os três pacotes têm usuários e casos de uso distintos — não fazer antes.

**Gatilho para fazer esta task:** Pelo menos um desses cenários for verdadeiro:
- Existe demanda por usar `@aipim/mcp` sem o CLI
- Existe demanda por usar `@aipim/ui` com outro servidor que não o Hono
- O bundle do `aipim` npm package ficou grande demais (> 10MB) por incluir a UI
- Contribuidores externos trabalham especificamente numa das partes

**Success:**
- [ ] 3 pacotes no npm: `@aipim/core`, `@aipim/mcp`, `@aipim/ui`
- [ ] `aipim` (meta-package) instala `@aipim/core` + `@aipim/mcp`
- [ ] `@aipim/ui` é instalado sob demanda pelo `aipim ui` quando não presente
- [ ] Build de cada pacote independente
- [ ] Nenhuma funcionalidade quebrada

## Estrutura alvo

```
aipim/
├── packages/
│   ├── core/                  ← @aipim/core
│   │   ├── src/
│   │   │   ├── cli/           ← comandos existentes
│   │   │   ├── core/          ← events.ts, db.ts, migrator.ts, team.ts
│   │   │   └── types/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   │
│   ├── mcp/                   ← @aipim/mcp
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── api.ts
│   │   │   └── tools/
│   │   ├── package.json       ← depende de @aipim/core
│   │   └── tsup.config.ts
│   │
│   └── ui/                    ← @aipim/ui
│       ├── src/               ← Svelte components
│       ├── package.json       ← depende de @aipim/core
│       └── vite.config.ts
│
├── pnpm-workspace.yaml
├── turbo.json                 ← opcional, para build em paralelo
└── package.json               ← scripts globais
```

## pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

## Lazy install do UI

```typescript
// Quando usuário roda `aipim ui` e @aipim/ui não está instalado:
const { execSync } = require('child_process')

async function ensureUiInstalled() {
  try {
    require.resolve('@aipim/ui')
  } catch {
    logger.info('@aipim/ui not installed. Installing...')
    execSync('npm install -g @aipim/ui', { stdio: 'inherit' })
  }
}
```

## Migration de pacote único para monorepo

1. Criar `packages/core/` e mover `src/` existente
2. Criar `packages/mcp/` e mover `src/mcp/`
3. Criar `packages/ui/` e mover `ui/`
4. Atualizar imports internos (`@aipim/core` no lugar de `../../core/`)
5. Configurar pnpm workspaces para link local
6. Atualizar scripts de build no root
7. Testar build completo e publicação

## Definition of Done

- [ ] `pnpm install` na raiz instala tudo corretamente
- [ ] `pnpm run build` builda os 3 pacotes na ordem certa
- [ ] `@aipim/core` publicável e sem dependências circulares
- [ ] `@aipim/mcp` importa `@aipim/core` via workspace link
- [ ] `aipim ui` detecta ausência de `@aipim/ui` e oferece instalar
- [ ] Nenhuma funcionalidade quebrada (rodar test suite completo)

## Aviso

Esta é a última tarefa da lista. Se você chegou aqui, o AIPIM 2.0 está completo e funcionando. Faça essa separação somente se houver motivo claro — complexidade de manutenção tem custo real.

## Git

Commit: `refactor: split into monorepo with @aipim/core, @aipim/mcp, @aipim/ui`
