---
session: 12
last_updated: 2026-08-12T18:30:00-03:00
active_branches: [feature/discovery]
blockers: []
next_action: "TASK-033: view de grafo de dependências na UI"
---

# Current State

Discovery entrou: o brainstorm virou uma fase que o projeto registra, em vez de uma conversa
que morre no chat. Quatro fases entregues numa sessão, cada uma com commit próprio. 478 testes
passando, lint e type-check limpos, UI buildando.

O diagnóstico que originou isso: o AIPIM **começa na task**. Ele assume que alguém já decidiu
o que fazer. A conversa que produziu a task, as alternativas descartadas, o porquê da
decomposição — tudo vivia fora do sistema. Três perdas concretas: ADR sem proveniência,
backlog sem genealogia, e brainstorm genérico cego ao read model.

Spec: `.project/docs/specs/2026-08-12-discovery-design.md`

# Active Work

Nada em progresso. Branch `feature/discovery` com 5 commits, ainda não mergeada.

# Recent Decisions

- **Changeset, não spec.** O artefato terminal de uma sessão é um *diff sobre o grafo* — tasks,
  arestas, decisões, docs. Isso faz concepção virar o caso degenerado de graça: projeto vazio é
  um changeset onde todo nó é insert e nenhuma aresta aponta pra fora. Nenhum branch no código.
- **Snapshot por turno, não eventos granulares.** O log é append-only, então guardar o estado
  destilado inteiro a cada turno dá histórico de versões de graça. Eventos granulares custariam
  ~750 linhas a mais e obrigariam o agente a fazer diff do próprio raciocínio. Custo real: 40%
  a mais que a alternativa mínima, não 150%.
- **Pular é cidadão de primeira classe e nunca silencioso.** Pergunta pulada vira premissa
  registrada com a decisão adotada. Ataca a fadiga de interrogatório sem custo de decisão às
  escuras — e a lista de premissas *é* a agenda de uma eventual retomada.
- **Invocação explícita, imposta por mecanismo.** A `description` da skill descreve invocação,
  não intenção. E changeset só existe dentro de sessão, sessão só nasce de `start_discovery` —
  o agente não tem onde pendurar uma proposta fora de discovery.
- **Aplicação reusa os eventos existentes.** Kanban, grafo e `get_next_task` funcionam sobre o
  resultado sem saber que discovery existe. `sessionId` em cada evento entrega metade da
  TASK-037 como efeito colateral.
- **JSON no read model** — ADR011. Precedente novo: documento de forma instável cujo interior
  ninguém consulta pode ser JSON. Não vale para entidades consultáveis.

# Next Steps

1. Mergear `feature/discovery` e decidir se sai como 2.4.0
2. TASK-033 — view de grafo na UI (P2-M, 6h) — `/api/graph` existe, nada consome
3. TASK-034 — evidência de verificação na UI (P2-M, 4h)
4. TASK-035 — métricas derivadas do log (P2-M, 6h) — desbloqueia TASK-036
5. TASK-036 — enxugar CLAUDE.md (P2-S, 3h) — ganhou material: o protocolo de brainstorm saiu
   da prosa e virou skill instalada
6. TASK-037 — proveniência (P3, **6h**, era 10h) — reescopada, sobra só a ponta de código

# Metrics

**Productivity:**
- Tasks completed this session: 4 fases de discovery
- Tests: 358 → 478 (+120)
- Estimativa: 19h planejadas em 4 fases (4+6+5+4)
- Velocity trend: ↗️

**Quality:**
- Lint: 0 warnings
- Type-check: limpo
- Bug latente corrigido: cache do `readEvents` servia parse velho quando um arquivo era
  recriado no mesmo tick (chaveava só por mtime, agora inode e size também)
