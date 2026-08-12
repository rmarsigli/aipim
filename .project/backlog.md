# Backlog

> AIPIM 2.2 — o event log como mecanismo de controle, não só como registro.

## Roadmap

**2.0** — Tasks 001–015: reescrita event-sourced (JSONL + SQLite + MCP + Svelte UI) — ✅
**2.1** — Skills como módulos de contexto + Active Skills (MCP) + Laravel Boost — ✅
**2.2** — Loop & graph: gate de verificação, grafo de dependências, hooks — 🔄 em andamento

### Entregue em 2.2

| Peça | Descrição |
|---|---|
| Gate de verificação | `check.run` events, `verify_task`, `complete_task` recusado sem evidência verde |
| Grafo de dependências | tabela `task_dependencies`, `add_dependency`/`remove_dependency`/`get_task_graph`, fronteira pronta em `get_next_task`, ciclos rejeitados |
| Hooks | `SessionStart` injeta estado, `Stop` checa trabalho não verificado, `aipim hook install` |

---

## Tasks

| ID | Type | Task | Status | Priority | Est. |
|---|---|---|---|---|---|
| TASK-032 | refactor | Unificar `aipim task next` com a fronteira pronta | backlog | P1-S | 2h |
| TASK-033 | feat | View de grafo de dependências na UI | backlog | P2-M | 6h |
| TASK-034 | feat | Evidência de verificação na timeline e no detalhe da task | backlog | P2-M | 4h |
| TASK-035 | feat | Métricas derivadas do event log (`get_metrics`) | backlog | P2-M | 6h |
| TASK-036 | docs | Enxugar CLAUDE.md para o que o harness não impõe | blocked | P2-S | 3h |
| TASK-037 | feat | Grafo de proveniência: ADR ↔ task ↔ arquivo ↔ commit | backlog | P3 | 10h |
| TASK-015 | docs | Improve Documentation Structure | blocked | P2-M | — |

---

## Dependências

```
TASK-035 (métricas)
  └── TASK-036 (enxugar CLAUDE.md — precisa do get_metrics para substituir a seção de métricas)

TASK-032, TASK-033, TASK-034, TASK-037 — independentes, podem ir em paralelo
```

Fonte de verdade: `events.jsonl`. Rode `aipim deps` para o grafo atual.

---

## Contexto da fase 2.2

A revisão que originou estas tasks partiu de duas ideias que ganharam nome em 2026:

- **Loop engineering** — o loop de um agente (gather → act → **verify** → repeat) pertence ao
  harness, não ao prompt. O AIPIM já era o harness; só não exercia o papel. O gate de
  verificação é o ponto de estrangulamento onde isso passa a valer.
- **Graph engineering** — modelar execução como grafo: o que pode rodar agora, o que espera o
  quê. Sem grafo não dá para saber o que é paralelizável nem para despachar subagentes com
  segurança.

Decisão explícita de escopo: **o AIPIM não vira LangGraph**. Ele não orquestra o loop do
agente; é a memória persistente e a camada de governança em volta de qualquer loop.

Da mesma forma, não vamos indexar estrutura de código (call graph, símbolos) — essa categoria
já é disputada. O diferencial do AIPIM é intenção e proveniência: *por que* o código está
assim, qual decisão o governa. É o que TASK-037 ataca.
