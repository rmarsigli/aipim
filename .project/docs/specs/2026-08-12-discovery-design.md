# Discovery — brainstorm como fase de primeira classe

**Data:** 2026-08-12
**Status:** proposto
**Estimativa:** 19h, 4 fases
**Escreve em:** `src/core/discovery.ts`, `src/core/db.ts`, `src/mcp/tools/`, `src/core/installer.ts`, `ui/`

---

## 1. Problema

O AIPIM começa na task. Ele assume que alguém já decidiu o que fazer. Tudo que vem antes — a
conversa que produziu a task, as alternativas descartadas, o porquê da decomposição — vive fora
do sistema: no chat, que morre; ou num spec em `docs/`, que o event log não conhece.

Três perdas concretas:

1. **ADR sem proveniência.** `log_decision` grava título e rationale. A decisão nasceu de um
   diálogo com alternativas comparadas, mas só o veredito sobrevive. Seis meses depois ninguém
   sabe o que foi *rejeitado*, que é metade do valor de um ADR.
2. **Backlog sem genealogia.** `create_task` cria TASK-033 do nada. Não há vínculo com a
   discussão que a originou. É a dor que a TASK-037 descreve.
3. **Brainstorm genérico é cego.** Uma skill de brainstorm externa explora o projeto lendo
   arquivos e `git log`. O AIPIM tem o grafo inteiro no read model: tasks, ADRs, dependências,
   o que está bloqueado, o que já foi tentado. Um brainstorm com acesso a isso consegue dizer
   "isso colide com o ADR010" ou "isso já é a TASK-035".

## 2. Solução em uma frase

Uma **sessão de discovery** acumula um **estado destilado** através da conversa e termina
produzindo um **changeset** — um diff proposto sobre o grafo do projeto — que só é aplicado
mediante aprovação explícita, e cuja aplicação reusa os eventos de escrita já existentes.

## 3. Restrições de projeto

**R1 — Invocação explícita apenas.** Discovery nunca dispara sozinho. A `description` da skill
instalada descreve invocação explícita, não intenção ("use when the user wants to build a
feature" é exatamente o que faz uma skill auto-disparar). O hook `SessionStart` pode *reportar*
sessão aberta, nunca *entrar* nela. E a regra é mecanismo, não prosa: `propose_changeset` só
aceita proposta dentro de uma sessão, e sessão só nasce de `start_discovery` — o agente não tem
onde pendurar uma proposta fora de discovery mesmo que queira.

**R2 — Concepção e ideação contínua compartilham o código.** A diferença vive em um passo de
grounding que degenera sozinho: projeto vazio devolve nada e a conversa vira invenção; projeto
vivo devolve colisões e a conversa vira reconciliação. Não há branch.

**R3 — Pular é cidadão de primeira classe, e nunca silencioso.** O usuário pode não responder
qualquer pergunta. Pular emite uma **premissa registrada**: `{ pergunta, premissa_adotada,
crítica }`. Nada é decidido às escuras, e o usuário não paga fadiga de interrogatório.

**R4 — Aplicação reusa os eventos existentes.** Aplicar um changeset emite `task.created`,
`task.dependency_added`, `decision.logged`. Nenhum caminho de escrita paralelo, nenhum read
model paralelo. Kanban, `get_next_task` e o grafo funcionam sobre o resultado sem saber que
discovery existe.

## 4. Arquitetura

### 4.1 Ciclo de vida da sessão

```
open ──────► proposed ──┬──► applied     (terminal)
  ▲              │      └──► abandoned   (terminal)
  └──────────────┘
    revision_requested
```

`open` acumula entendimento. `proposed` tem um changeset anexado esperando resolução, e pode
voltar a `open` se o usuário pedir revisão. Nenhum estado é editado: cada transição é um evento.

Múltiplas sessões abertas em paralelo são permitidas. São baratas, e limitar a uma cria um modo
de falha ("preciso fechar aquilo pra pensar nisso") sem comprar nada.

### 4.2 Estado destilado

Reescrito por inteiro a cada turno relevante. É o que `get_discovery_state` devolve para um
agente sem nenhum contexto de chat.

```ts
interface DiscoveryState {
    problem: string              // o problema em prosa curta
    agreements: Agreement[]      // { statement, rationale }
    alternatives: Alternative[]  // { option, rejectedBecause }
    assumptions: Assumption[]    // { question, assumed, critical }
    grounding: GroundingRef[]    // { kind: 'task'|'decision', id, relation: 'overlaps'|'conflicts'|'supersedes' }
    openThreads: string[]        // fios que o agente ainda pretende puxar
}
```

`assumptions` é perguntas puladas; `openThreads` é perguntas ainda não feitas. A distinção
importa: `assumptions` alimenta o output (as premissas do ADR gerado) e é a agenda de uma
eventual retomada. `openThreads` é rascunho do agente.

Snapshot inteiro em vez de eventos granulares por nota porque o event log já é append-only —
guardar o estado completo a cada turno dá histórico de versões de graça, e eventos granulares
não compram nenhuma query que alguém realmente faça. Também casa com como o agente opera: ele
re-deriva o estado inteiro a cada turno de qualquer forma; obrigá-lo a fazer diff do próprio
raciocínio seria trabalho artificial.

### 4.3 Changeset

Não é um documento. É um conjunto de mutações propostas sobre o grafo.

```ts
interface Changeset {
    tasks: ProposedTask[]        // { localId: '#1', title, taskType, priority, estimatedHours, description }
    dependencies: ProposedDep[]  // { taskRef, dependsOnRef } — ref = '#1' (local) ou 'TASK-035' (existente)
    decisions: ProposedDecision[]// { title, rationale }
    supersedes: string[]         // ids de decisões existentes a marcar como superseded
    docs: ProposedDoc[]          // { path, content }
}
```

### 4.4 Aplicação

Atômica e por fan-out. Ordem: aloca ids das tasks → `task.created` ×N → `task.dependency_added`
×M → `decision.logged` ×K → escreve docs → `discovery.resolved`.

Todos os eventos carregam `sessionId`. **É essa a proveniência ADR ↔ task ↔ sessão que a
TASK-037 pede** — obtida como efeito colateral, não como feature separada.

Atomicidade exige uma adição a `events.ts`: `appendEvents(projectRoot, partials[])`, que escreve
o lote inteiro sob uma única tomada do lock por projeto. Sem isso, uma escrita concorrente pode
se intercalar no meio de um changeset e deixar o log com meio changeset aplicado.

Alocação de ids no lote: `nextTaskId` lê o máximo do read model, então N tasks precisam de
alocação sequencial em memória (`max+1 … max+N`) antes de qualquer escrita, não uma chamada por
task.

## 5. Modelo de dados

### 5.1 Tipos de evento (4 novos)

| Evento | Payload |
|---|---|
| `discovery.started` | `sessionId`, `topic` |
| `discovery.state_updated` | `sessionId`, `state` |
| `discovery.changeset_proposed` | `sessionId`, `changesetId`, `changeset` |
| `discovery.resolved` | `sessionId`, `changesetId?`, `resolution`, `validatorsBypassed?` |

`resolution: 'applied' | 'abandoned' | 'revision_requested'`.

Aprovação e aplicação são o mesmo evento, deliberadamente. Se os validadores reprovarem, a tool
recusa e nada é gravado — igual ao `complete_task` de hoje recusando sem evidência. Não existe
estado "aprovado mas não aplicado" para alguém esquecer.

`BaseEvent` ganha `sessionId?: string`, opcional, para que qualquer evento possa ser atribuído a
uma sessão.

### 5.2 Tabelas (3 novas + 1 coluna)

```sql
CREATE TABLE IF NOT EXISTS discovery_sessions (
    id         TEXT PRIMARY KEY,
    topic      TEXT NOT NULL,
    status     TEXT NOT NULL,          -- open | proposed | applied | abandoned
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    actor      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_states (
    session_id TEXT NOT NULL,
    version    INTEGER NOT NULL,
    state      TEXT NOT NULL,          -- JSON
    created_at TEXT NOT NULL,
    PRIMARY KEY (session_id, version)
);

CREATE TABLE IF NOT EXISTS changesets (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    payload     TEXT NOT NULL,         -- JSON
    status      TEXT NOT NULL,         -- proposed | applied | abandoned | superseded
                                       -- superseded: revision_requested gerou um changeset novo
                                       -- na mesma sessão; o anterior fica no log, fora de jogo
    proposed_at TEXT NOT NULL,
    resolved_at TEXT,
    resolution  TEXT
);

CREATE INDEX IF NOT EXISTS idx_discovery_states_session ON discovery_states(session_id);
CREATE INDEX IF NOT EXISTS idx_changesets_session       ON changesets(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session            ON tasks(session_id);
```

E `session_id TEXT` anulável em `tasks` e `decisions` — a coluna de proveniência.

### 5.3 Por que JSON em vez de normalizar

`state` e `payload` são blobs JSON, um desvio do resto do read model, que só guarda escalares.
Justificativa: são documentos cuja **forma vai mudar**. Normalizar compra queries que ninguém
faz ("todas as alternativas rejeitadas de todos os projetos") e cobra migração de schema a cada
mudança de forma. O read model é reconstruível a partir do `events.jsonl` via `rebuild()`, então
mudar a forma depois é reprocessar, não migrar.

**Isto merece um ADR** (`ADR011`), por ser precedente para o resto do read model.

### 5.4 Espelho markdown

O AIPIM tem um padrão: event log para a máquina, markdown para humano e para o git. Discovery
segue. Ao aplicar, escreve `.project/discovery/YYYY-MM-DD-D00X-topico.md` com o estado
destilado — problema, acordos, alternativas rejeitadas com o porquê, premissas em aberto.

É esse arquivo que se lê seis meses depois, diffável no git ao lado de `decisions/` e
`completed/`.

## 6. Ferramentas MCP (6 novas, 1 estendida)

### Leitura

**`find_related(query, limit?)`** — busca `LIKE` sobre título e corpo de tasks e decisões.
Existe para que o grounding não precise chamar `list_tasks` e derrubar o backlog inteiro no
contexto. Com 37 tasks dá na mesma; com 300, não.

**`get_discovery_state(sessionId?)`** — devolve sessão, último estado destilado e changeset
proposto se houver. Sem `sessionId`, devolve a sessão aberta atualizada mais recentemente.

**`get_project_context`** ganha `openDiscoveries[]` — `{ id, topic, updatedAt, openAssumptions }`.
É o que alimenta o hook `SessionStart`.

### Escrita

**`start_discovery({ topic })`** → `{ sessionId }`

**`update_discovery_state({ sessionId, state })`** → `{ version }`

**`propose_changeset({ sessionId, changeset })`** → `{ changesetId, validation }`
Sempre registra a proposta e devolve o relatório de validação. Não bloqueia. É o análogo de
`verify_task`: coleta evidência, não decide.

**`resolve_changeset({ sessionId, changesetId, resolution, force? })`**
É o gate. Com `resolution: 'applied'`, roda os validadores e aplica ou recusa.

## 7. O gate de consenso

### 7.1 Validação estrutural (sempre ligada)

Não é configurável porque não é preferência — é integridade:

- toda ref de dependência resolve (local `#n` ou task existente)
- nenhum ciclo entre as arestas propostas somadas às existentes (reusa a checagem de
  alcançabilidade de `core/graph.ts`)
- todo id em `supersedes` corresponde a uma decisão existente
- todo `localId` referenciado existe em `tasks`

### 7.2 Validadores configuráveis

```toml
[discovery]
max_open_critical      = 0     # premissas críticas em aberto bloqueiam a aplicação
max_tasks_per_changeset = 15   # trava contra completude alucinada
require_estimates      = true  # toda task proposta tem estimatedHours
require_grounding      = true  # projeto não-vazio exige grounding não-vazio
```

Sem `[discovery]` no `config.toml`, o gate é no-op — mesma escolha do `[checks]`, projetos
existentes não são afetados.

`max_open_critical` e `max_tasks_per_changeset` atacam os dois riscos opostos que o mesmo
mecanismo carrega: duplicação/decisão às escuras na ideação contínua, e completude alucinada na
concepção. São validadores diferentes sobre o mesmo objeto, não caminhos de código diferentes.

### 7.3 Bypass auditável

`force: true` aplica e grava `validatorsBypassed: true` no `discovery.resolved`. Mesma escolha
do `complete_task`: o bypass é auditável, não invisível.

## 8. A skill instalada

`aipim install` passa a escrever `.claude/skills/aipim-discovery/SKILL.md` para o harness
`claude-code` (novo território: hoje o AIPIM escreve `.claude/settings.json`, não
`.claude/skills/`). Para harnesses sem diretório de skills (Gemini, Cursor, Laravel Boost), o
playbook é anexado ao arquivo de guidelines correspondente — degradado, mas funcional.

O playbook:

1. **Grounding antes de qualquer pergunta.** `get_project_context` + `find_related`. Nunca
   perguntar antes disso.
2. **Se houver sessão aberta de tópico relacionado, oferecer retomada** antes de abrir nova.
3. **`start_discovery`.**
4. **Loop:** uma pergunta por vez, oferecendo pular explicitamente. Depois de cada turno
   relevante, `update_discovery_state` com o estado inteiro.
5. **Protocolo de pulo:** usuário pula → registra premissa com a decisão adotada e se é crítica.
   Nunca decidir em silêncio.
6. **Convergência:** quando `openThreads` esvazia ou o usuário manda seguir, montar o changeset
   e chamar `propose_changeset`.
7. **Apresentar o changeset como diff legível**, não JSON: tasks com estimativa, arestas de
   dependência, ADRs, e a lista de premissas em aberto destacada.
8. **`resolve_changeset` apenas mediante aprovação explícita do usuário.**

## 9. UI

Rota nova `Discovery.svelte`: lista de sessões e detalhe com o estado destilado e o diff do
changeset. Endpoints REST `GET /api/discoveries` e `GET /api/discoveries/:id` em `mcp/api.ts`.

A UI é read-only nesta versão. Conduzir discovery pela UI perderia o agente, que é onde está o
valor.

## 10. Fases

### Fase 1 — Sessão e estado (4h)
- [ ] Eventos `discovery.started` e `discovery.state_updated` em `types/index.ts` + `EVENT_TYPES`
- [ ] Tabelas `discovery_sessions` e `discovery_states` + casos no `applyEvent`
- [ ] `src/core/discovery.ts`: criação de sessão, escrita e leitura de snapshot
- [ ] Tools `start_discovery`, `update_discovery_state`, `get_discovery_state`
- [ ] Tool `find_related`
- [ ] Testes: `tests/core/discovery.test.ts`, adições em `tests/core/db.test.ts`

**Entrega:** dá para conduzir e retomar uma conversa. Nada é aplicado ainda.
**Commit:** `feat(discovery): session state and grounding`

### Fase 2 — Changeset e aplicação (6h)
- [ ] Eventos `discovery.changeset_proposed` e `discovery.resolved`
- [ ] Tabela `changesets` + `session_id` em `tasks` e `decisions`
- [ ] `appendEvents()` em lote sob um único lock, em `core/events.ts`
- [ ] Validação estrutural (refs, ciclos, supersedes, localIds)
- [ ] Aplicação atômica com fan-out e alocação sequencial de ids
- [ ] `estimatedHours` em `create_task` e no `taskMarkdown`
- [ ] Tools `propose_changeset`, `resolve_changeset`
- [ ] Testes: `tests/mcp/discovery-tools.test.ts`

**Entrega:** ideia vira backlog com dependências e ADRs.
**Commit:** `feat(discovery): changeset proposal and atomic application`

### Fase 3 — Gate, skill e espelho (5h)
- [ ] `[discovery]` no `config.toml` e no template base
- [ ] Validadores configuráveis + `force` auditável
- [ ] `.project/discovery/` — espelho markdown na aplicação
- [ ] Skill `.claude/skills/aipim-discovery/SKILL.md` escrita pelo `installer`
- [ ] Fallback do playbook para harnesses sem diretório de skills
- [ ] `openDiscoveries` em `get_project_context` e no hook `SessionStart`
- [ ] ADR011 sobre JSON no read model
- [ ] Testes de gate, de instalação da skill e de idempotência

**Entrega:** o produto.
**Commit:** `feat(discovery): consensus gate and installed playbook`

### Fase 4 — UI (4h)
- [ ] `GET /api/discoveries` e `GET /api/discoveries/:id`
- [ ] Rota `Discovery.svelte`: lista e detalhe
- [ ] Diff do changeset renderizado
- [ ] Testes em `tests/mcp/api.test.ts`

**Entrega:** visualização.
**Commit:** `feat(discovery): ui route and rest endpoints`

**Total: 19h.**

## 11. Testes

Seguindo a razão medida no 2.3.0 (1,27× teste sobre produção), aproximadamente 700 linhas de
teste sobre ~550 de produção.

Casos que precisam existir:

- Sessão retomada por leitor sem contexto devolve estado suficiente
- Snapshot versionado: v1, v2, v3 recuperáveis; `get_discovery_state` devolve o último
- Changeset com ciclo entre tasks propostas é recusado
- Changeset com dep para task inexistente é recusado
- Changeset com ref local inválida (`#9` sem `#9` em tasks) é recusado
- Aplicação emite exatamente N+M+K eventos, todos com `sessionId`
- Aplicação falha na validação não emite evento nenhum
- Gate: premissa crítica aberta com `max_open_critical = 0` recusa
- Gate: `force: true` aplica e grava `validatorsBypassed`
- Sem `[discovery]` configurado, o gate é no-op
- `propose_changeset` fora de sessão é recusado (R1 como mecanismo)
- Instalação da skill é idempotente
- Espelho markdown escrito na aplicação, com alternativas e premissas

## 12. Fora de escopo

- Conduzir discovery pela UI
- Eventos granulares por nota (`note_captured`, `alternative_recorded`) — o snapshot cobre o
  caso de uso, e a análise cruzada de brainstorms não é um caso declarado
- Compactação automática do estado destilado — destilar é o ato normal de escrita neste formato;
  se o blob crescer demais na prática, vira task própria
- Busca semântica no `find_related` — `LIKE` primeiro, FTS5 se doer
- Proveniência até arquivo e commit (o resto da TASK-037)

## 13. Impacto no backlog existente

- **TASK-037** (proveniência ADR ↔ task ↔ arquivo ↔ commit, P3, 10h) tem metade entregue pela
  coluna `session_id`. Deve ser reescopada depois da Fase 2.
- **TASK-036** (enxugar CLAUDE.md) ganha material: o protocolo de brainstorm sai da prosa e vira
  skill instalada.
