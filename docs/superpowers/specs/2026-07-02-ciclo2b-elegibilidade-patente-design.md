# Ciclo 2b — Elegibilidade por Patente (aviso soft) — Design

**Data:** 2026-07-02
**Contexto:** Sistema de Escalas CBMRN. Terceira frente do Ciclo 2 (guarnição). O 2a (geração em bloco) já está em produção na `main`. Este documento cobre o **2b — elegibilidade por função**.

## Problema

Ao preencher uma vaga (que tem uma `funcao` string livre, ex.: "Comandante", "Motorista", "Socorrista"), hoje o escalante escolhe **qualquer** militar da lotação — não há noção de "esse militar pode exercer essa função". O objetivo do 2b é sinalizar quando a **patente** do militar não condiz com a esperada para a função.

**Decisão do usuário (trancada):** a fonte da elegibilidade é a **patente vinda do SISBOM**, e o comportamento é **aviso soft — NUNCA bloqueia**. Se a patente não bate, salva mesmo assim, só "deixa avisado".

### Estado atual relevante (verificado no código)
- `Vaga.funcao` e `TemplateVagaSugerida.funcao` são strings livres, com variação de caixa no mesmo dado real (ex.: template da lotação 100 tem "Comandante" e "COMANDANTE").
- Elegibilidade atual = só `lotacao_id` + busca textual (`escala.controller.listarMilitares` → `adminService.listarUsuarios({ q, lotacao_id })`).
- `User.posto` existe no schema mas **não é populado** — `userService.upsertFromSisbom` só grava cpf/matrícula/nome/nome_curto/lotação.
- O snapshot `/external` do SISBOM (já consumido pelo sync) **já projeta `_patente`** (`external.js`: `militar: [..., "_patente", ...]`), mas é um **código numérico**.
- O SISBOM tem uma **tabela estática de patentes** (`resources.js` → `patentes()`): 72 linhas, forças 0–3, cada uma `{ id, forca_id, str_patentesigla, str_patente }`. O `id` é exatamente o `_patente` do militar e **o id já codifica a hierarquia** (dentro de cada força: 1º id = CEL … último = SD/AL). Estática, nunca muda em runtime.

## Ideia central: cascata de especificidade (3 camadas)

As três fontes que o usuário pediu não competem — são **camadas de uma cascata**, como CSS/config: a regra mais específica vence, com fallback para a mais geral. Para uma vaga sendo preenchida, as **patentes esperadas** resolvem na ordem (primeira que existir vence):

1. **Layout** — patentes esperadas declaradas na vaga daquele layout (mais específica).
2. **Lotação** — regra da lotação para aquela função (catálogo, `lotacao_id` setado).
3. **Global** — catálogo geral por função (`lotacao_id` nulo, fallback padrão).
4. **Nenhuma** → sem regra → **sem aviso** (degrada gracioso).

Resolvidas as esperadas: se a patente do militar **não** está no conjunto (ou o militar não tem patente), gera **aviso não-bloqueante**.

> Normalização mata o caos de string: a comparação por função sempre usa `funcao_norm` = UPPER + trim + colapso de espaços + remoção de acentos (NFD). Assim "Comandante" e "COMANDANTE" caem na mesma regra.

## Modelo de dados

### 1. `Patente` (réplica local estática)
```prisma
model Patente {
  id       Int    @id            // = _patente do SISBOM (NÃO autoincrement)
  forca_id Int
  sigla    String                // str_patentesigla, ex.: "1º SGT"
  nome     String                // str_patente, ex.: "1º Sargento"
  ordem    Int                   // hierarquia dentro da força (1 = mais alta), p/ ordenar UI
  militares User[]
}
```
Seeder novo (`patentes.seeder.ts`) replica **verbatim** o array `patentes()` do `resources.js` do SISBOM (72 linhas, forças 0–3). `ordem` = posição sequencial dentro de cada `forca_id` (1-based). Fonte da verdade citada no seeder. Idempotente (upsert por `id`).

### 2. `User.patente_id`
```prisma
  patente_id Int?
  patente    Patente? @relation(fields: [patente_id], references: [id])
```
- `userService.upsertFromSisbom` passa a gravar `patente_id: data._patente ? Number(data._patente) : null`.
- Backfill dos ~4.700 usuários já sincronizados: reexecutar `pnpm --filter backend bulk-sync` (o snapshot `/external` já traz `_patente`) — sem mudança no SISBOM.
- `MilitarDTO.posto` (já existente, hoje sempre null) permanece; **adicionamos `patente_id` e `patente_sigla`** ao DTO para a UI.

### 3. `FuncaoPatente` (catálogo — **as três camadas numa tabela só**)
```prisma
model FuncaoPatente {
  id          Int      @id @default(autoincrement())
  lotacao_id  Int?                    // camada LOTAÇÃO (setado)
  template_id Int?                    // camada LAYOUT (setado)
  funcao_norm String                  // função normalizada
  patente_ids Int[]                   // patentes esperadas (ids de Patente); [] = silencia
  lotacao     Lotacao?         @relation(fields: [lotacao_id], references: [id], onDelete: Cascade)
  template    TemplateLotacao? @relation(fields: [template_id], references: [id], onDelete: Cascade)
}
```
Escopo pela combinação de chaves (a **existência da linha** = "a regra existe", o que substitui o `null`-vs-ausente):
- **GLOBAL:** `lotacao_id` nulo, `template_id` nulo.
- **LOTAÇÃO:** `lotacao_id` setado, `template_id` nulo.
- **LAYOUT:** `template_id` setado.

> **Por que uma tabela só (e não uma coluna `Int[]?` na TemplateVagaSugerida):** o Prisma **não suporta scalar list opcional** (`Int[]?` é inválido; listas escalares são sempre não-nulas, default `[]`), então não dá para expressar "null = herda" numa coluna de array. Unificar na `FuncaoPatente` resolve isso (linha existe = regra) e ainda deixa a cascata num mecanismo único.
>
> **Unicidade por escopo:** como `NULL` não deduplica em `@@unique` do Postgres, a unicidade vem de **índices únicos parciais** escritos à mão na migration:
> - `WHERE lotacao_id IS NULL AND template_id IS NULL` sobre `(funcao_norm)` — global
> - `WHERE lotacao_id IS NOT NULL AND template_id IS NULL` sobre `(lotacao_id, funcao_norm)` — lotação
> - `WHERE template_id IS NOT NULL` sobre `(template_id, funcao_norm)` — layout
>
> O service ainda checa existência antes de criar para devolver 409 amigável. (Prisma ignora índices que não conhece — ok.)

A camada **LAYOUT** é autorada no editor de layout (2b.2): ao salvar o layout, o `layoutService` sincroniza as linhas `FuncaoPatente(template_id=<layout>)` daquele template. No 2b.1 a resolução já consulta essa camada, mas não há UI para criá-la ainda.

**Migration `0011`** (SQL à mão, sem shadow DB, aplicada com `migrate deploy` em dev+test): cria `Patente`, adiciona `User.patente_id` (+FK), cria `FuncaoPatente` + os 3 índices únicos parciais.

## Resolução + aviso (backend)

Util novo `utils/funcao.ts`:
```ts
export function normalizeFuncao(s: string): string  // UPPER+trim+colapsa espaços+strip acento (NFD)
```

Service novo `patente.service.ts`:
```ts
// Retorna as patentes esperadas para uma vaga, aplicando a cascata. null = sem regra.
esperadasPara(funcao: string, lotacao_id: number, template_id: number | null, prisma): Promise<number[] | null>
```
Ordem de resolução (primeira linha encontrada vence):
1. Se `template_id` != null: `FuncaoPatente(template_id = <layout>, funcao_norm)` → `patente_ids` (LAYOUT).
2. `FuncaoPatente(lotacao_id = <lotação>, template_id = null, funcao_norm)` → `patente_ids` (LOTAÇÃO).
3. `FuncaoPatente(lotacao_id = null, template_id = null, funcao_norm)` → `patente_ids` (GLOBAL).
4. `null`.

> Um conjunto **vazio** (`[]`) numa regra explícita significa "sem restrição / silencia o aviso" e é distinto de `null` (herda). A resolução para na primeira camada que retorna não-null, mesmo que `[]`.

Regra de aviso por vaga preenchida:
- `esperadas = esperadasPara(...)`. Aviso **existe** quando `esperadas != null && esperadas.length > 0 && (militar.patente_id == null || !esperadas.includes(militar.patente_id))`.

**Comportamento não-bloqueante:** o aviso NUNCA vira erro. `putDia` salva normalmente (a validação de conflito de turno existente, essa sim bloqueante, permanece intacta).

## Onde o aviso aparece (web)

1. **GET do dia** (`getDia`): cada `VagaDTO` ganha:
   - `patentes_esperadas: number[] | null` (resolvidas server-side)
   - `aviso_patente: boolean` (true se a vaga preenchida diverge, pela regra acima)
2. **MilitarPicker**: `listarMilitares` passa a devolver `patente_id`+`patente_sigla` por militar. O picker, recebendo `patentes_esperadas` da vaga, **destaca/rebaixa** (não esconde) militares fora do conjunto e mostra a sigla da patente no rótulo.
3. **Editor do dia**: badge de aviso na vaga divergente (lê `aviso_patente`); ao salvar, se qualquer vaga tem `aviso_patente`, notificação resumo ("N vaga(s) com patente divergente — salvo mesmo assim").
4. **Aprovação do gestor** (2b.2, nice-to-have): lista consolidada de divergências de patente na tela de aprovar.

## Administração das regras (web)

- **Catálogo de funções** (2b.1): tela nova (super-admin) para CRUD de `FuncaoPatente` — escolher escopo (Global ou uma Lotação), digitar a função e multi-selecionar patentes (ordenadas por `ordem`, agrupadas por força). Rotas REST `/funcao-patentes` (GET lista por escopo, POST, PUT, DELETE) com guard super-admin para escrita.
- **Editor de layout** (2b.2): campo "Patentes esperadas" por vaga sugerida (multi-select), gravado em `TemplateVagaSugerida.patentes_esperadas`.

## Escopo / ordem de construção

**2b.1 — núcleo (este slice):**
- `Patente` + seeder; migration 0011 (Patente, User.patente_id, FuncaoPatente + 3 índices únicos parciais).
- Sync grava `patente_id`; backfill via bulk-sync.
- `FuncaoPatente` CRUD para escopos Global + Lotação (template_id sempre null aqui) + guard.
- `normalizeFuncao`, `patente.service.esperadasPara` (a resolução já inclui a camada LAYOUT por `template_id`, mas sem UI para criá-la ainda).
- Surfaces: `MilitarDTO` (+patente), `VagaDTO` (+patentes_esperadas, +aviso_patente), MilitarPicker (destaque), editor do dia (badge + notificação), catálogo admin.

**2b.2 — camada layout + gestor:**
- UI no editor de layout que sincroniza linhas `FuncaoPatente(template_id=...)`.
- Lista de divergências na tela de aprovação.

## Fora de escopo (YAGNI)
- Regra "patente X ou acima" (usar `ordem`): por ora a regra é um **conjunto explícito** de patentes. `ordem` fica só para ordenar a UI e como base futura.
- Elegibilidade por **cursos** do SISBOM (`militar-cursos`) — camada futura, mais fina, fora do 2b.
- Qualquer bloqueio rígido — decisão explícita: sempre soft.
- Mudança no `sisbom-api` — nenhuma; a patente é replicada localmente e o `_patente` já vem no snapshot.

## Testes
- **Unit:** `normalizeFuncao` (caixa/acento/espaço); `esperadasPara` (cada camada e a precedência; null vs [] ; sem template).
- **Integração (Postgres de teste):** seeder de Patente idempotente; `upsertFromSisbom` grava `patente_id`; regra de aviso (bate / não bate / militar sem patente / função sem regra); CRUD de `FuncaoPatente` (inclusive o guard de unicidade global e o guard de papel); `getDia`/`listarMilitares` expõem os campos novos; `putDia` salva apesar de divergência.
- **Web (MSW/RTL):** MilitarPicker destaca militar fora da patente e mostra sigla; editor do dia mostra badge + notificação ao salvar; tela de catálogo cria/edita regra.

## Constraints globais (herdadas do projeto)
- Repo `escalas`: sempre `main`, commit direto; push só sob ordem explícita.
- ESM (import com `.js`), 2 espaços, resposta `{success, message, data}`, rotas `/api/v1/`, pt-BR snake_case.
- Migration = SQL à mão + `migrate deploy` em dev **e** test; nunca `migrate dev` (sem shadow DB).
- `@types/react` unificado no workspace (não regredir).
```
