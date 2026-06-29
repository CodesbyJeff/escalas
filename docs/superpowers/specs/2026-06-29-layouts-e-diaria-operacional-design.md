# Design — Layouts múltiplos por lotação + sinalização de Diária Operacional (DO)

**Data:** 2026-06-29
**Projeto:** Sistema de Escalas CBMRN — `apps/backend` + `apps/web`
**Status:** aprovado para planejamento
**Ciclo:** 1 de 2 (o ciclo 2 = criação flexível por período / "criar semanalmente")

## Contexto

Hoje a estrutura da escala vem de um **template único por lotação**
(`TemplateLotacao → TemplateGuarnicao → TemplateVagaSugerida`), com CRUD no backend
(`/templates/lotacao/:id`) **sem nenhuma UI no web**, e a criação de escala é **mensal**,
exige um template e pré-popula todos os dias do mês com guarnições/vagas (vazias; militar é
atribuído depois no editor do dia). Sem UI de template, não dá nem para montar a estrutura
pela tela — daí a fricção.

Este ciclo entrega:
1. **Layouts múltiplos nomeados por lotação** (evolui o template de 1→N) + **UI de edição**.
2. **Seleção de layout na criação** da escala.
3. **Sinalização de Diária Operacional (DO)** simplificada: **vaga aberta = DO**.

O ciclo 2 (escolher data de início / criar semanal / período flexível) e o **módulo futuro
de inscrição/oferta de DO** (militar se inscreve numa vaga DO, regras de seleção, preenchimento)
ficam **fora deste spec**.

## Decisões fechadas (brainstorming 2026-06-29)
- **Layout = reutilizável e múltiplo por lotação** (escolhe-se qual aplicar ao criar).
- **DO simplificado:** cada vaga tem dois estados — **militar atribuído** ou **VAGO**; **VAGO já
  significa DO** (vai para o pool de oferta no módulo futuro). **Sem flag separada** de DO e
  **sem terceiro estado**: `militar_id` nulo já é VAGO/DO.
- O **layout não marca DO** — só define os slots (função/quantidade/turno). Toda vaga nasce
  VAGA(=DO) até o escalante atribuir um militar.
- Fora de escopo: período flexível/semanal (ciclo 2) e módulo de inscrição de DO (futuro).

## Modelo de dados (migration)

- **`TemplateLotacao`** (passa a representar um **Layout**):
  - remover `@unique` de `lotacao_id`;
  - adicionar `nome String`;
  - `@@unique([lotacao_id, nome])` (evita nomes duplicados na mesma lotação).
  - Templates existentes migram com `nome = 'Padrão'`.
- **`TemplateGuarnicao`** e **`TemplateVagaSugerida`**: **sem mudança** (a vaga-sugerida segue
  `funcao` + `quantidade_sugerida`; turno vem da guarnição). **Nada de `do_padrao`.**
- **`Escala`**: adicionar `template_id Int?` (qual layout foi aplicado — referência/auditoria;
  nullable para escalas legadas) + FK opcional para `TemplateLotacao`.
- **`Vaga`**: **sem mudança.** DO = `militar_id == null` (vaga aberta). Não há flag nova.

## Backend

### CRUD de Layouts (evolui o `/templates`)
Como agora há N layouts por lotação, o recurso passa a ser por **id de layout**:
- `GET  /api/v1/templates/lotacao/:lotacao_id` → **lista** os layouts da lotação (id, nome,
  resumo de guarnições). RBAC: ESCALANTE/GESTOR da lotação.
- `GET  /api/v1/templates/:id` → um layout completo (guarnições + vagas-sugeridas).
- `POST /api/v1/templates/lotacao/:lotacao_id` → cria layout (`nome` + guarnições + vagas).
  RBAC: ESCALANTE da lotação. Nome duplicado → 409.
- `PUT  /api/v1/templates/:id` → substitui a estrutura do layout (replace-all de
  guarnições/vagas, como o padrão existente). RBAC: ESCALANTE.
- `DELETE /api/v1/templates/:id` → exclui o layout. Bloquear (409) se já houver escala que o
  referencia (`Escala.template_id`)? **Decisão:** permitir excluir; `Escala.template_id` é só
  referência (nullable, `ON DELETE SET NULL`) — a escala já criada não depende mais do layout.
- Schemas Zod: evoluir `upsertTemplateLotacaoSchema` para `criarLayoutSchema`/`atualizarLayoutSchema`
  (com `nome`). Manter o shape de guarnições/vagas.

### Criar escala com layout
- `CriarEscalaInput` ganha `template_id: number` (qual layout aplicar). Obrigatório.
- `escalaService.criar` busca o layout por `template_id`, valida que pertence à `lotacao_id`
  (senão 422/409), aplica a estrutura (igual hoje) e grava `escala.template_id`.
- Mensagem de erro atual ("Configure o template…") vira "Selecione um layout para a lotação."
  quando a lotação não tem nenhum layout.

### Editor do dia
- Sem mudança de modelo. O `putDia` já aceita vagas com `militar_id null` (= VAGO/DO). Nenhum
  campo novo. (A semântica "VAGO = DO" é de apresentação — ver Web.)

## Web

### Tela de Layouts (nova) — `features/layouts/`
- Rota `/layouts` (ESCALANTE/super-admin via `navFlags`). Item de menu sob "Escala".
- Fluxo: escolher lotação → listar layouts → criar/editar/excluir.
- **Editor de layout:** `nome` + lista de guarnições (sigla, atividade, turno início/fim, ordem)
  → cada guarnição com vagas-sugeridas (função + quantidade). Salvar (POST/PUT). Reusa o padrão
  de rascunho/replace-all do editor do dia.
- `layoutsApi`: `listar(lotacaoId)`, `obter(id)`, `criar(lotacaoId, input)`, `atualizar(id, input)`,
  `excluir(id)`.

### Nova Escala — seletor de layout
- `NovaEscalaForm` ganha um `Select` **Layout** (carrega `layoutsApi.listar(lotacao_id)` ao
  escolher a lotação; desabilitado/aviso se a lotação não tem layouts, com link para criar).
- `criarEscalaSchema` ganha `template_id`.

### Editor do dia — VAGO rotulado como DO
- Onde hoje aparece **"VAGO"** para vaga aberta, passar a exibir **"DO — Diária Operacional"**
  (badge/realce visual), deixando claro que a vaga aberta será ofertada. Sem mudança de dado
  (continua `militar_id null`). Aplica-se ao editor do escalante; nas telas de execução/aprovação
  o rótulo de vaga aberta também passa a "DO" para consistência.

## Testes / verificação
- **Backend:** CRUD de layouts (criar/listar/obter/atualizar/excluir; nome duplicado 409; RBAC),
  `criar` com `template_id` (aplica o layout certo; valida pertencimento à lotação), migration.
  Verificável por curl.
- **Web:** testes de componente/rota (editor de layout salva; Nova Escala lista layouts e exige
  seleção; editor mostra "DO" em vaga aberta). Verificação ao vivo (Playwright).

## Fora de escopo (próximos ciclos)
- **Ciclo 2:** criação flexível por período (escolher data de início, criar semanal, aplicar
  layout a um intervalo).
- **Módulo futuro:** inscrição/oferta de DO (militar se inscreve numa vaga aberta, regras de
  seleção, preenchimento da vaga DO pelo selecionado).
- Atribuição de militares no layout (layout guarda só slots; militar é por-dia no editor).

## Convenções
- Branch `main`; push só sob ordem; sem deploy. Padrão `{success,message,data}`, `/api/v1` pt-BR.
- Não editar `routeTree.gen.ts` à mão. MSW com `onUnhandledRequest: 'error'`. Tema `cbmrn`.
- Migration sem shadow DB (ambiente sem `pg_signal_backend`): gerar via `migrate diff` + aplicar
  com `migrate deploy` (como na trilha Feriado).
