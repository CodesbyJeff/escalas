# Ciclo 2b.2 — Fecho da Elegibilidade por Patente — Design

**Data:** 2026-07-02
**Contexto:** Fecha as pendências do Ciclo 2b (elegibilidade por patente, aviso soft). O 2b.1 (patente + cascata + catálogo global/lotação + aviso no picker/editor) está em produção (`origin/main`). Este documento cobre as 4 frentes que faltaram + o gancho para o 2c (alimentar do mapa de força).

Base 2b.1: `docs/superpowers/specs/2026-07-02-ciclo2b-elegibilidade-patente-design.md`.

## Frentes

### 1. Camada LAYOUT no editor (a 3ª camada da cascata ganha UI)
A cascata `layout → lotação → global` já é resolvida por `patenteService.esperadasPara` (2b.1), mas a camada layout (`FuncaoPatente.template_id`) não tinha como ser criada. Agora o editor de layout autora as patentes esperadas por função.

- **Schema:** `vagaSugeridaSchema` (shared-schemas) ganha `patentes_esperadas: z.array(z.number().int().positive()).max(72).optional()`.
- **Autoria por FUNÇÃO, não por vaga:** a resolução é por `(template_id, funcao_norm)`, então a regra do layout é por função. Se a mesma função aparece em duas guarnições do layout, elas compartilham UMA regra (o editor pré-preenche as duas com o mesmo valor; ao salvar, dedupe por `funcao_norm`, **última ocorrência vence**). Documentado.
- **Persistência (`layoutService.criar`/`atualizar`):** dentro da mesma transação que grava o template, sincroniza as linhas `FuncaoPatente(template_id=<layout>)`:
  - `atualizar` (replace-all): `deleteMany({ template_id })` + recria a partir das `vagas_sugeridas` do input.
  - Para cada `funcao_norm` distinta com `patentes_esperadas` **não-vazio**, cria uma linha `FuncaoPatente(template_id, funcao_norm, patente_ids)`. Função sem patentes → nenhuma linha (herda lotação/global). `[]` explícito também não gera linha aqui (no layout, "sem seleção" = herdar; para silenciar use o catálogo — mantém o editor simples).
- **Leitura (`obter`/`listarPorLotacao`):** o layout retornado inclui, por vaga sugerida, `patentes_esperadas` resolvidas das linhas `FuncaoPatente(template_id)` mapeadas por `funcao_norm` (para o editor pré-preencher).
- **Web (`LayoutEditor`/`useLayoutDraft`):** cada vaga sugerida ganha um `MultiSelect` de patentes (dados de `patentesApi.listar`, `value=String(id)`, `label="SIGLA — nome"`). `novaVaga` inclui `patentes_esperadas: []`.
- **DTO:** `TemplateVagaSugeridaDTO` ganha `patentes_esperadas: number[]` (default `[]`).

### 2. Aviso live por vaga-id (corrige o Important #2 do review 2b.1)
Hoje o editor do dia resolve `patentes_esperadas` lendo `diaInicial.guarnicoes[gi].vagas[vi]` por **índice posicional**; após adicionar/remover vaga, o índice desalinha e o aviso pode refletir outra vaga.

- **Correção:** o draft passa a carregar `patentes_esperadas` por vaga (copiado de `diaInicial` ao montar; `novaVaga` → `null`). `getPatentesEsperadas(gi, vi)` lê do **draft** (`draft.values.guarnicoes[gi].vagas[vi].patentes_esperadas`), que se move corretamente com add/remove. O `MilitarPicker` já computa a divergência ao vivo a partir do militar selecionado (2b.1), então o aviso fica correto sob edição estrutural.
- **`toPutInput` remove** os campos só-de-UI (`patentes_esperadas`) do payload enviado ao PUT (o `vagaInputSchema` não os aceita; o backend resolve por conta própria).
- **Limitação aceitável (documentada):** editar o texto da **função** de uma vaga não re-resolve a regra ao vivo (a regra é resolvida no servidor por função); atualiza no próximo save+reload. Vaga nova só ganha regra após salvar.

### 3. Lista de divergências na Aprovação (gestor)
O gestor vê, antes de aprovar, todas as vagas da escala com patente divergente.

- **Backend:** `GET /api/v1/escalas/:id/avisos-patente` (`requireEscalaAccess(['ESCALANTE','GESTOR'])`) → `AvisoPatenteDTO[]`: `{ data, guarnicao_sigla, funcao, militar_id, militar_nome, patente_sigla, patentes_esperadas }`, uma entrada por vaga preenchida divergente, varrendo todos os dias da escala. Reusa `esperadasPara` + `patenteDivergente`, **memoizando por `funcao_norm`** dentro da escala (evita N+1). Ordena por data.
- **Shared-types:** `AvisoPatenteDTO`.
- **Web:** na tela `/aprovacao/escalas/$id`, uma seção "Divergências de patente" (Table) abaixo do resumo — apenas informativa (não bloqueia Aprovar). Vazia → "Nenhuma divergência de patente."

### 4. Limpezas diferidas do review 2b.1
- **N+1:** `enriquecerComPatentes` (getDia/putDia) memoiza `esperadasPara` por `funcao_norm` dentro do dia. Mesmo padrão no endpoint de avisos.
- **P2002 → 409:** `funcaoPatenteService.criar` faz try/catch do `PrismaClientKnownRequestError` code `P2002` (corrida contra o índice único parcial) → `ConflictError`, além do pre-check já existente.
- **Catálogo — rótulo da força:** o `MultiSelect` de patentes deixa de agrupar por "Força {id}" (número cru sem nome). Passa a lista **plana**, ordenada por `(forca_id, ordem)`, `label="SIGLA — nome"`. Remove o rótulo feio sem precisar de nome de força.
- **NaN guard:** `funcaoPatenteController.listar` trata `Number(req.query.lotacao_id)` `NaN` como `undefined` (lista globais), evitando `lotacao_id: NaN` no filtro.

> Não incluído de propósito: guard de `patente_ids` vazio no client — `[]` é uma regra válida de "silenciar" no catálogo (por design 2b.1), então não deve ser bloqueado.

## Gancho para o 2c — "alimentar o sistema pelo mapa de força" (NÃO construído aqui)
Direcionamento do usuário: minerar o padrão do mapa de força do SISBOM para auto-popular a elegibilidade (quais patentes de fato exercem cada função). Levantamento desta sessão:
- O mapa de força vive em `mapa-guarnicoes` / `mapa-individuals` (SISBOM). `mapa-individuals` liga `_militar → _patente/forca_id`; o agrupamento operacional é por `atividade` (viatura/local), e a **função** por militar está dentro do documento de guarnição, não como campo achatado limpo.
- **Bloqueio de integração:** o `/external` do SISBOM (consumido pelo sync do Escalas) só expõe `militar` e `lotacoes` (whitelist em `routes/external.js`). O mapa de força **não é exposto**. Para minerar, é preciso **um novo endpoint `/external`** no `sisbom-api` (branch `feat/escalas-external`) que projete os serviços com `{ atividade/funcao, _militar, _patente, bo_diaria, data }`, + um importador no Escalas que agregue `funcao_norm → contagem por patente` e proponha regras `FuncaoPatente`.
- **Por que é 2c, não 2b:** é nova superfície de integração (Sprint 20 "mapa de força = escala executada") + motor de sugestão por histórico (base da equidade). Deve ter seu próprio ciclo brainstorm→spec→plano. **Pré-requisitos:** endpoint SISBOM + deploy (`deploy:sisbom`, passo do usuário/TEN PETER).

## Escopo / não-escopo
- **Em escopo (este plano):** frentes 1–4.
- **Fora:** o importador do mapa de força (gancho 2c acima); qualquer bloqueio rígido (aviso segue soft).

## Testes
- **Backend:** layout sync de `FuncaoPatente(template_id)` (criar/atualizar/replace-all/dedupe por função); `obter` devolve `patentes_esperadas` por vaga; `esperadasPara` memoizado (comportamento inalterado); `criar` regra em corrida → 409; `avisos-patente` (divergente/ok/aberta/multi-dia). 
- **Web:** LayoutEditor com MultiSelect de patentes (pré-preenche + envia); editor do dia — aviso acompanha a vaga após remover uma vaga acima (por id, não índice); catálogo lista plana; aprovação mostra a tabela de divergências.

## Constraints globais (herdadas)
- Repo `escalas`: sempre `main`, commit direto; push só sob ordem explícita.
- ESM (`.js`), 2 espaços, `{success,message,data}`, `/api/v1/`, pt-BR snake_case.
- Migration só se necessária (esta fatia **não** precisa de migration nova — usa a `FuncaoPatente` do 2b.1); se surgir, SQL à mão + `migrate deploy` dev+test.
- `@types/react` unificado no workspace.
