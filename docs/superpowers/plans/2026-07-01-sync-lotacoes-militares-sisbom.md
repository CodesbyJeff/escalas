# Sync de Lotações + Militares do SISBOM — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Puxar as 86 lotações e os 4.776 militares do SISBOM para a réplica local do Escalas, com militares vinculados às lotações, via o sync PULL existente.

**Architecture:** Chave surrogate `Int` na `Lotacao` + `sisbom_ref` string como chave natural de sync. Novo `lotacao.service`; `user.service` passa a vincular `_lotacao`→`UserLotacao`; `sync.service` sincroniza `['lotacoes','militar']` nessa ordem. Reset dev + re-bulk.

**Tech Stack:** Node 20 + TypeScript (ESM), Express, Prisma + PostgreSQL 16, Vitest (integração com Postgres de teste), axios (client SISBOM já pronto).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-01-sync-lotacoes-militares-sisbom-design.md` (fonte da verdade).
- **Sem shadow DB:** migrations são **SQL escrito à mão** numa pasta nova sob `prisma/migrations/`, aplicadas com `npx prisma migrate deploy` (nunca `migrate dev`). Aplicar em **dev E test** (o test usa `DATABASE_URL_TEST`). Depois `npx prisma generate`.
- **Identidade SISBOM:** lotação = `ref` string único; `_pai` = ref do pai; militar `_lotacao` = ref; `nivel` vem string; `str_sigla` NÃO é única.
- **ESM:** imports com sufixo `.js`. Indentação 2 espaços. Response/log já padronizados no projeto.
- **Ordem FK de deleção** (do `tests/helpers/db.ts`): auditLog → validacaoEscala → escalaVersao → execucaoVaga → escala → templateLotacao → userRole → userLotacao → user → lotacao → syncCursor → feriado.
- **Comportamento de sync mantido:** item ruim → `warn` + skip, cursor avança mesmo em erro; nunca travar.
- Rodar `npm run typecheck` e `npm run lint` (no `apps/backend`) ao fim de cada task com código; `npm test` para as tasks com testes.

---

### Task 1: Migration 0009 — schema `Lotacao`/`User`

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (models `Lotacao`, `User`)
- Create: `apps/backend/prisma/migrations/20260701120435_0009_lotacoes_sync/migration.sql`

**Interfaces:**
- Produces: colunas `Lotacao.sisbom_id`, `Lotacao.sisbom_ref`, `Lotacao.sigla_extenso`, `Lotacao.last_sync_at`, `Lotacao.id` autoincrement, `sigla` sem unique; `User.sisbom_lotacao_ref`. O client Prisma regenerado expõe esses campos.

- [ ] **Step 1: Editar `schema.prisma` — model `Lotacao`**

Substituir o model `Lotacao` por:

```prisma
model Lotacao {
  id             Int               @id @default(autoincrement())
  sisbom_id      String?           @unique
  sisbom_ref     String?           @unique
  sigla          String
  sigla_extenso  String?
  nome           String
  lotacao_pai_id Int?
  nivel          Int
  operacional    Boolean           @default(false)
  externo        Boolean           @default(false)
  last_sync_at   DateTime?
  pai            Lotacao?          @relation("LotacaoHierarquia", fields: [lotacao_pai_id], references: [id])
  filhas         Lotacao[]         @relation("LotacaoHierarquia")
  user_lotacoes  UserLotacao[]
  user_roles     UserRole[]
  templates      TemplateLotacao[]
  escalas        Escala[]
}
```

- [ ] **Step 2: Editar `schema.prisma` — model `User`**

Adicionar, logo após `sisbom_id`:

```prisma
  sisbom_lotacao_ref String?
```

- [ ] **Step 3: Escrever a migration SQL**

Criar `apps/backend/prisma/migrations/20260701120435_0009_lotacoes_sync/migration.sql`:

```sql
-- Lotacao: dropar unique de sigla (colide no SISBOM)
DROP INDEX "Lotacao_sigla_key";

-- Lotacao: novas colunas de sync
ALTER TABLE "Lotacao" ADD COLUMN "sisbom_id" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "sisbom_ref" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "sigla_extenso" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "last_sync_at" TIMESTAMP(3);

-- Lotacao.id: passa a autoincrement (sequence)
CREATE SEQUENCE "Lotacao_id_seq";
ALTER TABLE "Lotacao" ALTER COLUMN "id" SET DEFAULT nextval('"Lotacao_id_seq"');
ALTER SEQUENCE "Lotacao_id_seq" OWNED BY "Lotacao"."id";
SELECT setval('"Lotacao_id_seq"', coalesce((SELECT max("id") FROM "Lotacao"), 0) + 1, false);

-- Índices unique dos novos campos naturais
CREATE UNIQUE INDEX "Lotacao_sisbom_id_key" ON "Lotacao"("sisbom_id");
CREATE UNIQUE INDEX "Lotacao_sisbom_ref_key" ON "Lotacao"("sisbom_ref");

-- User: ref cru da última lotação SISBOM (reconciliação de troca)
ALTER TABLE "User" ADD COLUMN "sisbom_lotacao_ref" TEXT;
```

- [ ] **Step 4: Aplicar em dev e test + gerar client**

Rodar em `apps/backend`:

```bash
npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
npx prisma generate
```

Esperado: "1 migration applied" (0009) em cada DB; generate OK.

- [ ] **Step 5: Verificar schema e tipos**

```bash
npx prisma validate
npm run typecheck
```

Esperado: schema válido; typecheck **pode** falhar em `lotacao.service`/`user.service` ainda não escritos — se falhar **apenas** por campos novos ainda não usados, ok; se falhar por outra coisa, corrigir. Confirmar que `Prisma.LotacaoCreateInput` agora aceita `sisbom_ref`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/20260701120435_0009_lotacoes_sync
git commit -m "🗃️ migration(0009): Lotacao sisbom_ref/sisbom_id + User.sisbom_lotacao_ref"
```

---

### Task 2: `lotacao.service.ts` — mapear lotação SISBOM→local

**Files:**
- Create: `apps/backend/src/services/lotacao.service.ts`
- Test: `apps/backend/src/tests/integration/lotacao.service.test.ts`

**Interfaces:**
- Consumes: `SyncEvent` de `../integrations/sisbom/types.js`; `PrismaClient`; `logger` de `../utils/logger.js`.
- Produces:
  - `lotacaoService.upsertFromSisbom(data: Record<string, unknown>, ts: Date, prisma: PrismaClient): Promise<void>`
  - `lotacaoService.applyEvent(event: SyncEvent, prisma: PrismaClient): Promise<void>`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `apps/backend/src/tests/integration/lotacao.service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { lotacaoService } from '../../services/lotacao.service.js';

const ts = new Date('2026-07-01T00:00:00.000Z');

describe('lotacaoService.upsertFromSisbom', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('cria lotação raiz por sisbom_ref, parseando nivel string', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_sigla_extenso: 'DLOF', str_nome: 'Diretoria de Log', _pai: '', nivel: '1', operacional: false, externo: false },
      ts,
      testPrisma,
    );
    const l = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    expect(l).toBeTruthy();
    expect(l?.nivel).toBe(1);
    expect(l?.lotacao_pai_id).toBeNull();
    expect(l?.sisbom_id).toBe('uuid-dlof');
  });

  it('resolve _pai (ref) para lotacao_pai_id quando o pai já existe', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_nome: 'DLOF', _pai: '', nivel: '1' },
      ts,
      testPrisma,
    );
    const pai = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Centro de TI', _pai: 'DLOF', nivel: '2' },
      ts,
      testPrisma,
    );
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBe(pai?.id);
  });

  it('deixa lotacao_pai_id null quando o pai ainda não existe', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Centro de TI', _pai: 'DLOF', nivel: '2' },
      ts,
      testPrisma,
    );
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBeNull();
  });

  it('atualiza (upsert) a lotação existente pelo mesmo sisbom_ref', async () => {
    const base = { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Nome Antigo', _pai: '', nivel: '2' };
    await lotacaoService.upsertFromSisbom(base, ts, testPrisma);
    await lotacaoService.upsertFromSisbom({ ...base, str_nome: 'Nome Novo' }, ts, testPrisma);
    const all = await testPrisma.lotacao.findMany({ where: { sisbom_ref: 'CTIC' } });
    expect(all).toHaveLength(1);
    expect(all[0].nome).toBe('Nome Novo');
  });
});
```

- [ ] **Step 2: Rodar — verificar que falha**

```bash
npm test -- lotacao.service
```
Esperado: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lotacao.service.ts`**

```ts
import type { PrismaClient } from '@prisma/client';
import type { SyncEvent } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

function parseNivel(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) {
    logger.warn('lotacao_nivel_invalido', { nivel: v });
    return 0;
  }
  return Math.trunc(n);
}

export const lotacaoService = {
  async applyEvent(event: SyncEvent, prisma: PrismaClient): Promise<void> {
    if (event.entity !== 'lotacoes') return;
    // Delete de lotação está fora de escopo (raro; perigoso com FKs) — só aplica upserts.
    if (event.op === 'delete' || event.op === 'remove') {
      logger.warn('lotacao_delete_ignorado', { sisbom_id: event.entity_id });
      return;
    }
    await lotacaoService.upsertFromSisbom(event.data ?? {}, new Date(event.at), prisma);
  },

  async upsertFromSisbom(
    data: Record<string, unknown>,
    ts: Date,
    prisma: PrismaClient,
  ): Promise<void> {
    const sisbom_ref = data.ref ? String(data.ref) : '';
    if (!sisbom_ref) {
      logger.warn('lotacao_sync_skipped_no_ref', { sisbom_id: data._id });
      return;
    }

    const paiRef = data._pai ? String(data._pai) : '';
    let lotacao_pai_id: number | null = null;
    if (paiRef) {
      const pai = await prisma.lotacao.findUnique({ where: { sisbom_ref: paiRef } });
      lotacao_pai_id = pai?.id ?? null;
    }

    const payload = {
      sisbom_id: data._id ? String(data._id) : null,
      sisbom_ref,
      sigla: String(data.str_sigla ?? sisbom_ref),
      sigla_extenso: data.str_sigla_extenso ? String(data.str_sigla_extenso) : null,
      nome: String(data.str_nome ?? ''),
      lotacao_pai_id,
      nivel: parseNivel(data.nivel),
      operacional: Boolean(data.operacional),
      externo: Boolean(data.externo),
      last_sync_at: ts,
    };

    await prisma.lotacao.upsert({
      where: { sisbom_ref },
      update: payload,
      create: payload,
    });
  },
};
```

- [ ] **Step 4: Rodar — verificar que passa**

```bash
npm test -- lotacao.service
```
Esperado: PASS (4 testes).

- [ ] **Step 5: typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add apps/backend/src/services/lotacao.service.ts apps/backend/src/tests/integration/lotacao.service.test.ts
git commit -m "✨ feat(sync): lotacao.service — mapeia lotação SISBOM→local (resolve _pai)"
```

---

### Task 3: `user.service.ts` — vincular militar→lotação

**Files:**
- Modify: `apps/backend/src/services/user.service.ts`
- Test: `apps/backend/src/tests/integration/user.service.test.ts` (criar se não existir; senão adicionar `describe`)

**Interfaces:**
- Consumes: `Lotacao` local por `sisbom_ref` (Task 2 popula, mas a resolução aqui é por query direta).
- Produces: `userService.upsertFromSisbom` agora grava `sisbom_lotacao_ref` e mantém `UserLotacao` do militar. `applyEvent` inalterado na assinatura.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar/estender `apps/backend/src/tests/integration/user.service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { userService } from '../../services/user.service.js';

const ts = new Date('2026-07-01T00:00:00.000Z');

async function seedLotacao(ref: string, nivel = 2) {
  return testPrisma.lotacao.create({
    data: { sisbom_ref: ref, sisbom_id: `id-${ref}`, sigla: ref, nome: ref, nivel },
  });
}

describe('userService.upsertFromSisbom — vínculo de lotação', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('vincula militar à lotação resolvida por ref, com nivel = lotacao.nivel', async () => {
    const lot = await seedLotacao('CTIC', 2);
    await userService.upsertFromSisbom(
      { _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'Fulano' }, _lotacao: 'CTIC', ativo: true },
      ts,
      testPrisma,
    );
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.sisbom_lotacao_ref).toBe('CTIC');
    expect(user?.lotacoes).toHaveLength(1);
    expect(user?.lotacoes[0].lotacao_id).toBe(lot.id);
    expect(user?.lotacoes[0].nivel).toBe(2);
  });

  it('troca de lotação remove o vínculo SISBOM antigo e cria o novo', async () => {
    const a = await seedLotacao('CTIC');
    const b = await seedLotacao('CFAP');
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CFAP' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.lotacoes.map((l) => l.lotacao_id)).toEqual([b.id]);
    expect(user?.lotacoes.some((l) => l.lotacao_id === a.id)).toBe(false);
  });

  it('ref inexistente localmente: militar sem vínculo, sem erro', async () => {
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'ZZZ' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.sisbom_lotacao_ref).toBe('ZZZ');
    expect(user?.lotacoes).toHaveLength(0);
  });

  it('preserva vínculo manual (de outra lotação) ao sincronizar', async () => {
    const manual = await seedLotacao('MANUAL');
    const ctic = await seedLotacao('CTIC');
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' } });
    await testPrisma.userLotacao.create({ data: { user_id: user!.id, lotacao_id: manual.id, nivel: 2 } });
    // re-sync mantendo a mesma lotação SISBOM
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const after = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    const ids = after!.lotacoes.map((l) => l.lotacao_id).sort();
    expect(ids).toEqual([manual.id, ctic.id].sort());
  });

  it('militar sem cpf é pulado (comportamento mantido)', async () => {
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' } });
    expect(user).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — verificar que falha**

```bash
npm test -- user.service
```
Esperado: FAIL.

- [ ] **Step 3: Implementar as mudanças em `user.service.ts`**

Adicionar helper e ajustar `upsertFromSisbom`. Manter tudo o que já existe; alterar o `payload` para incluir `sisbom_lotacao_ref` e, após o upsert, chamar `linkLotacao`.

```ts
  // Reconciliação do vínculo de lotação derivado do SISBOM.
  async linkLotacao(
    userId: number,
    refAntigo: string | null,
    refNovo: string,
    prisma: PrismaClient,
  ): Promise<void> {
    // remove o vínculo do ref antigo (se mudou) — sem tocar vínculos manuais
    if (refAntigo && refAntigo !== refNovo) {
      const antiga = await prisma.lotacao.findUnique({ where: { sisbom_ref: refAntigo } });
      if (antiga) {
        await prisma.userLotacao.deleteMany({ where: { user_id: userId, lotacao_id: antiga.id } });
      }
    }
    if (!refNovo) return;
    const nova = await prisma.lotacao.findUnique({ where: { sisbom_ref: refNovo } });
    if (!nova) {
      logger.warn('user_sync_lotacao_nao_encontrada', { userId, ref: refNovo });
      return;
    }
    await prisma.userLotacao.upsert({
      where: { user_id_lotacao_id: { user_id: userId, lotacao_id: nova.id } },
      update: { nivel: nova.nivel },
      create: { user_id: userId, lotacao_id: nova.id, nivel: nova.nivel },
    });
  },
```

No `upsertFromSisbom`, após montar `payload` acrescentar `sisbom_lotacao_ref` e capturar o ref:

```ts
    const lotacaoRef = data._lotacao ? String(data._lotacao) : '';
    const payload = {
      // ...campos atuais...
      sisbom_lotacao_ref: lotacaoRef || null,
      last_sync_at: ts,
    };

    const anterior = await prisma.user.findUnique({ where: { sisbom_id }, select: { id: true, sisbom_lotacao_ref: true } });
    const user = await prisma.user.upsert({ where: { sisbom_id }, update: payload, create: payload });
    await userService.linkLotacao(user.id, anterior?.sisbom_lotacao_ref ?? null, lotacaoRef, prisma);
```

(O nome do argumento composto do `where` do `userLotacao.upsert` é `user_id_lotacao_id` — confirmar no client gerado; é o `@@id([user_id, lotacao_id])`.)

- [ ] **Step 4: Rodar — verificar que passa**

```bash
npm test -- user.service
```
Esperado: PASS (5 testes) e os testes que já existiam de user continuam verdes.

- [ ] **Step 5: typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add apps/backend/src/services/user.service.ts apps/backend/src/tests/integration/user.service.test.ts
git commit -m "✨ feat(sync): vincula militar→lotação (UserLotacao) por _lotacao ref"
```

---

### Task 4: `sync.service.ts` — TRACKED order + dispatch + bulk ordenado

**Files:**
- Modify: `apps/backend/src/services/sync.service.ts`
- Test: `apps/backend/src/tests/integration/sync.service.test.ts` (criar)

**Interfaces:**
- Consumes: `lotacaoService` (Task 2), `userService` (Task 3), `sisbomClient` (mockado nos testes).
- Produces: `syncService.runOnce` e `syncService.bulkSnapshot` passam a cobrir `lotacoes` + `militar`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `apps/backend/src/tests/integration/sync.service.test.ts`, mockando `sisbomClient`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';

vi.mock('../../integrations/sisbom/client.js', () => ({
  sisbomClient: {
    getMirrorRef: vi.fn(),
    getEvents: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

import { sisbomClient } from '../../integrations/sisbom/client.js';
import { syncService } from '../../services/sync.service.js';

const mocked = sisbomClient as unknown as {
  getMirrorRef: ReturnType<typeof vi.fn>;
  getEvents: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
};

describe('syncService.bulkSnapshot — lotações antes de militares', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('aplica lotações (ordenadas por nivel) e vincula militares', async () => {
    mocked.getSnapshot.mockImplementation(async ({ entity }: { entity: string }) => {
      if (entity === 'lotacoes') {
        return {
          entity,
          items: [
            { _id: 'id-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'CTIC', _pai: 'DLOF', nivel: '2' },
            { _id: 'id-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_nome: 'DLOF', _pai: '', nivel: '1' },
          ],
          skip: 0, limit: 500, has_more: false,
        };
      }
      return {
        entity, items: [{ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }],
        skip: 0, limit: 500, has_more: false,
      };
    });
    mocked.getMirrorRef.mockResolvedValue({ ref: { lotacoes: null, militar: null }, server_time: '2026-07-01T00:00:00.000Z' });

    await syncService.bulkSnapshot(testPrisma);

    const dlof = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBe(dlof?.id); // pai resolvido apesar de vir antes no array
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.lotacoes[0]?.lotacao_id).toBe(ctic?.id);
  });
});
```

- [ ] **Step 2: Rodar — verificar que falha**

```bash
npm test -- sync.service
```
Esperado: FAIL (só militar hoje; lotacao não é aplicada).

- [ ] **Step 3: Implementar as mudanças em `sync.service.ts`**

- Trocar `const TRACKED = ['militar'] as const;` por `const TRACKED = ['lotacoes', 'militar'] as const;`
- Importar `lotacaoService`.
- No `runOnce`, dentro do loop de eventos, trocar o dispatch por:

```ts
            await prisma.$transaction(async (tx) => {
              if (ev.entity === 'lotacoes') await lotacaoService.applyEvent(ev, tx as PrismaClient);
              else if (ev.entity === 'militar') await userService.applyEvent(ev, tx as PrismaClient);
            });
```

- No `bulkSnapshot`, para `lotacoes` acumular todas as páginas e **ordenar por `nivel`** antes de aplicar; para `militar` manter o fluxo por página. Estrutura:

```ts
    for (const entidade of TRACKED) {
      if (entidade === 'lotacoes') {
        const todas: Record<string, unknown>[] = [];
        let skip = 0, iter = 0;
        while (true) {
          if (++iter > MAX_SYNC_ITER) { logger.error('bulk_max_iter_exceeded', { entidade, skip }); break; }
          const resp = await sisbomClient.getSnapshot({ entity: entidade, skip, limit: SNAPSHOT_PAGE });
          todas.push(...resp.items);
          if (!resp.has_more) break;
          skip += SNAPSHOT_PAGE;
        }
        todas.sort((a, b) => Number(a.nivel) - Number(b.nivel));
        let total = 0;
        for (const item of todas) {
          try { await lotacaoService.upsertFromSisbom(item, new Date(), prisma); total++; }
          catch (e) { logger.error('bulk_item_failed_skipping', { entidade, sisbom_id: item._id, err: (e as Error).message }); }
        }
        logger.info('bulk_snapshot_done', { entidade, total });
      } else {
        // militar — fluxo por página (como hoje)
        let skip = 0, total = 0, iter = 0;
        while (true) {
          if (++iter > MAX_SYNC_ITER) { logger.error('bulk_max_iter_exceeded', { entidade, skip }); break; }
          const resp = await sisbomClient.getSnapshot({ entity: entidade, skip, limit: SNAPSHOT_PAGE });
          for (const item of resp.items) {
            try { await userService.upsertFromSisbom(item, new Date(), prisma); total++; }
            catch (e) { logger.error('bulk_item_failed_skipping', { entidade, sisbom_id: item._id, err: (e as Error).message }); }
          }
          if (!resp.has_more) break;
          skip += SNAPSHOT_PAGE;
        }
        logger.info('bulk_snapshot_done', { entidade, total });
      }
    }
```

(O bloco de alinhamento de cursor pós-bulk permanece; agora itera sobre os 2 TRACKED.)

- [ ] **Step 4: Rodar — verificar que passa**

```bash
npm test -- sync.service
```
Esperado: PASS.

- [ ] **Step 5: Suite completa + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
git add apps/backend/src/services/sync.service.ts apps/backend/src/tests/integration/sync.service.test.ts
git commit -m "✨ feat(sync): sincroniza lotacoes+militar (ordem, dispatch, bulk por nivel)"
```

---

### Task 5: Reset CLI + seeder fallback + script npm

**Files:**
- Create: `apps/backend/src/cli/resetSisbomData.ts`
- Modify: `apps/backend/package.json` (script `reset-sisbom`)
- Modify: `apps/backend/src/seeders/lotacoes.seeder.ts` (comentário de fallback)
- Test: `apps/backend/src/tests/integration/resetSisbomData.test.ts`

**Interfaces:**
- Consumes: `syncService.bulkSnapshot`, `prisma`.
- Produces: função `resetSisbomData(prisma, opts)` testável + entrypoint CLI.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `apps/backend/src/tests/integration/resetSisbomData.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { resetSisbomData } from '../../cli/resetSisbomData.js';

describe('resetSisbomData', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('bloqueia em produção sem a flag', async () => {
    await expect(resetSisbomData(testPrisma, { nodeEnv: 'production', confirm: false })).rejects.toThrow(/produç|confirm/i);
  });

  it('limpa lotações fabricadas e chama o bulk', async () => {
    await testPrisma.lotacao.create({ data: { id: 999, sigla: 'FAKE', nome: 'Fabricada', nivel: 1 } });
    const bulk = vi.fn().mockResolvedValue(undefined);
    await resetSisbomData(testPrisma, { nodeEnv: 'development', confirm: true, bulk });
    expect(await testPrisma.lotacao.count()).toBe(0);
    expect(bulk).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar — verificar que falha**

```bash
npm test -- resetSisbomData
```
Esperado: FAIL.

- [ ] **Step 3: Implementar `resetSisbomData.ts`**

```ts
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { syncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

interface ResetOpts {
  nodeEnv: string;
  confirm: boolean;
  bulk?: (p: PrismaClient) => Promise<void>;
}

// Limpa os dados fabricados de lotação/escala e repopula do SISBOM.
export async function resetSisbomData(prismaClient: PrismaClient, opts: ResetOpts): Promise<void> {
  if (opts.nodeEnv === 'production' || !opts.confirm) {
    throw new Error('reset-sisbom: recusado (produção ou sem confirmação explícita).');
  }
  // Ordem FK-safe (mesma do tests/helpers/db.ts), preservando super-admins? Não:
  // é reset de dados sincronizados/derivados de teste. Ver spec.
  await prismaClient.auditLog.deleteMany();
  await prismaClient.validacaoEscala.deleteMany();
  await prismaClient.escalaVersao.deleteMany();
  await prismaClient.execucaoVaga.deleteMany();
  await prismaClient.escala.deleteMany();
  await prismaClient.templateLotacao.deleteMany();
  await prismaClient.userRole.deleteMany();
  await prismaClient.userLotacao.deleteMany();
  await prismaClient.lotacao.deleteMany();
  await prismaClient.syncCursor.deleteMany();

  const bulk = opts.bulk ?? syncService.bulkSnapshot;
  await bulk(prismaClient);
  logger.info('reset_sisbom_done');
}

// Entrypoint CLI (não roda quando importado nos testes).
const isMain = process.argv[1] && process.argv[1].endsWith('resetSisbomData.ts');
if (isMain) {
  resetSisbomData(prisma, { nodeEnv: env.NODE_ENV, confirm: process.argv.includes('--yes') })
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error('reset_sisbom_failed', { err: (e as Error).message });
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

**Nota:** ao rodar via `tsx`, `process.argv[1]` termina em `resetSisbomData.ts`. Se o build compilar para `.js`, ajustar o guard para aceitar `.js` também (`/resetSisbomData\.(ts|js)$/`).

- [ ] **Step 4: Comentar o seeder como fallback**

No topo de `apps/backend/src/seeders/lotacoes.seeder.ts`, adicionar comentário:

```ts
// FALLBACK OFFLINE: a fonte real de lotações é o SISBOM (npm run bulk-sync / reset-sisbom).
// Este seeder existe só para dev sem acesso ao SISBOM e usa ids fabricados —
// NÃO rodar após um bulk do SISBOM (colide com os ids reais). Ver spec 2026-07-01.
```

- [ ] **Step 5: Adicionar script npm**

Em `apps/backend/package.json`, na seção `scripts`, adicionar:

```json
    "reset-sisbom": "tsx src/cli/resetSisbomData.ts",
```

- [ ] **Step 6: Rodar — verificar que passa + suite + typecheck + lint**

```bash
npm test -- resetSisbomData && npm run typecheck && npm run lint
```
Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/cli/resetSisbomData.ts apps/backend/src/tests/integration/resetSisbomData.test.ts apps/backend/package.json apps/backend/src/seeders/lotacoes.seeder.ts
git commit -m "✨ feat(sync): CLI reset-sisbom + seeder de lotações como fallback offline"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** migration (T1), lotacao.service (T2), user.service link (T3), sync order/dispatch/bulk (T4), reset+seeder+script (T5). Validação live = pós-plano (controlador). ✔
- **Sem placeholders:** todo passo tem SQL/código/comando concreto. ✔
- **Consistência de tipos:** `upsertFromSisbom(data, ts, prisma)` e `applyEvent(event, prisma)` idênticos entre lotacao/user; `linkLotacao(userId, refAntigo, refNovo, prisma)`; `where: { user_id_lotacao_id: {...} }` = nome gerado do `@@id([user_id, lotacao_id])`. ✔
- **Risco conhecido:** o nome composto do `where` do `userLotacao.upsert` (`user_id_lotacao_id`) deve ser confirmado no client gerado (T3 Step 3 alerta). Se o Prisma gerar outro nome, ajustar.

## Validação final (controlador, pós-T5)

Contra `sisbom-dev` (Mongo já rodando):
1. Subir `api_sisbom` local (`npm start` no sisbom-api) com `ESCALAS_API_KEY` setada.
2. No `.env` do Escalas: `SISBOM_EXTERNAL_BASE_URL` → `http://localhost:3030/external` (ou a rota local), `SISBOM_API_KEY` = mesma chave.
3. `cd apps/backend && npm run reset-sisbom -- --yes`.
4. Conferir: `lotacao.count()` = 86; 23 raízes (`lotacao_pai_id null`); `user.count()` ≈ 4776−37; `userLotacao.count()` ≈ 983; CTIC com `lotacao_pai_id` = id de DLOF.
