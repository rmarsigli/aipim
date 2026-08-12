---
session: 11
last_updated: 2026-08-12T00:00:00-03:00
active_branches: [feature/loop-and-graph]
blockers: []
next_action: "TASK-033: view de grafo de dependências na UI"
---

# Current State

AIPIM 2.3: o event log deixou de ser só registro e virou mecanismo de
controle. Três peças entraram — gate de verificação, grafo de dependências no read model, e
hooks do Claude Code. 358 testes passando, lint e type-check limpos.

O ponto de partida foi uma revisão do projeto contra o que hoje se chama *loop engineering*
(o loop gather → act → **verify** → repeat mora no harness, não no prompt) e *graph
engineering* (modelar execução como grafo). O diagnóstico: o AIPIM tinha ~21KB de regras
MANDATORY em prosa no CLAUDE.md que nenhum código impunha, e dependências eram cidadão de
primeira classe nos tipos mas inexistentes no read model.

# Active Work

Nada em progresso. TASK-032 concluída passando pelo próprio gate (`verify_task` → `complete_task`
via servidor MCP real). Restam TASK-033 a TASK-037.

# Recent Decisions

- **Gate de verificação** — `[checks] commands` em `config.toml`. `complete_task` é recusado a
  menos que cada comando tenha um `check.run` com `passed=true` posterior à última alteração da
  task. Sem checks configurados o gate é no-op (compatível com projetos existentes).
  `force: true` libera, mas grava `checksBypassed` no evento — bypass auditável, não invisível.
- **Grafo no read model** — tabela `task_dependencies` alimentada por
  `task.dependency_added/removed`, que antes caíam no `default: break` do `applyEvent`.
  `get_next_task` passou a devolver a *fronteira pronta*: nunca uma task bloqueada.
  Ciclos rejeitados na escrita (`add_dependency`) por alcançabilidade, e detectados na leitura.
- **Hooks em vez de prosa** — `SessionStart` injeta estado do projeto, `Stop` verifica trabalho
  em progresso. Bloquear no `Stop` é opt-in (`[hooks] block_on_unverified`) porque hook que
  briga com o usuário é pior que hook que não faz nada.
- **CLI e MCP unificados** — `aipim task next` lia markdown e podia devolver task bloqueada.
  Agora compartilha `getNextReadyTask` com o `get_next_task`; os dois não têm como discordar.
- **`src/utils/dependencies.ts` deletado** — parser de frontmatter escrito à mão com casamento
  difuso de ID (`key.includes(id)` casava TASK-1 com TASK-10). Substituído por `core/graph.ts`
  sobre eventos. O migrator converte `depends_on:` legado em eventos de dependência.

ADR: `.project/decisions/2026-08-12-ADR010-loop-and-graph-engineering.md`

# Next Steps

1. TASK-033 — view de grafo na UI (P2-M, 6h) — `/api/graph` já existe, nada consome
2. TASK-034 — evidência de verificação na UI (P2-M, 4h)
3. TASK-035 — métricas derivadas do log (P2-M, 6h) — desbloqueia TASK-036
4. TASK-036 — enxugar CLAUDE.md (P2-S, 3h) — bloqueada por TASK-035
5. TASK-037 — grafo de proveniência ADR ↔ task ↔ arquivo ↔ commit (P3, 10h)

# Metrics

**Productivity:**
- Tasks completed this session: 4 (gate, grafo, hooks, TASK-032)
- Tests: 260 → 358 (+98)
- Velocity trend: → (primeira sessão desde 2026-03-19)

**Quality:**
- Lint warnings: 0
- Type errors: 0
- Módulos legados removidos: 2 (`utils/dependencies.ts`, parsing de markdown em `task next`)
- Estimate accuracy TASK-032: 0.75 (1.5h real / 2h estimado)
