# Design — Aprovação de Escalas (gestor) + Resumo de Serviços local (passo 5 / Opção A)

**Data:** 2026-06-26
**Projeto:** Sistema de Escalas CBMRN — `apps/backend` + `apps/web`
**Status:** aprovado para planejamento

## Contexto

O ciclo de vida da escala é `rascunho → publicar (em_validacao) → gestor aprova (aprovada) | rejeita (rejeitada)`.
O escalante já publica (Plano 5), mas **não existe UI do gestor** para aprovar/rejeitar a
escala prevista — então escalas ficam presas em `em_validacao`. O backend de validação da
prevista já existe (`validacaoService.validar`, `listarPendentes`), mas o "mapa de força"
(apoio à decisão do gestor) é hoje um **proxy opaco do SISBOM** que depende da integração
`/external` ainda não ativa (Sprint 10, pende aval dos tenentes).

**Decisão central (passo 5 do Feriado, A vs C):** **Opção A — contagem LOCAL.** Em vez do
proxy SISBOM, computa-se um **resumo de serviços** a partir da própria escala local,
classificando cada dia como semana × fim-de-semana/feriado via `feriadosBrasil(ano)` + a
tabela `Feriado`. É construível e verificável já (sem SISBOM) e fecha a pendência do passo 5
aberta desde 2026-06-24. O proxy SISBOM (`getMapaForca`) **fica intocado** para uso futuro.

**Decisão de navegação:** novo item de menu **"Aprovação de Escalas"** (gestor), separado de
"Validação" (que é a validação da execução do dia). Dois momentos distintos do gestor.

### Decisões fechadas no brainstorming (2026-06-26)
- Fonte dos números = **contagem local (A)**. Distinção ordinário/diária **fora** (DO é dado
  de execução, não existe na prevista).
- Menu: item próprio **"Aprovação de Escalas"**.
- Proxy SISBOM do mapa de força: fora do escopo (futuro).

## Backend já existente (reusar, não reescrever)
- `GET /api/v1/validacoes/pendentes` → escalas `em_validacao` das lotações onde o usuário é GESTOR (super-admin vê todas). (`validacaoController.pendentes`)
- `POST /api/v1/escalas/:id/validar` (`requireEscalaAccess(['GESTOR'])`, `validate(validarEscalaSchema)`) → aprova/rejeita; 201; congela snapshot do mapa de força; 409 se não está `em_validacao`; 422 rejeitar sem justificativa. (`validacaoController.validar`)
- `GET /api/v1/escalas/:id/validacoes` → histórico. `GET /api/v1/escalas/:id/mes` → prevista (mês). (já existem)
- `validarEscalaSchema`: `{ status: 'aprovada'|'rejeitada', justificativa?: string(1..500) }`.

## Parte A — Resumo de serviços local (backend, passo 5)

### DTO (novo em `packages/shared-types/src/validacao.ts`, re-exportado)
```ts
export interface ResumoServicoDTO {
  militar_id: number;
  nome: string;
  posto: string | null;
  total: number;             // total de vagas previstas para o militar na escala
  semana: number;            // em dia útil (seg–sex, não feriado)
  fim_semana_feriado: number;// sáb/dom OU feriado (nacional via feriadosBrasil ou tabela)
}
```

### Service `apps/backend/src/services/resumoServico.service.ts`
`resumoServicoService.calcular(escala_id, prisma): Promise<ResumoServicoDTO[]>`:
- Carrega a escala (`mes`/`ano`); 404 se inexistente.
- Carrega as vagas com `militar_id != null` da escala: `prisma.vaga.findMany` filtrando
  `guarnicao.dia.escala_id = escala_id`, incluindo `guarnicao.dia` (para `data`) e o `militar`
  (`User`: id/nome/posto/nome_curto).
- Conjunto de feriados do mês: `feriadosBrasil(ano)` (datas UTC) ∪ datas da tabela `Feriado`
  no intervalo do mês (`prisma.feriado.findMany`). Representar como `Set<string>` de `YYYY-MM-DD`.
- Para cada vaga: `data = vaga.guarnicao.dia.data`; `dow = data.getUTCDay()`;
  `ehFdsFeriado = dow === 0 || dow === 6 || feriadoSet.has(ymd(data))`.
- Acumula por `militar_id`: `total++`, e `fim_semana_feriado++` ou `semana++`.
- Resolve `nome`/`posto` do militar; ordena por `nome` asc.

### Rota `apps/backend/src/routes/escala.routes.ts` (aninhada)
`GET /:id/resumo-servicos` → `requireEscalaAccess(['ESCALANTE','GESTOR'])` → `resumoServicoController.resumo`.
Controller mínimo no padrão existente (`ok`/`handle`).

### Testes
- `resumoServico.service.test.ts`: dia útil → `semana`; sáb/dom → `fim_semana_feriado`;
  feriado nacional (ex.: 2026-09-07) → `fim_semana_feriado`; feriado da tabela (estadual ad-hoc)
  → `fim_semana_feriado`; dois militares com contagens distintas; ordenação por nome.
- `escala.routes.test.ts` (ou novo `resumoServico.routes.test.ts`): 200 autenticado com papel;
  403 sem papel na lotação; shape do DTO.

## Parte B — UI de Aprovação (web, gestor)

### API `apps/web/src/lib/api/validacoes.ts`
```ts
export const validacoesApi = {
  pendentes: () => apiGet<EscalaDTO[]>('/validacoes/pendentes'),
  resumoServicos: (id: number) => apiGet<ResumoServicoDTO[]>(`/escalas/${id}/resumo-servicos`),
  validar: (id: number, input: ValidarEscalaInput) => apiPost<ValidacaoEscalaDTO>(`/escalas/${id}/validar`, input),
  validacoes: (id: number) => apiGet<ValidacaoEscalaDTO[]>(`/escalas/${id}/validacoes`),
};
```
(Reusa `escalasApi.getMes`/`detalhe` para a prevista read-only.)

### Navegação
- `AppShellNav` ganha item **"Aprovação de Escalas"** (to `/aprovacao`), renderizado quando
  `canValidar` (GESTOR/super-admin) — mesmo flag de "Validação". Ícone distinto (ex.: `IconGavel`).

### Rotas
- `/aprovacao` (`routes/_app/aprovacao/index.tsx`, componente `AprovacaoWorklist`): worklist das
  escalas `em_validacao` (`validacoesApi.pendentes`), tabela (Lotação `#id` · Mês/Ano · Status)
  com ação "Revisar" → `/aprovacao/escalas/$id`. Vazio: "Nenhuma escala aguardando aprovação."
- `/aprovacao/escalas/$id` (`routes/_app/aprovacao/escalas/$id.tsx`, componente `AprovacaoEscalaScreen`):
  layout **lado a lado** (Mantine `Grid`/`SimpleGrid`):
  - **Esquerda:** prevista read-only — reusa a renderização de mês/dia existente (a partir de
    `escalasApi.getMes`); cada dia lista guarnições/vagas (função · militar), somente leitura.
  - **Direita:** `ResumoServicosTable` (militar · total · semana · fds/feriado), com total geral.
  - **Ações:** **Aprovar** (`validar` status `aprovada` → 201, notifica, invalida pendentes) e
    **Rejeitar** (Modal com `Textarea` justificativa obrigatória → status `rejeitada`). 409 → "a
    escala mudou de estado, recarregue"; 422 → alerta inline.
- Componente `apps/web/src/features/aprovacao/ResumoServicosTable.tsx`.

### Testes (Vitest + RTL + MSW)
- `AprovacaoWorklist`: render da tabela + estado vazio.
- `ResumoServicosTable`: render das colunas/linhas.
- `AprovacaoEscalaScreen`: aprovar → notificação; rejeitar exige justificativa (botão desabilitado
  sem texto) e envia; 409 → notificação de recarga; render do resumo + prevista (MSW para
  `getMes` + `resumo-servicos`).
- `navFlags`/AppShell: item "Aprovação de Escalas" aparece quando `canValidar`.

## Fora de escopo (YAGNI)
- Proxy SISBOM do mapa de força (Sprint 10) — `getMapaForca` fica intocado.
- Distinção ordinário/diária (dado de execução).
- Edição da escala pelo gestor (só aprovar/rejeitar a prevista).
- Histórico de validações na UI (endpoint existe; tela fica para depois se necessário).

## Estrutura de arquivos (novos)
```
packages/shared-types/src/validacao.ts                 (+ ResumoServicoDTO)
apps/backend/src/services/resumoServico.service.ts     (+ .test)
apps/backend/src/controllers/resumoServico.controller.ts
apps/backend/src/routes/escala.routes.ts               (+ rota /:id/resumo-servicos)
apps/web/src/lib/api/validacoes.ts
apps/web/src/features/aprovacao/ResumoServicosTable.tsx (+ .test)
apps/web/src/routes/_app/aprovacao/index.tsx           (+ worklist.test)
apps/web/src/routes/_app/aprovacao/escalas/$id.tsx     (+ .test)
apps/web/src/components/AppShell.tsx                    (item Aprovação)
```

## Convenções
- Branch `main` (escalas commita direto na main). Push só sob ordem. Sem deploy.
- Padrão `{success,message,data}`; rotas `/api/v1` pt-BR. Não editar `routeTree.gen.ts` à mão.
- MSW com `onUnhandledRequest: 'error'` — handlers para todo request nos testes.
- Spec relacionada: Feriado passos 1–4 (já entregues) e a Retomada (passo 5 era a pendência).
