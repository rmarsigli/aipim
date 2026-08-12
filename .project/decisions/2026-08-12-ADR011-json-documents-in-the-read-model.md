---
title: "Documentos JSON no read model"
date: 2026-08-12
status: Accepted
---

# Documentos JSON no read model

## Contexto

Até o 2.3, todas as tabelas do read model guardavam apenas escalares: `tasks`, `comments`,
`decisions`, `task_dependencies`, `checks`. Cada campo de evento virava uma coluna.

O discovery (2.4) introduz dois objetos que não cabem nesse formato:

- **O estado destilado da sessão** — problema, acordos, alternativas rejeitadas, premissas,
  grounding, fios abertos. Seis listas de objetos, reescritas por inteiro a cada turno.
- **O changeset** — tasks propostas, arestas, decisões, docs. Um diff sobre o grafo.

Normalizar isso custaria cinco a seis tabelas novas com chaves estrangeiras.

## Decisão

`discovery_states.state` e `changesets.payload` guardam JSON. As colunas que existem ao redor
(`session_id`, `version`, `status`, timestamps) são as únicas por onde se consulta.

## Justificativa

**A forma vai mudar.** O estado destilado é um formato de trabalho, não um esquema estável.
Acrescentar um campo — riscos, restrições, o que for — é provável e desejável. Normalizado,
cada campo novo é uma migração de schema.

**Ninguém consulta o interior.** As queries reais são "estado da sessão X" e "changeset da
sessão X". Não existe caso de uso para "todas as alternativas rejeitadas de todos os projetos".
Normalizar compraria queries que ninguém faz.

**Migrar não é o custo que parece.** O read model é derivado: `rebuild()` reconstrói tudo a
partir do `events.jsonl`. Mudar a forma do JSON depois é reprocessar, não migrar. A garantia de
durabilidade está no log, não na tabela.

**Escrita idempotente.** `discovery_states` é chaveada pelo id do evento com `UNIQUE (session_id,
version)`, e não por `(session_id, version)` como chave primária. A versão é derivada em tempo de
aplicação (`MAX(version) + 1`), então reaplicar o mesmo evento num rebuild precisa ser inerte —
o que só a chave pelo id do evento garante.

## Consequências

- Um campo novo no estado destilado não exige migração, só código que o leia.
- Consultas sobre o conteúdo do JSON não são possíveis em SQL. Se algum dia forem necessárias,
  a saída é normalizar aquele recorte específico e reconstruir — não desfazer esta decisão.
- Este é precedente: documentos cuja forma é instável e cujo interior não é consultado podem
  ser guardados como JSON. Não vale para entidades consultáveis como `tasks`.

## Alternativas consideradas

**Normalizar em tabelas** — `discovery_agreements`, `discovery_alternatives`,
`discovery_assumptions`, `discovery_grounding`, `changeset_tasks`, `changeset_dependencies`.
Rejeitada: seis tabelas e uma migração por mudança de forma, em troca de queries que nenhum
caso de uso pede.

**Eventos granulares por nota** — `note_captured`, `alternative_recorded`, cada um em sua
tabela. Rejeitada por motivo mais forte: o log é append-only, então o snapshot por turno já dá
histórico de versões de graça. Eventos granulares custariam ~750 linhas a mais e obrigariam o
agente a fazer diff do próprio raciocínio, que é trabalho artificial — ele re-deriva o estado
inteiro a cada turno de qualquer forma.
