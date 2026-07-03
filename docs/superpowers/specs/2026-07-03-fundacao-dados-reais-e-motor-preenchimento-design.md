# Fundação de Dados Reais + Motor de Preenchimento (Ciclo 2c) — Design

**Data:** 2026-07-03
**Contexto:** O Ciclo 2b (elegibilidade por patente) está fechado e em produção. Ao retomar o 2c (motor de preenchimento por equidade), o usuário pediu, como pré-requisito, que o sistema use **dados reais** do SISBOM: aposentar as lotações/militares fictícios que semeamos, e **criar os layouts de lotação/guarnição a partir do mapa de força real**. Este documento decompõe o programa em fases e detalha a fundação de dados; o motor (2c) tem seu design acordado resumido ao fim e ganhará spec próprio.

## Auditoria que motiva o trabalho (banco `escalas_dev`, 2026-07-03)

| | Reais (SISBOM) | Fictícios/seed |
|---|---|---|
| Lotações | 85 com `sisbom_ref` | 6 duplicatas seed: COBM(2), GBSA(14), 1BBM(100), 2BBM(101), 3BBM(102), ZN-NTL(103) |
| Militares | 4.709 sync; **868 lotados** (13 lotações op. com efetivo) | 9 sem `sisbom_id`: TEN PETER(1), TEN VIEIRA(2), Admin(3), 6 soldados-teste(4-9) |
| Layouts | 0 | 2 na lot 100 seed |
| Escalas | 0 | 4 na lot 100 seed |

**Três fatos que guiam o plano:**
1. As 6 lotações seed **duplicam** unidades reais (ex.: GBSA seed id 14 vs GBSA real lot#132). Devem ser aposentadas; a operação usa as reais.
2. Os 868 lotados estão **sem `patente_id`** (o bulk-sync rodou antes do 2b.1 mapear `_patente`). Um **re-sync popula tudo** — o `/external/militar` já expõe `_patente`.
3. Não há layout real. O `mapa-guarnicoes` do SISBOM (não exposto no `/external`) é a fonte para modelá-los.

## Decomposição em sub-projetos

- **Sub-projeto 1 — Fundação de Dados Reais** (este spec): Fases 0a→0c abaixo.
- **Sub-projeto 2 — Ciclo 2c: Motor de Preenchimento** (spec próprio, após a Fundação): design resumido ao fim.

Cada um roda o ciclo spec→plano→implementação (subagent-driven). Regra de branch mantida: `escalas` sempre `main`; `sisbom-api` sempre `feat/escalas-external` (usuário faz merges). Deploy só sob ordem (o coronel autorizou remover bloqueios nesta rodada).

---

## Fase 0a — Higiene + re-sync de patentes (Escalas, local)

**Objetivo:** deixar `escalas_dev` só com dados reais e patentes populadas, preservando login/teste.

- **Re-sync:** rodar `bulk-sync` (agora com o mapeamento `_patente → patente_id` do 2b.1). Resultado esperado: 868 lotados com `patente_id`; as 18 patentes CBM reais (ALUNO CFP, SD, CB, AL SGT, 3º/2º/1º SGT, ST, AL CHO, CAD 1/2/3, 2º/1º TEN, CAP, MAJ, TC, CEL) presentes nos militares.
- **Aposentar seed:** remover as 4 escalas de teste e os 2 layouts da lot 100; remover os 6 soldados-teste (users 4-9) e seus vínculos/roles; remover as 6 lotações seed sem `sisbom_ref` (2,14,100,101,102,103) **desde que** não referenciadas por dado real (são; as reais têm `sisbom_ref`).
- **Preservar acesso:** manter os 3 super-admins (TEN PETER 1, TEN VIEIRA 2, Admin 3) — super-admin ignora RBAC, então login e testes seguem. Reatribuir os papéis de teste (ESCALANTE/GESTOR/FISCAL) do Admin para uma **lotação operacional real** (ex.: 1º SGB Natal lot#174) para exercitar os fluxos.
- **Segurança:** script CLI idempotente com **guard anti-prod** (mesmo padrão do `reset-sisbom`), backup (`pg_dump`) antes; roda dentro de transação.
- **Verificação:** re-auditar — 0 lotações sem ref, 0 users sem `sisbom_id` exceto os 3 super-admins, 868 com patente, escala/layout de teste recriados numa lotação real.

**Interfaces:** nenhuma nova de runtime; um CLI `higiene-dados` (dev-only).

---

## Fase 0b — Entidade `mapa-guarnicoes` no `/external` (sisbom-api)

**Objetivo:** expor o mapa de força (somente-leitura, whitelist) para o Escalas minerar.

- **Onde:** `src/api_sisbom/routes/external.js` (branch `feat/escalas-external`). Reusa o padrão atual (`repository(col, {skip:{global_user,global_institution}})`, auth `x-api-key`, endpoints `snapshot`/`events`/`mirror-ref`).
- **Projeção (whitelist) da entidade `mapa-guarnicoes`:** `_id, _lotacao, _viatura, atividade, atividade_extra, date, date_start, date_end, time_start, time_end, prefixo, deleted, guarnicao` — e dentro de `guarnicao[]` apenas `{_id, _militar, str_funcao, _patente, bo_diaria}`. Nunca o doc inteiro (sem timeline, alterações, odômetro).
- **Filtro:** `deleted != true`; suportar `?since=` (via `date_start`) e paginação `skip/limit` como o snapshot. Default: últimos ~3 meses para modelagem de layout.
- **Não expõe** `mapa-individuals` nesta fase (DO individual = Sprint 24, fora do 2c).
- **Verificação:** smoke contra `sisbom-dev` local (Mongo `127.0.0.1:27017`): 401 sem chave; com chave, retorna guarnições reais projetadas; contagem plausível vs `mapa-guarnicoes` (o CLAUDE.md cita ~19.973 docs em dev).

**Interfaces:** `GET /external/snapshot?entity=mapa-guarnicoes&since=&skip=&limit=` (contrato existente, nova entidade na whitelist).

**Deploy:** vai ao ar no `deploy:sisbom` (autorizado nesta rodada). Setar `SISBOM_EXTERNAL_BASE_URL` no Escalas para consumir.

---

## Fase 0c — Importador + geração de layouts (Escalas)

**Objetivo:** transformar o mapa de força real em `TemplateLotacao`/`TemplateGuarnicao` reutilizáveis.

- **Cliente:** estende o `sisbomClient` do Escalas para puxar `snapshot(entity='mapa-guarnicoes', since=<-3 meses>)`, paginado.
- **Agregação (serviço `mapaLayoutService`):** agrupa por `_lotacao` → `atividade` (a viatura/local é o eixo da guarnição) → coleta o conjunto de `str_funcao` distintas e o **turno modal** (`time_start`→`time_end` mais frequente) e a **quantidade típica** por função (moda da contagem por serviço). Emite, por lotação, um `TemplateLotacao` nomeado **"Padrão (mapa de força)"** com um `TemplateGuarnicao` por `atividade` (sigla = atividade abreviada, `turno_padrao_*` = turno modal, `ciclo_dias` inferido: 24h→1 se turno fecha em 24h) e `vagas_sugeridas` por `str_funcao` (`quantidade_sugerida` = moda).
- **Elegibilidade de brinde (opcional, atrás de flag):** o mesmo varrimento agrega `funcao_norm → patentes observadas (_patente)`; pode semear `FuncaoPatente(template_id)` em modo **"sugerido"** (não sobrescreve curadoria). Mantido opcional para não acoplar as duas frentes.
- **Idempotência:** re-rodar atualiza o layout "Padrão (mapa de força)" da lotação (replace-all das guarnições daquele layout), nunca duplica; layouts criados à mão pelo escalante ficam intactos.
- **Escopo:** só as **13 lotações operacionais reais com efetivo**. As famílias esperadas (memória de domínio): batalhão/SGB com viaturas 24×72 (INCENDIO/RESGATE/SALVAMENTO); GBSA com locais/turnos mistos.
- **Verificação:** rodar contra `sisbom-dev`; conferir que cada uma das 13 lotações ganhou um layout com guarnições coerentes (atividades e funções batendo com o mapa real); nenhuma exceção em lotação sem dado.

**Interfaces:** CLI `gerar-layouts-mapa-forca` (dev/admin); `mapaLayoutService.gerarParaLotacao(lotacao_id)` e `.gerarTodas()`.

---

## Sub-projeto 2 — Ciclo 2c: Motor de Preenchimento (design acordado, spec próprio)

Roda **depois** da Fundação, sobre os layouts reais. Design já validado com o usuário:

- **Fluxo:** `carimbarEstrutura` (existe) cria vagas abertas → **motor sugere** → escalante revisa → **aplica** (só vagas abertas, nunca sobrescreve manual). Rascunho-only.
- **Serviço `preenchimentoService`:** `sugerir(escala_id, {data_ini, data_fim, descanso_horas})` (preview puro) e `aplicar(...)` (grava em tx, audita).
- **Algoritmo greedy determinístico:** pool = **militares lotados** (868, via `UserLotacao`); baseline de equidade = **contagem local: escala atual + escalas publicadas anteriores da mesma lotação** (decisão do usuário); ranqueia por (hard: sem conflito de turno no dia via `encontrarConflitos` + fora da janela de descanso) → (soft: patente compatível) → (menos serviços acumulados) → desempate `militar_id`. Se ninguém respeita descanso, relaxa com `aviso_descanso` (nunca deixa vazio; soft).
- **Descanso:** "após turno que termina em T, indisponível até T + `descanso_horas`" (default **72**; 24×72). Turno 24h resolvido pela convenção do 2a.
- **Endpoints:** `POST /escalas/:id/sugerir-preenchimento` e `.../aplicar-preenchimento` (`requireEscalaAccess(['ESCALANTE'])`).
- **Web:** cartão "Preenchimento automático" no detalhe da escala (intervalo + descanso) → Pré-visualizar (tabela por vaga com militar + motivo/avisos) → Aplicar. Reusa o padrão do `AcoesBloco`.
- **Fora de escopo:** importador de elegibilidade (fica na Fase 0c opcional); bloqueio rígido (tudo soft); permuta/atestado.

---

## Não-escopo global
- `mapa-individuals` / DO individual (Sprint 24).
- Qualquer deploy em produção do Escalas (o app ainda é MVP; sem prod).
- Bloqueios rígidos por patente (aviso segue soft, coerente com 2b).

## Riscos
- **Fase 0a destrutiva:** mitigado por guard anti-prod + backup + transação; preserva os 3 super-admins.
- **Turno modal pode achatar variação real** (ex.: GBSA com turnos mistos por local) — aceitável para um layout "padrão"; o escalante ajusta. Documentar no resultado do importador.
- **`SISBOM_EXTERNAL_BASE_URL` + `ESCALAS_API_KEY`** precisam estar setados para a 0c consumir a 0b em runtime (em dev, aponta para o sisbom-dev local).
