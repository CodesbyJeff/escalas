# Fundação de Dados Reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os dados fictícios do Escalas por dados reais do SISBOM (lotações + militares lotados + patentes) e gerar automaticamente os layouts de lotação/guarnição a partir do mapa de força real, para servir de base ao motor de preenchimento (Ciclo 2c).

**Architecture:** Três fases. (0a) Higiene local: reusa o `reset-sisbom` existente (limpa lotação/escala/template, preserva super-admins, re-sincroniza do SISBOM populando `patente_id`) + um CLI de acabamento que remove os soldados-teste órfãos e reatribui os papéis de teste a uma lotação real. (0b) Um endpoint somente-leitura no `sisbom-api` que projeta a coleção `mapa-guarnicoes`. (0c) Um importador no Escalas que agrega esse mapa por lotação→atividade→função e persiste `TemplateLotacao`/`TemplateGuarnicao` idempotentes.

**Tech Stack:** Escalas — Node 20 + TypeScript ESM, Express, Prisma + PostgreSQL 16, Zod, Vitest. sisbom-api — Node 20, Express, MongoDB, ESM (2 espaços, CommonJS no build esbuild).

## Global Constraints

- **Escalas:** ESM, imports com `.js`; 2 espaços; resposta `{success, message, data}`; rotas `/api/v1/`. Sempre `main`, commit direto; push só sob ordem explícita.
- **sisbom-api:** sempre branch `feat/escalas-external`; 2 espaços; NUNCA concluir merges (o usuário faz); commit padrão `<emoji> <tipo>: <descrição pt-BR>`; deploy (`deploy:sisbom`) é passo do usuário, autorizado nesta rodada mas executado por ele.
- **Aviso/elegibilidade continua SOFT** — nada de bloqueio rígido. Sem migration nova (usa modelos existentes).
- **Guard anti-prod obrigatório** em qualquer operação destrutiva (padrão do `resetSisbomData`: recusa se `NODE_ENV==='production'` ou sem `--yes`).
- **Só as 13 lotações operacionais reais com efetivo** entram na geração de layouts.
- Ao fim de cada task no Escalas: `npm test` (backend), `npm run typecheck`, `npm run lint`.

---

## File Structure

- `apps/backend/src/cli/higieneDados.ts` (novo) — acabamento pós-reset: remove soldados-teste órfãos, reatribui papéis do Admin a uma lotação real. Guard anti-prod.
- `apps/backend/src/utils/seedData.ts` (novo) — predicado puro `ehUsuarioSeedTeste(user)` (testável).
- `apps/backend/src/utils/seedData.test.ts` (novo) — teste do predicado.
- `sisbom-api/src/api_sisbom/routes/external.js` (modificar) — adiciona `mapa-guarnicoes` à whitelist + projeção.
- `apps/backend/src/integrations/sisbom/client.ts` (modificar) — `getSnapshot` aceita `since` opcional.
- `apps/backend/src/services/mapaLayout.service.ts` (novo) — `agregarLayout(docs)` (puro) + `gerarParaLotacao` / `gerarTodas` (persistência idempotente).
- `apps/backend/src/services/mapaLayout.service.test.ts` (novo) — testes da agregação pura.
- `apps/backend/src/integrations/sisbom/types.ts` (modificar) — tipo `MapaGuarnicaoDoc`.
- `apps/backend/src/cli/gerarLayoutsMapaForca.ts` (novo) — CLI que puxa o snapshot e chama `gerarTodas`.

---

## FASE 0a — Higiene + re-sync de patentes (Escalas)

### Task 1: Predicado de dado-seed + CLI de higiene

**Files:**
- Create: `apps/backend/src/utils/seedData.ts`
- Create: `apps/backend/src/utils/seedData.test.ts`
- Create: `apps/backend/src/cli/higieneDados.ts`

**Interfaces:**
- Consumes: `resetSisbomData` (existente, `src/cli/resetSisbomData.ts`), `prisma`, `env.NODE_ENV`.
- Produces: `ehUsuarioSeedTeste(u: { sisbom_id: string | null; is_super_admin: boolean }): boolean`; `higieneDados(prisma, { nodeEnv, confirm, lotacaoTesteId })`.

- [ ] **Step 1: Escrever o predicado puro (falha)**

Criar `apps/backend/src/utils/seedData.ts`:
```ts
// Um usuário é "seed de teste" quando não veio do SISBOM (sem sisbom_id) e não
// é super-admin (os 3 super-admins locais — TEN PETER/VIEIRA/Admin — são preservados
// para não perder login/testes). Ver docs/superpowers/specs/2026-07-03-fundacao-dados-reais-design.md.
export function ehUsuarioSeedTeste(u: { sisbom_id: string | null; is_super_admin: boolean }): boolean {
  return u.sisbom_id == null && !u.is_super_admin;
}
```

- [ ] **Step 2: Teste do predicado**

Criar `apps/backend/src/utils/seedData.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ehUsuarioSeedTeste } from './seedData.js';

describe('ehUsuarioSeedTeste', () => {
  it('soldado-teste (sem sisbom_id, não super) → true', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: null, is_super_admin: false })).toBe(true);
  });
  it('super-admin local (sem sisbom_id, super) → false (preserva login)', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: null, is_super_admin: true })).toBe(false);
  });
  it('militar real do SISBOM (com sisbom_id) → false', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: 'abc-123', is_super_admin: false })).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar — verificar que passa (predicado já implementado no Step 1)**

Run: `cd apps/backend && npm test -- seedData`
Expected: PASS (3 testes).

- [ ] **Step 4: CLI de higiene**

Criar `apps/backend/src/cli/higieneDados.ts`:
```ts
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { ehUsuarioSeedTeste } from '../utils/seedData.js';
import { logger } from '../utils/logger.js';

interface HigieneOpts {
  nodeEnv: string;
  confirm: boolean;
  lotacaoTesteId: number; // lotação real onde os papéis de teste do Admin serão recriados
}

// Acabamento pós reset-sisbom: (1) remove usuários seed-teste órfãos (não vieram do
// SISBOM e não são super-admin); (2) reatribui ESCALANTE/GESTOR/FISCAL do primeiro
// super-admin a uma lotação real, para exercitar os fluxos com dados reais.
export async function higieneDados(prismaClient: PrismaClient, opts: HigieneOpts): Promise<void> {
  if (opts.nodeEnv === 'production' || !opts.confirm) {
    throw new Error('higiene-dados: recusado (produção ou sem --yes).');
  }
  const lot = await prismaClient.lotacao.findUnique({ where: { id: opts.lotacaoTesteId } });
  if (!lot || lot.sisbom_ref == null) {
    throw new Error(`higiene-dados: lotação de teste ${opts.lotacaoTesteId} não é uma lotação real (com sisbom_ref).`);
  }
  await prismaClient.$transaction(async (tx) => {
    const users = await tx.user.findMany({ select: { id: true, sisbom_id: true, is_super_admin: true } });
    const seedIds = users.filter(ehUsuarioSeedTeste).map((u) => u.id);
    if (seedIds.length) {
      await tx.userRole.deleteMany({ where: { user_id: { in: seedIds } } });
      await tx.userLotacao.deleteMany({ where: { user_id: { in: seedIds } } });
      await tx.user.deleteMany({ where: { id: { in: seedIds } } });
    }
    const admin = await tx.user.findFirst({ where: { is_super_admin: true }, orderBy: { id: 'asc' } });
    if (admin) {
      for (const role of ['ESCALANTE', 'GESTOR', 'FISCAL'] as const) {
        await tx.userRole.upsert({
          where: { user_id_role_lotacao_id: { user_id: admin.id, role, lotacao_id: opts.lotacaoTesteId } },
          update: {},
          create: { user_id: admin.id, role, lotacao_id: opts.lotacaoTesteId },
        });
      }
    }
    logger.info('higiene_dados_done', { removidos: seedIds.length, admin_id: admin?.id, lotacao_teste: opts.lotacaoTesteId });
  });
}

const isMain =
  process.argv[1] != null &&
  /higieneDados\.(ts|js)$/.test(process.argv[1]) &&
  !process.env.VITEST;

if (isMain) {
  const lotArg = process.argv.find((a) => a.startsWith('--lotacao='));
  const lotacaoTesteId = lotArg ? Number(lotArg.split('=')[1]) : 174; // 1º SGB/1º GBM (NATAL)
  higieneDados(prisma, { nodeEnv: env.NODE_ENV, confirm: process.argv.includes('--yes'), lotacaoTesteId })
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error('higiene_dados_failed', { err: (e as Error).message });
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```
> A constraint `@@unique([user_id, role, lotacao_id])` do `UserRole` gera a chave composta `user_id_role_lotacao_id` no Prisma. Confirmar o nome no `schema.prisma`; se diferir, ajustar o `where` do upsert.

- [ ] **Step 5: typecheck + lint + commit (SEM rodar ainda — execução é o Step 6)**

```bash
cd apps/backend && npm run typecheck && npm run lint && npm test
cd ../.. && git add apps/backend/src/utils/seedData.ts apps/backend/src/utils/seedData.test.ts apps/backend/src/cli/higieneDados.ts
git commit -m "✨ feat(cli): higiene de dados seed pós reset-sisbom (remove soldados-teste, reatribui papéis a lotação real)"
```

- [ ] **Step 6: EXECUÇÃO da higiene (controlador, com backup) — NÃO é subagent**

Este passo é destrutivo e roda uma vez no ambiente dev. O controlador executa (não o subagent implementador):
```bash
# 1) Backup
pg_dump "postgresql://escalas:escalas@localhost:5432/escalas_dev" > "$SCRATCH/escalas_dev_pre_higiene_$(date +%Y%m%d_%H%M%S).sql"
# 2) Reset (limpa lotação/escala/template, preserva super-admins, re-sincroniza do SISBOM → popula patente_id)
cd apps/backend && npm run reset-sisbom -- --yes
# 3) Higiene (remove soldados-teste órfãos + reatribui papéis do Admin à lot real 174)
npx tsx src/cli/higieneDados.ts --yes --lotacao=174
```
Expected: reset loga `reset_sisbom_done`; higiene loga `higiene_dados_done` com `removidos` ≥ 6.

- [ ] **Step 7: Verificação da Fase 0a**

Rodar um one-shot de auditoria (via `tsx`): confirmar
- `lotacao.count({ where: { sisbom_ref: null } })` === 0
- `user.count({ where: { sisbom_id: null, is_super_admin: false } })` === 0
- `user.count({ where: { patente_id: { not: null } } })` ≈ 868 (militares lotados com patente)
- `userRole` do Admin tem ESCALANTE/GESTOR/FISCAL na lotação 174.

Registrar os números no ledger `.superpowers/sdd/progress.md`.

---

## FASE 0b — Entidade `mapa-guarnicoes` no `/external` (sisbom-api)

### Task 2: Projeção somente-leitura do mapa de força

**Files:**
- Modify: `sisbom-api/src/api_sisbom/routes/external.js`

**Interfaces:**
- Consumes: `repository('mapa-guarnicoes', { skip: { global_user: 1, global_institution: 1 } })` (padrão do model existente); auth `x-api-key` já no router.
- Produces: `GET /external/snapshot?entity=mapa-guarnicoes&since=&skip=&limit=` retornando docs projetados.

- [ ] **Step 1: Ler o arquivo e localizar o mapa de entidades**

Ler `sisbom-api/src/api_sisbom/routes/external.js`. Identificar: (a) `DEFAULT_ENTITIES`/whitelist de entidades e (b) o `ENTITY_FIELDS` (map de projeção por entidade, ex.: `militar: [...]`), (c) o handler de `/snapshot` (que hoje usa `repository(entity)` + projeção).

- [ ] **Step 2: Adicionar a entidade + projeção**

No `external.js`, adicionar `mapa-guarnicoes` à whitelist de entidades permitidas no `/snapshot` (e `since` no filtro por `date_start`). Projeção (nível-topo + subdocumento `guarnicao`):
```js
// campos de topo expostos do mapa de força (nunca o doc inteiro: sem timeline,
// alterações, odômetro). guarnicao[] traz só identidade + função + diária.
"mapa-guarnicoes": [
  "_id", "_lotacao", "_viatura", "atividade", "atividade_extra",
  "date", "date_start", "date_end", "time_start", "time_end", "prefixo", "deleted",
  "guarnicao._id", "guarnicao._militar", "guarnicao.str_funcao", "guarnicao._patente", "guarnicao.bo_diaria",
],
```
Filtro do snapshot para esta entidade: `{ deleted: { $ne: true } }` e, se `since` vier, `date_start: { $gte: since }`. Se o handler atual de `/snapshot` já monta a projeção a partir do array de campos e aplica `deleted`, basta somar a entrada acima e o filtro `since`. Se o `since` ainda não existir no `/snapshot`, adicioná-lo como opcional (`req.query.since`), aplicando só quando presente — sem quebrar `militar`/`lotacoes`.

- [ ] **Step 3: Smoke contra o sisbom-dev local**

Subir o sisbom-api local (`npm start`, api_sisbom em :3030) OU usar a URL de dev já configurada. Com a chave `ESCALAS_API_KEY`:
```bash
# sem chave → 401/503 (auth intacta)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3030/api_sisbom/external/snapshot?entity=mapa-guarnicoes&limit=1"
# com chave → 200 + docs projetados
curl -s "http://localhost:3030/api_sisbom/external/snapshot?entity=mapa-guarnicoes&limit=2" -H "x-api-key: $ESCALAS_API_KEY"
```
Expected: sem chave bloqueia; com chave retorna `guarnicao[]` só com `{_id,_militar,str_funcao,_patente,bo_diaria}` e nenhum campo fora da whitelist (sem `timeline`, `odometro`).

- [ ] **Step 4: Commit (na branch feat/escalas-external; NÃO mergear/deployar)**

```bash
cd sisbom-api && git add src/api_sisbom/routes/external.js
git commit -m "✨ feat(external): expõe mapa-guarnicoes projetado no /external/snapshot"
```
> Deploy (`deploy:sisbom`) e merge são passos do usuário. Avisar que a Fase 0c precisa desse endpoint no ar (ou do sisbom-api local rodando) para consumir.

---

## FASE 0c — Importador + geração de layouts (Escalas)

### Task 3: `getSnapshot` aceita `since` opcional

**Files:**
- Modify: `apps/backend/src/integrations/sisbom/client.ts:48-53`
- Modify: `apps/backend/src/integrations/sisbom/types.ts`
- Test: `apps/backend/src/tests/unit/sisbom-client.test.ts`

**Interfaces:**
- Produces: `sisbomClient.getSnapshot({ entity, since?, skip?, limit? })`; tipo `MapaGuarnicaoDoc`.

- [ ] **Step 1: Adicionar `since` ao `getSnapshot`**

Em `client.ts`, trocar o método:
```ts
  async getSnapshot(params: { entity: string; since?: string; skip?: number; limit?: number }): Promise<SnapshotResponse> {
    const res = await this.external.get<SnapshotResponse>('/snapshot', {
      params: { entity: params.entity, since: params.since, skip: params.skip ?? 0, limit: params.limit ?? 500 },
    });
    return res.data;
  }
```
(axios omite `since` da querystring quando `undefined`.)

- [ ] **Step 2: Tipo do doc do mapa de força**

Em `types.ts`, adicionar:
```ts
export interface MapaGuarnicaoMembro {
  _id?: string;
  _militar?: string;
  str_funcao?: string | null;
  _patente?: number | null;
  bo_diaria?: boolean;
}
export interface MapaGuarnicaoDoc {
  _lotacao: string;
  atividade?: string | null;
  atividade_extra?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  guarnicao?: MapaGuarnicaoMembro[];
}
```

- [ ] **Step 3: Teste do client (since presente/ausente)**

No `sisbom-client.test.ts` (segue o mock existente do arquivo — MSW/axios-mock), adicionar um caso: `getSnapshot({ entity: 'mapa-guarnicoes', since: '2026-04-01' })` inclui `since` nos params; sem `since` não inclui. Rodar:
```bash
cd apps/backend && npm test -- sisbom-client
```
Expected: PASS.

- [ ] **Step 4: typecheck + lint + commit**

```bash
cd apps/backend && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/integrations/sisbom/client.ts apps/backend/src/integrations/sisbom/types.ts apps/backend/src/tests/unit/sisbom-client.test.ts
git commit -m "✨ feat(sisbom): getSnapshot aceita since + tipo MapaGuarnicaoDoc"
```

---

### Task 4: Agregação pura `agregarLayout(docs)`

**Files:**
- Create: `apps/backend/src/services/mapaLayout.service.ts`
- Create: `apps/backend/src/services/mapaLayout.service.test.ts`

**Interfaces:**
- Consumes: `MapaGuarnicaoDoc` (Task 3).
- Produces: `agregarLayout(docs: MapaGuarnicaoDoc[]): { guarnicoes: GuarnicaoLayout[] }` onde `GuarnicaoLayout = { sigla, atividade, turno_padrao_inicio, turno_padrao_fim, ordem, vagas_sugeridas: { funcao, quantidade_sugerida }[] }` (formato aceito por `layoutService.criar`).

- [ ] **Step 1: Escrever os testes (falham)**

Criar `apps/backend/src/services/mapaLayout.service.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { agregarLayout } from './mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';

const doc = (atividade: string, time: [string, string], funcoes: string[]): MapaGuarnicaoDoc => ({
  _lotacao: 'L1', atividade, time_start: time[0], time_end: time[1],
  guarnicao: funcoes.map((f) => ({ _militar: 'x', str_funcao: f })),
});

describe('agregarLayout', () => {
  it('agrupa por atividade e cria uma guarnição por atividade (ordenadas)', () => {
    const out = agregarLayout([doc('INCENDIO', ['08:00', '08:00'], ['Comandante']), doc('RESGATE', ['08:00', '08:00'], ['Motorista'])]);
    expect(out.guarnicoes.map((g) => g.atividade)).toEqual(['INCENDIO', 'RESGATE']);
    expect(out.guarnicoes[0]!.ordem).toBe(0);
    expect(out.guarnicoes[1]!.ordem).toBe(1);
  });

  it('turno modal vence (08:00→08:00 aparece 2x, 07:00 1x)', () => {
    const out = agregarLayout([
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante']),
      doc('INCENDIO', ['07:00', '17:00'], ['Comandante']),
    ]);
    expect(out.guarnicoes[0]!.turno_padrao_inicio).toBe('08:00');
    expect(out.guarnicoes[0]!.turno_padrao_fim).toBe('08:00');
  });

  it('quantidade_sugerida = moda da contagem da função por serviço', () => {
    const out = agregarLayout([
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar', 'Auxiliar']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar', 'Auxiliar']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar']),
    ]);
    const vagas = out.guarnicoes[0]!.vagas_sugeridas;
    expect(vagas.find((v) => v.funcao === 'Comandante')!.quantidade_sugerida).toBe(1);
    expect(vagas.find((v) => v.funcao === 'Auxiliar')!.quantidade_sugerida).toBe(2); // moda: 2 (2 serviços) vs 1 (1 serviço)
  });

  it('função vazia vira "GUARNIÇÃO"; sigla trunca em 20; funcao em 60', () => {
    const out = agregarLayout([doc('SALVAMENTO AQUATICO LONGO NOME DEMAIS', ['07:00', '19:00'], ['', 'Mergulhador'])]);
    expect(out.guarnicoes[0]!.sigla.length).toBeLessThanOrEqual(20);
    expect(out.guarnicoes[0]!.vagas_sugeridas.some((v) => v.funcao === 'GUARNIÇÃO')).toBe(true);
  });

  it('turno inválido/ausente cai para 08:00→08:00', () => {
    const out = agregarLayout([doc('INCENDIO', ['', ''], ['Comandante'])]);
    expect(out.guarnicoes[0]!.turno_padrao_inicio).toBe('08:00');
    expect(out.guarnicoes[0]!.turno_padrao_fim).toBe('08:00');
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `cd apps/backend && npm test -- mapaLayout`
Expected: FAIL (agregarLayout não existe).

- [ ] **Step 3: Implementar a agregação pura**

Criar `apps/backend/src/services/mapaLayout.service.ts`:
```ts
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';

export interface VagaLayout { funcao: string; quantidade_sugerida: number }
export interface GuarnicaoLayout {
  sigla: string; atividade: string;
  turno_padrao_inicio: string; turno_padrao_fim: string;
  ordem: number; vagas_sugeridas: VagaLayout[];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function normFuncao(f: string | null | undefined): string {
  const s = (f ?? '').trim();
  return (s.length ? s : 'GUARNIÇÃO').slice(0, 60);
}
// moda de um array (empate → primeiro em ordem de inserção → determinístico)
function moda<T>(itens: T[]): T | undefined {
  const cont = new Map<T, number>();
  for (const i of itens) cont.set(i, (cont.get(i) ?? 0) + 1);
  let melhor: T | undefined; let max = -1;
  for (const [k, v] of cont) if (v > max) { max = v; melhor = k; }
  return melhor;
}

// Transforma docs do mapa de força (de UMA lotação) num layout: uma guarnição por
// atividade, turno modal, e uma vaga por função com quantidade = moda da contagem
// daquela função por serviço. Puro e determinístico.
export function agregarLayout(docs: MapaGuarnicaoDoc[]): { guarnicoes: GuarnicaoLayout[] } {
  const porAtividade = new Map<string, MapaGuarnicaoDoc[]>();
  for (const d of docs) {
    const at = (d.atividade ?? '').trim() || '-';
    if (!porAtividade.has(at)) porAtividade.set(at, []);
    porAtividade.get(at)!.push(d);
  }
  const atividades = [...porAtividade.keys()].sort();
  const guarnicoes: GuarnicaoLayout[] = atividades.map((at, ordem) => {
    const grupo = porAtividade.get(at)!;
    const inicios = grupo.map((d) => (d.time_start && HHMM.test(d.time_start) ? d.time_start : '08:00'));
    const fins = grupo.map((d) => (d.time_end && HHMM.test(d.time_end) ? d.time_end : '08:00'));
    // por serviço, conta ocorrências de cada função; depois tira a moda por função
    const contagensPorFuncao = new Map<string, number[]>();
    for (const d of grupo) {
      const contaLocal = new Map<string, number>();
      for (const m of d.guarnicao ?? []) {
        const f = normFuncao(m.str_funcao);
        contaLocal.set(f, (contaLocal.get(f) ?? 0) + 1);
      }
      for (const [f, n] of contaLocal) {
        if (!contagensPorFuncao.has(f)) contagensPorFuncao.set(f, []);
        contagensPorFuncao.get(f)!.push(n);
      }
    }
    const vagas_sugeridas: VagaLayout[] = [...contagensPorFuncao.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([funcao, contagens]) => ({
        funcao,
        quantidade_sugerida: Math.min(50, Math.max(1, moda(contagens) ?? 1)),
      }));
    return {
      sigla: at.slice(0, 20),
      atividade: at.slice(0, 40),
      turno_padrao_inicio: moda(inicios) ?? '08:00',
      turno_padrao_fim: moda(fins) ?? '08:00',
      ordem,
      vagas_sugeridas: vagas_sugeridas.length ? vagas_sugeridas : [{ funcao: 'GUARNIÇÃO', quantidade_sugerida: 1 }],
    };
  });
  return { guarnicoes };
}
```

- [ ] **Step 4: Rodar — passa**

Run: `cd apps/backend && npm test -- mapaLayout`
Expected: PASS (5 testes).

- [ ] **Step 5: typecheck + lint + commit**

```bash
cd apps/backend && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/services/mapaLayout.service.ts apps/backend/src/services/mapaLayout.service.test.ts
git commit -m "✨ feat(mapa-layout): agregação pura do mapa de força em estrutura de layout"
```

---

### Task 5: Persistência idempotente `gerarParaLotacao` / `gerarTodas`

**Files:**
- Modify: `apps/backend/src/services/mapaLayout.service.ts`
- Test: `apps/backend/src/tests/integration/mapaLayout.persist.test.ts`

**Interfaces:**
- Consumes: `agregarLayout` (Task 4); `layoutService.criar/atualizar/listar` (`template.service.ts`, assinatura `(lotacao_id, user_id, { nome, guarnicoes }, prisma)` / `(id, user_id, input, prisma)`); `sisbomClient.getSnapshot` (Task 3).
- Produces: `mapaLayoutService.gerarParaLotacao(lotacao_id, user_id, docs, prisma)`; `mapaLayoutService.gerarTodas(user_id, buscarDocs, prisma)`.

- [ ] **Step 1: Teste de integração (falha)**

Criar `apps/backend/src/tests/integration/mapaLayout.persist.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { mapaLayoutService } from '../../services/mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../../integrations/sisbom/types.js';

const NOME = 'Padrão (mapa de força)';
async function ctx() {
  const lot = await testPrisma.lotacao.create({ data: { id: 960, sigla: 'L960', nome: 'L', nivel: 3, operacional: true, sisbom_ref: 'L960' } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM960', nome: 'Adm', is_super_admin: true, last_sync_at: new Date() } });
  return { lot, admin };
}
const docs: MapaGuarnicaoDoc[] = [
  { _lotacao: 'L960', atividade: 'INCENDIO', time_start: '08:00', time_end: '08:00', guarnicao: [{ str_funcao: 'Comandante' }, { str_funcao: 'Motorista' }] },
];

describe('mapaLayoutService.gerarParaLotacao', () => {
  beforeEach(async () => { await resetDb(); });

  it('cria o layout "Padrão (mapa de força)" com as guarnições agregadas', async () => {
    const { lot, admin } = await ctx();
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    const tpls = await testPrisma.templateLotacao.findMany({ where: { lotacao_id: lot.id }, include: { guarnicoes: { include: { vagas_sugeridas: true } } } });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]!.nome).toBe(NOME);
    expect(tpls[0]!.guarnicoes[0]!.atividade).toBe('INCENDIO');
    expect(tpls[0]!.guarnicoes[0]!.vagas_sugeridas).toHaveLength(2);
  });

  it('é idempotente — re-rodar atualiza o mesmo layout (não duplica)', async () => {
    const { lot, admin } = await ctx();
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    expect(await testPrisma.templateLotacao.count({ where: { lotacao_id: lot.id, nome: NOME } })).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `cd apps/backend && npm test -- mapaLayout.persist`
Expected: FAIL.

- [ ] **Step 3: Implementar a persistência**

Adicionar a `mapaLayout.service.ts` (importar `PrismaClient`, `layoutService`, `logger`):
```ts
import type { PrismaClient } from '@prisma/client';
import { layoutService } from './template.service.js';
import { logger } from '../utils/logger.js';

const NOME_LAYOUT = 'Padrão (mapa de força)';

export const mapaLayoutService = {
  // Cria/atualiza o layout "Padrão (mapa de força)" da lotação a partir dos docs.
  // Idempotente: se já existe layout com esse nome, faz replace-all; senão cria.
  async gerarParaLotacao(lotacao_id: number, user_id: number, docs: MapaGuarnicaoDoc[], prisma: PrismaClient) {
    const { guarnicoes } = agregarLayout(docs);
    if (!guarnicoes.length) { logger.info('mapa_layout_skip_sem_docs', { lotacao_id }); return null; }
    const existentes = await layoutService.listar(lotacao_id, prisma);
    const atual = existentes.find((t) => t.nome === NOME_LAYOUT);
    const input = { nome: NOME_LAYOUT, guarnicoes };
    if (atual) return layoutService.atualizar(atual.id, user_id, input, prisma);
    return layoutService.criar(lotacao_id, user_id, input, prisma);
  },

  // Roda a geração para todas as lotações operacionais reais com efetivo.
  // `buscarDocs(lotacao)` devolve os docs do mapa de força daquela lotação
  // (o CLI injeta a busca via snapshot; o teste injeta um stub).
  async gerarTodas(user_id: number, buscarDocs: (lotacao: { id: number; sisbom_ref: string }) => Promise<MapaGuarnicaoDoc[]>, prisma: PrismaClient) {
    const lots = await prisma.lotacao.findMany({
      where: { sisbom_ref: { not: null }, operacional: true, user_lotacoes: { some: {} } },
      select: { id: true, sisbom_ref: true },
    });
    let feitas = 0;
    for (const lot of lots) {
      const docs = await buscarDocs({ id: lot.id, sisbom_ref: lot.sisbom_ref! });
      const r = await this.gerarParaLotacao(lot.id, user_id, docs, prisma);
      if (r) feitas++;
    }
    logger.info('mapa_layout_gerar_todas_done', { lotacoes: lots.length, feitas });
    return { lotacoes: lots.length, feitas };
  },
};
```
> Confirmar que `layoutService.listar(lotacao_id, prisma)` retorna itens com `{ id, nome }`. Se a assinatura diferir (ex.: exige role/where), usar `prisma.templateLotacao.findMany({ where: { lotacao_id, nome: NOME_LAYOUT } })` para achar o existente e ainda assim delegar create/update ao `layoutService`.

- [ ] **Step 4: Rodar — passa + suite + typecheck + lint + commit**

```bash
cd apps/backend && npm test -- mapaLayout.persist && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/services/mapaLayout.service.ts apps/backend/src/tests/integration/mapaLayout.persist.test.ts
git commit -m "✨ feat(mapa-layout): geração idempotente de layouts por lotação (gerarParaLotacao/gerarTodas)"
```

---

### Task 6: CLI `gerar-layouts-mapa-forca` + execução + verificação

**Files:**
- Create: `apps/backend/src/cli/gerarLayoutsMapaForca.ts`
- Modify: `apps/backend/package.json` (script `gerar-layouts`)

**Interfaces:**
- Consumes: `mapaLayoutService.gerarTodas` (Task 5), `sisbomClient.getSnapshot` (Task 3).

- [ ] **Step 1: CLI**

Criar `apps/backend/src/cli/gerarLayoutsMapaForca.ts`:
```ts
import { prisma } from '../config/db.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { mapaLayoutService } from '../services/mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

// Puxa todo o snapshot de mapa-guarnicoes (paginado) a partir de `since`, agrupa
// por _lotacao (sisbom_ref) e gera os layouts. `since` default = 90 dias atrás.
async function carregarMapaPorLotacao(since: string): Promise<Map<string, MapaGuarnicaoDoc[]>> {
  const porLot = new Map<string, MapaGuarnicaoDoc[]>();
  let skip = 0; const limit = 500;
  for (;;) {
    const resp = await sisbomClient.getSnapshot({ entity: 'mapa-guarnicoes', since, skip, limit });
    const docs = (resp.data ?? []) as unknown as MapaGuarnicaoDoc[];
    for (const d of docs) {
      const k = String(d._lotacao);
      if (!porLot.has(k)) porLot.set(k, []);
      porLot.get(k)!.push(d);
    }
    if (docs.length < limit) break;
    skip += limit;
  }
  return porLot;
}

async function main(): Promise<void> {
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const since = sinceArg ? sinceArg.split('=')[1]! : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const admin = await prisma.user.findFirst({ where: { is_super_admin: true }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('Nenhum super-admin para autoria dos layouts.');
  logger.info('gerar_layouts_carregando_mapa', { since });
  const porLot = await carregarMapaPorLotacao(since);
  const r = await mapaLayoutService.gerarTodas(
    admin.id,
    async (lot) => porLot.get(lot.sisbom_ref) ?? [],
    prisma,
  );
  logger.info('gerar_layouts_done', r);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { logger.error('gerar_layouts_failed', { err: (e as Error).message }); process.exit(1); })
  .finally(() => prisma.$disconnect());
```
> `Date.now()` é permitido em CLI (não roda em workflow). A chave de agrupamento é `sisbom_ref` da `Lotacao` local == `_lotacao` do doc (ambos a ref string do SISBOM). Confirmar essa igualdade no smoke; se o `_lotacao` do mapa vier como id numérico e não a ref, ajustar o `gerarTodas` para casar por `sisbom_id`/ref conforme os dados reais.

- [ ] **Step 2: Script no package.json**

Em `apps/backend/package.json`, em `scripts`, adicionar:
```json
"gerar-layouts": "tsx src/cli/gerarLayoutsMapaForca.ts"
```

- [ ] **Step 3: typecheck + lint + commit**

```bash
cd apps/backend && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/cli/gerarLayoutsMapaForca.ts apps/backend/package.json
git commit -m "✨ feat(cli): gera layouts das lotações a partir do mapa de força"
```

- [ ] **Step 4: EXECUÇÃO + verificação (controlador) — requer 0b no ar ou sisbom-api local**

Com `SISBOM_EXTERNAL_BASE_URL`/`SISBOM_API_KEY` apontando para o `/external` (sisbom-dev local ou publicado):
```bash
cd apps/backend && npm run gerar-layouts -- --since=2026-04-01
```
Verificar (via `tsx` one-shot): cada uma das 13 lotações operacionais reais com efetivo tem 1 `TemplateLotacao` "Padrão (mapa de força)"; abrir 2-3 (ex.: 1º SGB Natal, GBSA) e conferir que as atividades/funções batem com o mapa real. Registrar contagens no ledger. Se alguma lotação vier sem docs no período, é `feitas < lotacoes` — logar quais e decidir com o usuário se amplia o `--since`.

---

## Self-Review (preenchido)

- **Cobertura do spec:** Fase 0a (higiene+resync) = Task 1; Fase 0b (endpoint) = Task 2; Fase 0c (client since=T3, agregação=T4, persistência=T5, CLI+execução=T6). O motor 2c é sub-projeto 2 (spec/plano próprios). ✔
- **Sem placeholders:** predicado, higiene, agregação e persistência têm código completo; passos imperativos têm comandos exatos; T2/T6 marcam explicitamente os pontos a confirmar contra o dado real (nome da chave composta do UserRole; formato de `_lotacao`) em vez de deixar vago. ✔
- **Consistência de tipos:** `MapaGuarnicaoDoc` (T3) consumido em T4/T5/T6; `agregarLayout` retorna `{guarnicoes: GuarnicaoLayout[]}` no formato de `layoutService.criar`; `gerarParaLotacao(lotacao_id, user_id, docs, prisma)` e `gerarTodas(user_id, buscarDocs, prisma)` idênticos entre service, teste e CLI. ✔
- **Riscos anotados:** (a) chave composta `user_id_role_lotacao_id` — confirmar no schema (T1 Step 4). (b) `layoutService.listar` assinatura — fallback via `templateLotacao.findMany` (T5 Step 3). (c) `_lotacao` do mapa = ref string vs id — confirmar no smoke (T6 Step 1). (d) 0c depende de 0b no ar/local. (e) turno modal achata GBSA de turnos mistos — aceitável (escalante ajusta), documentar no resultado.

## Validação final (controlador, pós-Fase 0)
Re-auditar `escalas_dev`: 0 lotações sem ref; só 3 super-admins sem `sisbom_id`; ~868 lotados com patente; 13 lotações com layout "Padrão (mapa de força)". Amostrar 2-3 layouts contra o mapa de força real. Atualizar a memória do projeto e o ledger.
