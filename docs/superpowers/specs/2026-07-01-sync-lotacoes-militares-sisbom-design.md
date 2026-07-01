# Sync de Lotações + Militares do SISBOM — Design

**Data:** 2026-07-01
**Autor:** SD Filho (dev SISBOM/CTIC)
**Status:** aprovado (3 decisões-chave confirmadas pelo usuário)

## Objetivo

Puxar do SISBOM **todas as lotações (86) e todos os militares (4.776) do CBMRN**
para a réplica local do Escalas, reusando o sync PULL que já existe
(`mirror-ref → events` incremental; `snapshot` no bulk). Ao final, o Escalas terá
o organograma real e o efetivo real, com militares vinculados às suas lotações.

## Estado atual

- `sync.service.ts` sincroniza **só `militar`** (`TRACKED = ['militar']`).
- `user.service.upsertFromSisbom` grava cpf/nome/matrícula/nome_curto/ativo — **não
  mapeia `_lotacao`**, então militares locais ficam **sem vínculo de lotação**.
- Lotações vêm de um **seed local fabricado** (`seeders/data/lotacoes.json`, 6 entradas,
  ids numéricos 2/14/100 que **não existem no SISBOM**).
- `Lotacao.id Int @id` é load-bearing: FKs em `UserLotacao`, `UserRole`,
  `TemplateLotacao`, `Escala` + ~51 usos em ~30 arquivos (backend/web/mobile/testes).

## Descobertas empíricas (sisbom-dev, 2026-07-01)

Confirmadas por query direta ao Mongo `sisbom-dev`:

| Fato | Valor |
|------|-------|
| Identidade da lotação | **`ref` string** (`"CTIC"`, `"CFAP"`, `"ASS_ADM"`) — **única (86/86)** |
| Hierarquia | `_pai` = ref do pai; 23 raízes (`_pai=""`); **0 órfãos** |
| `str_sigla` | **NÃO é única** (`"2º SGB"`, `"1º SGB"`, `"CIOPAER"` repetem) |
| `nivel` | vem como **string** (`"1"`,`"2"`,`"3"`) e às vezes número |
| Militar `_lotacao` | **ref string** da lotação (`"CFAP"`); confirma comentário do `missao360.js` |
| Militares sem lotação | **3.793 / 4.776** (só ~983 vinculáveis) |
| Militares sem cpf | 37 (já são pulados hoje) |
| `_patente` | frequentemente `null` — **não** usado para `posto` |

## Decisões (aprovadas)

1. **Chave da Lotacao: surrogate `Int` + `sisbom_ref` natural.** Mantém `Lotacao.id Int`
   (zero mudança em FKs/web/mobile/testes); `sisbom_ref` é a chave de sync. O sync
   resolve ref↔id.
2. **Dados dev: resetar e repopular do SISBOM.** Limpa Lotacao (e escalas/templates de
   teste dependentes) e roda o bulk — dev passa a espelhar os 86 reais.
3. **Seeder local: manter como fallback offline.** O bulk do SISBOM é a fonte real;
   o `seed:lotacoes` fica pra dev sem acesso ao SISBOM.
4. **`UserLotacao.nivel` na sincronização = `Lotacao.nivel`** (profundidade na hierarquia;
   consistente com o uso atual, que só lê o vínculo como filtro).
5. **Troca de lotação de um militar:** guardar `User.sisbom_lotacao_ref`; ao mudar,
   remover o `UserLotacao` derivado do ref antigo e criar o do novo — **sem** apagar
   vínculos adicionados manualmente no Escalas.

## Desenho

### 1. Migration `Lotacao` (0009)

```prisma
model Lotacao {
  id             Int     @id @default(autoincrement())   // era: @id (externo)
  sisbom_id      String? @unique                          // NOVO: uuid _id
  sisbom_ref     String? @unique                          // NOVO: ref natural ("CTIC")
  sigla          String                                   // dropar @unique (colide)
  sigla_extenso  String?                                  // NOVO
  nome           String
  lotacao_pai_id Int?
  nivel          Int
  operacional    Boolean @default(false)
  externo        Boolean @default(false)
  last_sync_at   DateTime?                                // NOVO
  // relações inalteradas
}
```

`User` ganha `sisbom_lotacao_ref String?` (ref cru da última lotação SISBOM, para
reconciliar trocas).

Ambiente **sem shadow DB** → migration gerada por `prisma migrate diff --script` e
aplicada com `prisma migrate deploy` (padrão já usado nas migrations 0006–0008).

### 2. `lotacao.service.ts` (novo)

Responsabilidade única: traduzir um doc de lotação do SISBOM → linha local, resolvendo
hierarquia por `sisbom_ref`.

- `upsertFromSisbom(data, ts, prisma)`: mapeia `_id→sisbom_id`, `ref→sisbom_ref`,
  `str_sigla→sigla`, `str_sigla_extenso→sigla_extenso`, `str_nome→nome`,
  `Number(nivel)→nivel`, `operacional`, `externo`; resolve `_pai` (ref) → `lotacao_pai_id`
  buscando `Lotacao.sisbom_ref`. Se o pai ainda não existe, grava `lotacao_pai_id=null`
  (reconciliado na próxima passada/evento do pai). Upsert por `sisbom_ref`.
- `applyEvent(event, prisma)`: `delete/remove` não apaga (lotação some raramente); apenas
  ignora ou marca — MVP: trata só create/patch/upsert via `upsertFromSisbom`. (Delete de
  lotação fora de escopo — raro e perigoso com FKs.)

### 3. `user.service.ts` (alterado)

- `upsertFromSisbom` passa a: (a) fazer o upsert do User como hoje **+ `sisbom_lotacao_ref`**;
  (b) chamar `linkLotacao(userId, refAntigo, refNovo, prisma)`.
- `linkLotacao`: se `refNovo` vazio → apenas remove o vínculo SISBOM antigo (se havia);
  senão resolve `refNovo`→Lotacao por `sisbom_ref`; se achou, garante `UserLotacao(user,
  lotacao, nivel=lotacao.nivel)` e, se `refAntigo`≠`refNovo`, remove o `UserLotacao` do
  ref antigo. Lotação inexistente localmente → loga `warn` e segue (militar fica sem vínculo).

### 4. `sync.service.ts` (alterado)

- `TRACKED = ['lotacoes', 'militar']` — **ordem importa** (lotações primeiro).
- `runOnce`: no loop de eventos, dispatch por `ev.entity`: `lotacoes → lotacaoService`,
  `militar → userService`.
- `bulkSnapshot`: para `lotacoes`, coletar todas as páginas e **ordenar por `nivel` asc**
  antes de aplicar (pais antes das filhas); depois `militar`.

### 5. Seeder + bulk + reset

- `seeders/data/lotacoes.json`: comentar no header que é **fallback offline**; sem mudança
  estrutural.
- Reset dev: script `cli/resetSisbomData.ts` (novo) que, em ordem de FK, limpa
  escalas/templates/vínculos/lotações fabricadas e chama `bulkSnapshot`. Rodado manualmente
  (`npm run reset-sisbom` no backend). Guardado por confirmação/env pra não rodar em prod.

## Componentes / arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `prisma/schema.prisma` | modificar | campos novos em Lotacao + User; dropar `sigla @unique` |
| `prisma/migrations/…_0009_lotacoes_sync/` | criar | migration via diff --script |
| `services/lotacao.service.ts` | criar | mapear/resolver lotação SISBOM→local |
| `services/user.service.ts` | modificar | mapear `_lotacao`→UserLotacao + sisbom_lotacao_ref |
| `services/sync.service.ts` | modificar | TRACKED+ordem, dispatch lotacoes, bulk ordenado |
| `cli/resetSisbomData.ts` | criar | reset dev + re-bulk |
| `seeders/data/lotacoes.json` | modificar | marcar como fallback |
| `package.json` (backend) | modificar | script `reset-sisbom` |
| testes de integração | criar | lotacao.service, user linkage, sync ordem |

## Fluxo de dados

```
cron 5min → syncService.runOnce
  → getMirrorRef  (ref.lotacoes, ref.militar)
  → p/ 'lotacoes': getEvents(since) → lotacaoService.upsertFromSisbom (resolve _pai)
  → p/ 'militar':  getEvents(since) → userService.upsertFromSisbom → linkLotacao(UserLotacao)
bulk (1x / recuperação) → bulkSnapshot
  → snapshot('lotacoes') paginado → ordena por nivel → upsert
  → snapshot('militar')  paginado → upsert + linkLotacao
```

## Tratamento de erros / edge cases

- **Item ruim** (sem cpf, sem ref): loga `warn` e pula — não trava o cursor (comportamento atual mantido).
- **Pai ainda não sincronizado**: `lotacao_pai_id=null` temporário; corrige no evento/página do pai.
- **Lotação do militar inexistente local**: militar entra sem vínculo, `warn` logado.
- **`nivel` string/num**: `Number(nivel)`; se `NaN` → `0` + `warn`.
- **`sigla` duplicada**: OK, `@unique` removido.
- **Reset em prod**: bloqueado por guard (`NODE_ENV!=='production'` + flag explícita).

## Testes

Integração (Vitest + Postgres de teste), reusando `tests/helpers/db.ts`:
- `lotacao.service`: upsert cria/atualiza por `sisbom_ref`; resolve `_pai`; pai ausente→null; `nivel` string→int.
- `user.service`: `_lotacao` resolve→UserLotacao com `nivel=lotacao.nivel`; troca de ref remove o antigo e cria o novo; ref inexistente→sem vínculo + sem erro; vínculo manual preservado.
- `sync.service`: bulk aplica lotações antes de militares; ordena por nivel; evento de militar após lotação vincula certo.

## Fora de escopo

- **Mapa de força** (`/external/mapa-forca` nem existe no SISBOM ainda) → passo 5.
- **Delete de lotação** via evento.
- Re-chavear Lotacao para string PK (rejeitado — invasivo).

## Validação (pós-implementação)

Live contra `sisbom-dev` (Mongo já rodando): subir `api_sisbom` local com
`ESCALAS_API_KEY`, apontar `SISBOM_EXTERNAL_BASE_URL` do Escalas pra ele, rodar
`npm run reset-sisbom` e conferir: 86 lotações com hierarquia (23 raízes), ~983
militares vinculados, contagens batendo.
