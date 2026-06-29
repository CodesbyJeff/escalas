# Layouts múltiplos por lotação + Diária Operacional (DO) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Permitir múltiplos layouts nomeados por lotação (escolher qual aplicar ao criar a escala) e sinalizar Diária Operacional como vaga aberta (VAGO = DO).

**Architecture:** Evolui o `TemplateLotacao` (1→N por lotação, ganha `nome`) com CRUD completo; `criar escala` passa a receber `template_id`; web ganha tela de Layouts (CRUD), seletor de layout na Nova Escala e rótulo "DO" para vaga aberta. Sem flag nova na `Vaga` (aberto já é DO).

**Tech Stack:** Node/Express/Prisma/Zod/Vitest (backend); React 18 + Vite + TanStack Router/Query + Mantine 7 + Vitest/RTL/MSW (web).

## Global Constraints
- Branch `main`; push só sob ordem; sem deploy. Padrão `{success,message,data}`; rotas `/api/v1` pt-BR.
- `@types/react` unificado em 18 no workspace (não reintroduzir 19). Não editar `routeTree.gen.ts` à mão. MSW `onUnhandledRequest: 'error'`. Tema `cbmrn`.
- **DO = vaga aberta (`militar_id null`)**. NÃO adicionar flag de DO em `Vaga` nem `do_padrao` no layout.
- Layout = estrutura reutilizável (slots função/quantidade/turno), sem militares específicos.
- Migration sem shadow DB: gerar via `prisma migrate diff --from-url ... --to-schema-datamodel ... --script` e aplicar com `prisma migrate deploy` (padrão da trilha Feriado).
- Spec: `docs/superpowers/specs/2026-06-29-layouts-e-diaria-operacional-design.md`.

## Tipos/contratos a produzir
- `TemplateLotacaoDTO` ganha `nome: string` (shared-types/template.ts).
- `LayoutResumoDTO` { id, nome, lotacao_id, qtd_guarnicoes } (lista).
- `criarLayoutSchema`/`atualizarLayoutSchema` = `{ nome, guarnicoes: [...] }` (shared-schemas).
- `criarEscalaSchema` ganha `template_id: number`.
- Service `layoutService`: `listarPorLotacao(lotacao_id, prisma)`, `obter(id, prisma)`, `criar(lotacao_id, user_id, input, prisma)`, `atualizar(id, user_id, input, prisma)`, `excluir(id, prisma)`.

## Estrutura de arquivos
```
apps/backend/prisma/schema.prisma                         (T1: TemplateLotacao.nome, Escala.template_id)
apps/backend/prisma/migrations/XXXX_layouts_do/           (T1)
packages/shared-types/src/template.ts                     (T1: +nome, +LayoutResumoDTO)
packages/shared-schemas/src/template.schemas.ts           (T2: criar/atualizar com nome)
packages/shared-schemas/src/escala.schemas.ts             (T5: +template_id)
apps/backend/src/services/template.service.ts             (T2: vira layoutService CRUD)
apps/backend/src/services/escala.service.ts               (T4: criar usa template_id)
apps/backend/src/middlewares/requireTemplateAccess.ts     (T3)
apps/backend/src/controllers/template.controller.ts       (T3)
apps/backend/src/routes/template.routes.ts                (T3)
apps/web/src/lib/api/layouts.ts                           (T5)
apps/web/src/lib/api/escalas.ts                           (T5: criar +template_id)
apps/web/src/features/layouts/useLayoutDraft.ts           (T6) + LayoutEditor.tsx + .test
apps/web/src/routes/_app/layouts/index.tsx                (T6) + .test
apps/web/src/components/AppShell.tsx                       (T6: item Layouts)
apps/web/src/features/escalas/NovaEscalaForm.tsx          (T7: seletor de layout) + .test
apps/web/src/components/VagaRow.tsx                        (T8: VAGO→DO) + GuarnicaoCard.test.tsx
```
Verificação backend (de `apps/backend`): `pnpm test`, `pnpm typecheck`, `pnpm lint`. Web (de `apps/web`): idem.

---

### Task 1: Migration (layouts N por lotação + Escala.template_id) + DTOs

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<ts>_layouts_do/migration.sql`
- Modify: `packages/shared-types/src/template.ts`

**Interfaces:**
- Produces: `TemplateLotacao.nome`, `@@unique([lotacao_id, nome])`; `Escala.template_id Int?` (FK SET NULL); `TemplateLotacaoDTO.nome`; `LayoutResumoDTO`.

- [ ] **Step 1: Editar o schema.prisma**

Em `model TemplateLotacao`: trocar `lotacao_id Int @unique` por `lotacao_id Int`, adicionar `nome String`, e ao fim do model `@@unique([lotacao_id, nome])`. Em `model Escala`: adicionar campo e relação:
```prisma
// dentro de model Escala (campos)
  template_id   Int?
// dentro de model Escala (relações)
  template      TemplateLotacao? @relation(fields: [template_id], references: [id], onDelete: SetNull)
```
Em `model TemplateLotacao` adicionar a relação inversa: `escalas Escala[]`.

- [ ] **Step 2: Gerar e aplicar a migration (sem shadow DB)**

Run (de `apps/backend`):
```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_layouts_do
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/*_layouts_do/migration.sql
```
Revisar o SQL gerado (deve: `ALTER TABLE "TemplateLotacao" ADD COLUMN "nome" TEXT`; backfill; criar unique composto; dropar unique antigo; `ALTER TABLE "Escala" ADD COLUMN "template_id"` + FK). **Inserir manualmente** o backfill antes do unique novo:
```sql
UPDATE "TemplateLotacao" SET "nome" = 'Padrão' WHERE "nome" IS NULL;
```
Aplicar em dev e test:
```bash
npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
npx prisma generate
```
Expected: migration aplicada; `prisma generate` ok.

- [ ] **Step 3: Atualizar DTOs**

Em `packages/shared-types/src/template.ts` — adicionar `nome` ao `TemplateLotacaoDTO` e criar resumo:
```ts
export interface TemplateLotacaoDTO {
  id: number;
  lotacao_id: number;
  nome: string;
  criado_por_id: number;
  updated_at: string;
  guarnicoes: TemplateGuarnicaoDTO[];
}
export interface LayoutResumoDTO {
  id: number;
  lotacao_id: number;
  nome: string;
  qtd_guarnicoes: number;
}
```

- [ ] **Step 4: Verificar typecheck + commit**

Run: `pnpm typecheck` → PASS.
```bash
git add apps/backend/prisma packages/shared-types/src/template.ts
git commit -m "✨ feat(db): layouts N por lotação (nome) + Escala.template_id"
```

---

### Task 2: `layoutService` (CRUD) + testes

**Files:**
- Modify: `apps/backend/src/services/template.service.ts`
- Modify: `packages/shared-schemas/src/template.schemas.ts`
- Test: `apps/backend/src/tests/integration/layout.service.test.ts`

**Interfaces:**
- Consumes: schemas, Prisma.
- Produces: `layoutService.{listarPorLotacao,obter,criar,atualizar,excluir}`; `criarLayoutSchema`/`atualizarLayoutSchema` + `CriarLayoutInput`.

- [ ] **Step 1: Schemas (adicionar nome)**

Em `packages/shared-schemas/src/template.schemas.ts`, adicionar (mantendo `guarnicaoTemplateInputSchema`):
```ts
export const criarLayoutSchema = z.object({
  nome: z.string().trim().min(1, 'Nome obrigatório').max(60),
  guarnicoes: z.array(guarnicaoTemplateInputSchema).min(1, 'Pelo menos uma guarnição'),
});
export const atualizarLayoutSchema = criarLayoutSchema;
export type CriarLayoutInput = z.infer<typeof criarLayoutSchema>;
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/layout.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';
import { ConflictError } from '../../utils/errors.js';

beforeEach(resetDb);

async function lotacaoEUser() {
  const lot = await testPrisma.lotacao.create({ data: { id: 900, sigla: 'L900', nome: 'L', nivel: 3, operacional: true } });
  const u = await testPrisma.user.create({ data: { cpf: '90000000001', nome: 'Esc', last_sync_at: new Date() } });
  return { lot, u };
}
const layoutInput = (nome: string) => ({ nome, guarnicoes: [
  { sigla: 'ABT', atividade: 'Incêndio', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
    vagas_sugeridas: [{ funcao: 'Comandante', quantidade_sugerida: 1 }, { funcao: 'Motorista', quantidade_sugerida: 2 }] },
] });

describe('layoutService', () => {
  it('cria e lista múltiplos layouts na mesma lotação', async () => {
    const { lot, u } = await lotacaoEUser();
    await layoutService.criar(lot.id, u.id, layoutInput('Dia Útil'), testPrisma);
    await layoutService.criar(lot.id, u.id, layoutInput('Fim de Semana'), testPrisma);
    const lista = await layoutService.listarPorLotacao(lot.id, testPrisma);
    expect(lista.map((l) => l.nome).sort()).toEqual(['Dia Útil', 'Fim de Semana']);
    expect(lista[0]!.qtd_guarnicoes).toBe(1);
  });

  it('nome duplicado na mesma lotação → ConflictError', async () => {
    const { lot, u } = await lotacaoEUser();
    await layoutService.criar(lot.id, u.id, layoutInput('Padrão'), testPrisma);
    await expect(layoutService.criar(lot.id, u.id, layoutInput('Padrão'), testPrisma)).rejects.toBeInstanceOf(ConflictError);
  });

  it('atualizar substitui guarnições; excluir remove', async () => {
    const { lot, u } = await lotacaoEUser();
    const l = await layoutService.criar(lot.id, u.id, layoutInput('X'), testPrisma);
    const upd = await layoutService.atualizar(l.id, u.id, { nome: 'X', guarnicoes: [
      { sigla: 'UR', atividade: 'APH', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: [{ funcao: 'Socorrista', quantidade_sugerida: 1 }] },
    ] }, testPrisma);
    expect(upd.guarnicoes).toHaveLength(1);
    expect(upd.guarnicoes[0]!.sigla).toBe('UR');
    await layoutService.excluir(l.id, testPrisma);
    expect(await layoutService.obter(l.id, testPrisma)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test layout.service` → FAIL.

- [ ] **Step 4: Implementar (reescrever `template.service.ts`)**

```ts
import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarLayoutInput } from '@escalas/shared-schemas';
import { NotFoundError, ConflictError } from '../utils/errors.js';

const includeAninhado = {
  guarnicoes: { orderBy: { ordem: 'asc' as const }, include: { vagas_sugeridas: { orderBy: { id: 'asc' as const } } } },
};
function mapGuarnicaoCreate(g: CriarLayoutInput['guarnicoes'][number]) {
  return {
    sigla: g.sigla, atividade: g.atividade,
    turno_padrao_inicio: g.turno_padrao_inicio, turno_padrao_fim: g.turno_padrao_fim,
    ordem: g.ordem, vagas_sugeridas: { create: g.vagas_sugeridas },
  };
}

export const layoutService = {
  async listarPorLotacao(lotacao_id: number, prisma: PrismaClient) {
    const layouts = await prisma.templateLotacao.findMany({
      where: { lotacao_id }, orderBy: { nome: 'asc' },
      include: { _count: { select: { guarnicoes: true } } },
    });
    return layouts.map((l) => ({ id: l.id, lotacao_id: l.lotacao_id, nome: l.nome, qtd_guarnicoes: l._count.guarnicoes }));
  },
  async obter(id: number, prisma: PrismaClient) {
    return prisma.templateLotacao.findUnique({ where: { id }, include: includeAninhado });
  },
  async criar(lotacao_id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const lot = await prisma.lotacao.findUnique({ where: { id: lotacao_id } });
    if (!lot) throw new NotFoundError('Lotação não encontrada.');
    try {
      return await prisma.templateLotacao.create({
        data: { lotacao_id, nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
        include: includeAninhado,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe um layout com esse nome nesta lotação.');
      throw e;
    }
  },
  async atualizar(id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const existente = await prisma.templateLotacao.findUnique({ where: { id } });
    if (!existente) throw new NotFoundError('Layout não encontrado.');
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.templateGuarnicao.deleteMany({ where: { template_lotacao_id: id } });
        await tx.templateLotacao.update({
          where: { id },
          data: { nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
        });
        return tx.templateLotacao.findUniqueOrThrow({ where: { id }, include: includeAninhado });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe um layout com esse nome nesta lotação.');
      throw e;
    }
  },
  async excluir(id: number, prisma: PrismaClient) {
    const existente = await prisma.templateLotacao.findUnique({ where: { id } });
    if (!existente) throw new NotFoundError('Layout não encontrado.');
    await prisma.templateLotacao.delete({ where: { id } });
  },
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test layout.service` → PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/template.service.ts packages/shared-schemas/src/template.schemas.ts apps/backend/src/tests/integration/layout.service.test.ts
git commit -m "✨ feat(backend): layoutService CRUD (múltiplos layouts por lotação)"
```

---

### Task 3: Middleware de acesso + controller + rotas de layouts + testes HTTP

**Files:**
- Create: `apps/backend/src/middlewares/requireTemplateAccess.ts`
- Modify: `apps/backend/src/controllers/template.controller.ts`
- Modify: `apps/backend/src/routes/template.routes.ts`
- Test: `apps/backend/src/tests/integration/layout.routes.test.ts`

**Interfaces:**
- Consumes: `layoutService` (T2), `requireRole`.
- Produces: rotas REST de layouts.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/layout.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 910, sigla: 'L910', nome: 'L', nivel: 3, operacional: true } });
  const esc = await testPrisma.user.create({ data: { cpf: '91000000001', nome: 'Esc', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
  const outro = await testPrisma.user.create({ data: { cpf: '91000000009', nome: 'Outro', last_sync_at: new Date() } });
  return { lot, tokenEsc: signAccess({ user_id: esc.id, cpf: esc.cpf }), tokenOutro: signAccess({ user_id: outro.id, cpf: outro.cpf }) };
}
const body = { nome: 'Dia Útil', guarnicoes: [{ sigla: 'ABT', atividade: 'Inc', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: [{ funcao: 'Cmt', quantidade_sugerida: 1 }] }] };

describe('Layouts REST', () => {
  it('escalante cria, lista e obtém layout', async () => {
    const { lot, tokenEsc } = await cenario();
    const c = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    expect(c.status).toBe(201);
    const id = c.body.data.id;
    const l = await request(buildApp()).get(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`);
    expect(l.body.data).toHaveLength(1);
    const g = await request(buildApp()).get(`/api/v1/templates/${id}`).set('authorization', `Bearer ${tokenEsc}`);
    expect(g.body.data.nome).toBe('Dia Útil');
  });
  it('403 para quem não é escalante da lotação (criar)', async () => {
    const { lot, tokenOutro } = await cenario();
    const r = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenOutro}`).send(body);
    expect(r.status).toBe(403);
  });
  it('nome duplicado → 409', async () => {
    const { lot, tokenEsc } = await cenario();
    await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    const dup = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    expect(dup.status).toBe(409);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test layout.routes` → FAIL.

- [ ] **Step 3: Middleware `requireTemplateAccess`**

```ts
// apps/backend/src/middlewares/requireTemplateAccess.ts
import type { RequestHandler } from 'express';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';
import type { Role } from '@escalas/shared-types';

// Carrega o layout por :id e valida o papel do usuário na lotação dele.
export function requireTemplateAccess(roles: Role[]): RequestHandler {
  return async (req, res, next) => {
    if (!req.user) return fail(res, 'Não autenticado.', 401);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 'id inválido.', 422);
    const layout = await prisma.templateLotacao.findUnique({ where: { id }, select: { id: true, lotacao_id: true } });
    if (!layout) return fail(res, 'Layout não encontrado.', 404);
    if (!req.user.is_super_admin) {
      const role = await prisma.userRole.findFirst({ where: { user_id: req.user.id, role: { in: roles }, lotacao_id: layout.lotacao_id } });
      if (!role) return fail(res, 'Sem permissão para esse layout.', 403);
    }
    next();
  };
}
```

- [ ] **Step 4: Controller (reescrever) + rotas**

`template.controller.ts`:
```ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { layoutService } from '../services/template.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

export const templateController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layouts listados.', await layoutService.listarPorLotacao(Number(req.params.lotacao_id), prisma)); }
    catch (e) { handle(res, next, e); }
  },
  async obter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const l = await layoutService.obter(Number(req.params.id), prisma);
      if (!l) { fail(res, 'Layout não encontrado.', 404); return; }
      ok(res, 'Layout obtido.', l);
    } catch (e) { handle(res, next, e); }
  },
  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layout criado.', await layoutService.criar(Number(req.params.lotacao_id), req.user!.id, req.body, prisma), 201); }
    catch (e) { handle(res, next, e); }
  },
  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layout atualizado.', await layoutService.atualizar(Number(req.params.id), req.user!.id, req.body, prisma)); }
    catch (e) { handle(res, next, e); }
  },
  async excluir(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { await layoutService.excluir(Number(req.params.id), prisma); ok(res, 'Layout excluído.', null); }
    catch (e) { handle(res, next, e); }
  },
};
```
`template.routes.ts`:
```ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { requireTemplateAccess } from '../middlewares/requireTemplateAccess.js';
import { validate } from '../middlewares/validate.js';
import { criarLayoutSchema, atualizarLayoutSchema } from '@escalas/shared-schemas';
import { templateController } from '../controllers/template.controller.js';

export const templateRoutes = Router();
templateRoutes.use(authMiddleware);

templateRoutes.get('/lotacao/:lotacao_id', requireRole(['ESCALANTE', 'GESTOR'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }), templateController.listar);
templateRoutes.post('/lotacao/:lotacao_id', requireRole(['ESCALANTE'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }), validate(criarLayoutSchema), templateController.criar);
templateRoutes.get('/:id', requireTemplateAccess(['ESCALANTE', 'GESTOR']), templateController.obter);
templateRoutes.put('/:id', requireTemplateAccess(['ESCALANTE']), validate(atualizarLayoutSchema), templateController.atualizar);
templateRoutes.delete('/:id', requireTemplateAccess(['ESCALANTE']), templateController.excluir);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test layout.routes` → PASS. Depois `pnpm test`, `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/middlewares/requireTemplateAccess.ts apps/backend/src/controllers/template.controller.ts apps/backend/src/routes/template.routes.ts apps/backend/src/tests/integration/layout.routes.test.ts
git commit -m "✨ feat(backend): CRUD REST de layouts + requireTemplateAccess"
```

---

### Task 4: Criar escala com `template_id`

**Files:**
- Modify: `packages/shared-schemas/src/escala.schemas.ts`
- Modify: `apps/backend/src/services/escala.service.ts`
- Test: `apps/backend/src/tests/integration/escala.service.test.ts` (acrescentar)

**Interfaces:**
- Consumes: layout (TemplateLotacao por id).
- Produces: `CriarEscalaInput.template_id`; `escala.template_id` gravado.

- [ ] **Step 1: Schema (adicionar template_id)**

Em `packages/shared-schemas/src/escala.schemas.ts`, no `criarEscalaSchema`, adicionar `template_id: z.number().int().positive()`.

- [ ] **Step 2: Escrever o teste que falha**

Acrescentar ao `escala.service.test.ts` (usa os helpers existentes; cria layout via prisma):
```ts
it('cria escala aplicando o layout escolhido e grava template_id', async () => {
  const lot = await testPrisma.lotacao.create({ data: { id: 950, sigla: 'L950', nome: 'L', nivel: 3, operacional: true } });
  const u = await testPrisma.user.create({ data: { cpf: '95000000001', nome: 'E', last_sync_at: new Date() } });
  const layout = await testPrisma.templateLotacao.create({ data: { lotacao_id: lot.id, nome: 'Padrão', criado_por_id: u.id,
    guarnicoes: { create: [{ sigla: 'ABT', atividade: 'Inc', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
      vagas_sugeridas: { create: [{ funcao: 'Cmt', quantidade_sugerida: 1 }] } }] } } });
  const esc = await escalaService.criar({ lotacao_id: lot.id, mes: 8, ano: 2026, template_id: layout.id }, u.id, testPrisma);
  expect(esc.template_id).toBe(layout.id);
  const dia = await testPrisma.escalaDia.findFirst({ where: { escala_id: esc.id }, include: { guarnicoes: { include: { vagas: true } } } });
  expect(dia!.guarnicoes[0]!.sigla).toBe('ABT');
  expect(dia!.guarnicoes[0]!.vagas).toHaveLength(1);
});
```
(Importar `escalaService` no topo do arquivo se ainda não estiver.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test escala.service` → FAIL (template_id desconhecido / não aplicado).

- [ ] **Step 4: Implementar — `escalaService.criar` usa template_id**

Em `escala.service.ts`, na função `criar`, substituir a busca do template:
```ts
const template = await prisma.templateLotacao.findUnique({
  where: { id: input.template_id },
  include: { guarnicoes: { include: { vagas_sugeridas: true } } },
});
if (!template || template.lotacao_id !== input.lotacao_id) {
  throw new ConflictError('Layout inválido para esta lotação.');
}
```
E no `tx.escala.create({ data: { ... } })`, adicionar `template_id: input.template_id` aos campos da escala. O resto (geração de dias/guarnições/vagas a partir de `template.guarnicoes`) permanece igual.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test escala.service` → PASS. Depois `pnpm test`, `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-schemas/src/escala.schemas.ts apps/backend/src/services/escala.service.ts apps/backend/src/tests/integration/escala.service.test.ts
git commit -m "✨ feat(backend): criar escala aplica layout escolhido (template_id)"
```

> Backend completo e verificável por curl: criar layout, listar, criar escala com `template_id`.

---

### Task 5: API web — `layoutsApi` + `escalasApi.criar(template_id)`

**Files:**
- Create: `apps/web/src/lib/api/layouts.ts`
- Modify: `apps/web/src/lib/api/escalas.ts`

**Interfaces:**
- Produces: `layoutsApi.{listar,obter,criar,atualizar,excluir}`; `escalasApi.criar` aceita `template_id` (via tipo `CriarEscalaInput`).

> Sem teste dedicado (mirrors escalas.ts); coberto via MSW em T6/T7.

- [ ] **Step 1: Criar `layouts.ts`**

```ts
// apps/web/src/lib/api/layouts.ts
import type { LayoutResumoDTO, TemplateLotacaoDTO } from '@escalas/shared-types';
import type { CriarLayoutInput } from '@escalas/shared-schemas';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const layoutsApi = {
  listar: (lotacaoId: number) => apiGet<LayoutResumoDTO[]>(`/templates/lotacao/${lotacaoId}`),
  obter: (id: number) => apiGet<TemplateLotacaoDTO>(`/templates/${id}`),
  criar: (lotacaoId: number, input: CriarLayoutInput) => apiPost<TemplateLotacaoDTO>(`/templates/lotacao/${lotacaoId}`, input),
  atualizar: (id: number, input: CriarLayoutInput) => apiPut<TemplateLotacaoDTO>(`/templates/${id}`, input),
  excluir: (id: number) => apiDelete<null>(`/templates/${id}`),
};
```

- [ ] **Step 2: Typecheck + commit**

`escalasApi.criar` já usa `CriarEscalaInput` (que ganhou `template_id` na T4) — sem mudança de assinatura. Run `pnpm typecheck` (de apps/web) → PASS.
```bash
git add apps/web/src/lib/api/layouts.ts
git commit -m "✨ feat(web): layoutsApi (CRUD de layouts)"
```

---

### Task 6: Tela de Layouts (CRUD) + menu

**Files:**
- Create: `apps/web/src/features/layouts/useLayoutDraft.ts` (+ `.test.ts`)
- Create: `apps/web/src/features/layouts/LayoutEditor.tsx`
- Create: `apps/web/src/routes/_app/layouts/index.tsx` (+ `layouts.test.tsx`)
- Modify: `apps/web/src/components/AppShell.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `layoutsApi` (T5), `useLotacoesDoUsuario`, Mantine.
- Produces: rota `/layouts`; `useLayoutDraft`.

- [ ] **Step 1: `useLayoutDraft` (TDD)**

Teste `useLayoutDraft.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react';
import { useLayoutDraft } from './useLayoutDraft';

it('inicia vazio e adiciona guarnição/vaga; toPayload monta o input', () => {
  const { result } = renderHook(() => useLayoutDraft());
  act(() => result.current.setNome('Dia Útil'));
  act(() => result.current.addGuarnicao());
  act(() => result.current.addVaga(0));
  const p = result.current.toPayload();
  expect(p.nome).toBe('Dia Útil');
  expect(p.guarnicoes[0]!.vagas_sugeridas.length).toBeGreaterThanOrEqual(1);
});
```
Implementação `useLayoutDraft.ts` (useForm Mantine, espelha `useDiaDraft`):
```ts
import { useForm } from '@mantine/form';
import type { CriarLayoutInput } from '@escalas/shared-schemas';

const novaVaga = () => ({ funcao: '', quantidade_sugerida: 1 });
const novaGuarnicao = (ordem: number) => ({ sigla: '', atividade: '', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem, vagas_sugeridas: [novaVaga()] });

export function useLayoutDraft(inicial?: CriarLayoutInput) {
  const form = useForm<CriarLayoutInput>({ initialValues: inicial ?? { nome: '', guarnicoes: [novaGuarnicao(0)] } });
  return {
    ...form,
    setNome: (n: string) => form.setFieldValue('nome', n),
    addGuarnicao: () => form.insertListItem('guarnicoes', novaGuarnicao(form.values.guarnicoes.length)),
    removeGuarnicao: (gi: number) => form.removeListItem('guarnicoes', gi),
    addVaga: (gi: number) => form.insertListItem(`guarnicoes.${gi}.vagas_sugeridas`, novaVaga()),
    removeVaga: (gi: number, vi: number) => form.removeListItem(`guarnicoes.${gi}.vagas_sugeridas`, vi),
    toPayload: (): CriarLayoutInput => form.values,
  };
}
```
Run `pnpm test useLayoutDraft` → PASS.

- [ ] **Step 2: `LayoutEditor.tsx` (apresentação)**

```tsx
// apps/web/src/features/layouts/LayoutEditor.tsx
import { Button, Card, Group, NumberInput, Stack, TextInput, Title, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { useLayoutDraft } from './useLayoutDraft';

export function LayoutEditor({ draft, onSalvar, salvando }: {
  draft: ReturnType<typeof useLayoutDraft>; onSalvar: () => void; salvando: boolean;
}) {
  return (
    <Stack>
      <Group justify="space-between">
        <TextInput label="Nome do layout" w={280} {...draft.getInputProps('nome')} />
        <Group><Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
          <Button color="cbmrn" onClick={onSalvar} loading={salvando}>Salvar Layout</Button></Group>
      </Group>
      {draft.values.guarnicoes.map((g, gi) => (
        <Card key={gi} withBorder>
          <Group>
            <TextInput label="Sigla" w={100} {...draft.getInputProps(`guarnicoes.${gi}.sigla`)} />
            <TextInput label="Atividade" w={160} {...draft.getInputProps(`guarnicoes.${gi}.atividade`)} />
            <TextInput label="Início" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_inicio`)} />
            <TextInput label="Fim" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_fim`)} />
            <ActionIcon color="red" mt={24} aria-label="Remover guarnição" onClick={() => draft.removeGuarnicao(gi)}><IconTrash size={16} /></ActionIcon>
          </Group>
          <Title order={6} mt="sm">Vagas (função × quantidade)</Title>
          {g.vagas_sugeridas.map((_v, vi) => (
            <Group key={vi} mt={4}>
              <TextInput placeholder="Função" w={200} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.funcao`)} />
              <NumberInput w={90} min={1} max={50} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.quantidade_sugerida`)} />
              <ActionIcon variant="subtle" color="red" aria-label="Remover vaga" onClick={() => draft.removeVaga(gi, vi)}><IconTrash size={14} /></ActionIcon>
            </Group>
          ))}
          <Button mt="xs" size="xs" variant="light" onClick={() => draft.addVaga(gi)}>Adicionar Vaga</Button>
        </Card>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 3: Rota `/layouts` (`index.tsx`) — escolher lotação → listar → criar/editar/excluir**

```tsx
// apps/web/src/routes/_app/layouts/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { layoutsApi } from '../../../lib/api/layouts';
import { useLotacoesDoUsuario } from '../../../features/escalas/useLotacoesDoUsuario';
import { useLayoutDraft } from '../../../features/layouts/useLayoutDraft';
import { LayoutEditor } from '../../../features/layouts/LayoutEditor';
import { ApiError } from '../../../lib/api/client';

export const Route = createFileRoute('/_app/layouts/')({ component: LayoutsPage });

export function LayoutsPage() {
  const lotacoes = useLotacoesDoUsuario();
  const [lotacaoId, setLotacaoId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | 'novo' | null>(null);
  const qc = useQueryClient();
  const { data: layouts = [] } = useQuery({ queryKey: ['layouts', lotacaoId], queryFn: () => layoutsApi.listar(lotacaoId!), enabled: !!lotacaoId });

  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Layouts de Escala</Title>
      <Select label="Lotação" placeholder="Selecione..." data={lotacoes}
        value={lotacaoId ? String(lotacaoId) : null} onChange={(v) => { setLotacaoId(v ? Number(v) : null); setEditId(null); }} w={320} />
      {lotacaoId && editId === null && (
        <Stack>
          <Group justify="space-between"><Text fw={600}>Layouts da lotação</Text>
            <Button onClick={() => setEditId('novo')}>Novo Layout</Button></Group>
          {layouts.length === 0 ? <Text c="dimmed">Nenhum layout. Crie o primeiro.</Text> : (
            <Table striped>
              <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Guarnições</Table.Th><Table.Th>Ações</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{layouts.map((l) => (
                <Table.Tr key={l.id}><Table.Td>{l.nome}</Table.Td><Table.Td>{l.qtd_guarnicoes}</Table.Td>
                  <Table.Td><Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => setEditId(l.id)}>Editar</Button>
                    <Button size="xs" variant="subtle" color="red" onClick={async () => { await layoutsApi.excluir(l.id); qc.invalidateQueries({ queryKey: ['layouts', lotacaoId] }); }}>Excluir</Button>
                  </Group></Table.Td></Table.Tr>))}</Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
      {lotacaoId && editId !== null && (
        <LayoutForm lotacaoId={lotacaoId} editId={editId} onDone={() => { setEditId(null); qc.invalidateQueries({ queryKey: ['layouts', lotacaoId] }); }} />
      )}
    </Stack>
  );
}

function LayoutForm({ lotacaoId, editId, onDone }: { lotacaoId: number; editId: number | 'novo'; onDone: () => void }) {
  const { data: existente } = useQuery({ queryKey: ['layout', editId], queryFn: () => layoutsApi.obter(editId as number), enabled: editId !== 'novo' });
  const draft = useLayoutDraft(existente ? { nome: existente.nome, guarnicoes: existente.guarnicoes.map((g) => ({ sigla: g.sigla, atividade: g.atividade, turno_padrao_inicio: g.turno_padrao_inicio, turno_padrao_fim: g.turno_padrao_fim, ordem: g.ordem, vagas_sugeridas: g.vagas_sugeridas.map((v) => ({ funcao: v.funcao, quantidade_sugerida: v.quantidade_sugerida })) })) } : undefined);
  const salvar = useMutation({
    mutationFn: () => editId === 'novo' ? layoutsApi.criar(lotacaoId, draft.toPayload()) : layoutsApi.atualizar(editId, draft.toPayload()),
    onSuccess: () => { notifications.show({ message: 'Layout salvo.' }); onDone(); },
    onError: (e) => notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro ao salvar' }),
  });
  return <LayoutEditor draft={draft} onSalvar={() => salvar.mutate()} salvando={salvar.isPending} />;
}
```
> `LayoutForm` é remontado por `key={editId}` implícito? Para reseed ao trocar de layout, passar `key={String(editId)}` no `<LayoutForm>`.

- [ ] **Step 4: Teste da rota (MSW)**

```tsx
// apps/web/src/routes/_app/layouts/layouts.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { LayoutsPage } from './index';

const BASE = 'http://localhost:3000/api/v1';
// renderiza com um AuthProvider fake? LayoutsPage usa useLotacoesDoUsuario (useAuth). Ver nota abaixo.

it('lista layouts da lotação selecionada', async () => {
  server.use(http.get(`${BASE}/templates/lotacao/100`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ id: 1, lotacao_id: 100, nome: 'Dia Útil', qtd_guarnicoes: 2 }] })));
  // Para o teste, exportar também um componente que recebe lotações por prop OU mockar useAuth.
  // (Ver nota de implementação — testar via um wrapper que injeta useAuth com role ESCALANTE lotacao 100.)
  renderWithProviders(<LayoutsPage />);
  // seleciona a lotação e confirma render do layout
  // ... (interação com o Select)
});
```
> **Nota de implementação:** `LayoutsPage` depende de `useLotacoesDoUsuario` (→ `useAuth`). Para testar de forma isolada, extrair a parte visual (lista + editor) recebendo `lotacoes` por prop, OU envolver o teste num `AuthProvider` mockado. Escolha do implementer: extrair `LayoutsView({ lotacoes })` exportado e testar essa view (mais simples). Ajustar o teste para `<LayoutsView lotacoes={[{value:'100',label:'1BBM'}]} />` e exercitar Select→lista.

- [ ] **Step 5: Item de menu**

Em `AppShell.tsx`, sob a seção "Escala" (NavLink "Escala"), adicionar um sub-item quando o usuário for escalante. Como `AppShellNav` ainda não recebe um flag de escalante, usar uma rota sempre visível para ESCALANTE/super-admin: adicionar prop `canLayouts` análoga a `canExecutar` (computar em `_app.tsx`: `is_super_admin || roles.some(r => r.role === 'ESCALANTE')`) e renderizar `<NavLink to="/layouts" label="Layouts" />` sob "Escala". Acrescentar teste em `AppShell.test.tsx` (item aparece quando `canLayouts`).

- [ ] **Step 6: Rodar testes + commit**

Run: `pnpm test layouts useLayoutDraft AppShell` → verdes; `pnpm typecheck`.
```bash
git add apps/web/src/features/layouts apps/web/src/routes/_app/layouts apps/web/src/components/AppShell.tsx apps/web/src/components/AppShell.test.tsx apps/web/src/routes/_app.tsx
git commit -m "✨ feat(web): tela de Layouts (CRUD) + menu"
```

---

### Task 7: Nova Escala — seletor de layout

**Files:**
- Modify: `apps/web/src/features/escalas/NovaEscalaForm.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `layoutsApi.listar`, `criarEscalaSchema` (com template_id).

- [ ] **Step 1: Teste que falha**

Acrescentar a `NovaEscalaForm.test.tsx`: ao escolher lotação, carrega layouts; sem layout escolhido o submit não dispara `onSubmit`; com layout, dispara com `template_id`. (MSW para `GET /templates/lotacao/:id`.)

- [ ] **Step 2: Implementar**

No `NovaEscalaForm`: adicionar ao form `template_id: 0`; após escolher a lotação, `useQuery(['layouts', lotacao_id], () => layoutsApi.listar(lotacao_id), { enabled: lotacao_id>0 })`; renderizar `Select` "Layout" (options dos layouts; desabilitado se vazio, com texto "Crie um layout para esta lotação em Layouts"); `template_id` no submit. `criarEscalaSchema` já exige `template_id` (T4) → zodResolver bloqueia submit sem layout.

- [ ] **Step 3: Rodar + commit**

Run: `pnpm test NovaEscala` → verde; `pnpm typecheck`.
```bash
git add apps/web/src/features/escalas/NovaEscalaForm.tsx apps/web/src/features/escalas/NovaEscalaForm.test.tsx
git commit -m "✨ feat(web): seletor de layout na Nova Escala"
```

---

### Task 8: Editor do dia — vaga aberta rotulada como DO

**Files:**
- Modify: `apps/web/src/components/VagaRow.tsx`
- Modify: `apps/web/src/components/GuarnicaoCard.test.tsx`

**Interfaces:** —

- [ ] **Step 1: Ajustar o teste existente**

Em `GuarnicaoCard.test.tsx`, o teste "marca vaga sem militar como VAGO" deve passar a esperar "DO". Trocar:
```tsx
expect(screen.getByText('DO')).toBeInTheDocument();
```
e o título do `it` para "marca vaga sem militar como DO".

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test GuarnicaoCard` → FAIL (ainda renderiza "VAGO").

- [ ] **Step 3: Implementar — `VagaRow.tsx`**

Trocar o badge:
```tsx
{vaga.militar_id === null && <Badge color="grape" title="Diária Operacional — vaga aberta, será ofertada">DO</Badge>}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test GuarnicaoCard` → PASS. Depois a suíte inteira `pnpm test`, `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/VagaRow.tsx apps/web/src/components/GuarnicaoCard.test.tsx
git commit -m "✨ feat(web): vaga aberta rotulada como DO (Diária Operacional) no editor"
```

---

## Self-Review (preenchido)
- **Cobertura do spec:** layouts N por lotação + nome (T1/T2/T3), Escala.template_id (T1) e criar-com-layout (T4), DO=vaga aberta sem flag (T8 rótulo; nenhum campo novo na Vaga — confere com o spec), UI de layouts (T6), seletor na Nova Escala (T7), API web (T5). `getMapaForca`/Vaga intocados.
- **Placeholders:** os passos têm código concreto. As duas notas de teste (T6 Step 4: extrair `LayoutsView` p/ testar isolado do `useAuth`; T7: descrição do teste) são instruções de adaptação, não placeholders de implementação — o implementer tem o caminho e o código base.
- **Consistência de tipos:** `CriarLayoutInput` (T2) usado em T5/T6; `LayoutResumoDTO`/`TemplateLotacaoDTO` (T1) em T5/T6; `layoutService.*` (T2) em T3; `template_id` em `CriarEscalaInput` (T4) consumido por T7; `layoutsApi` (T5) por T6/T7.
- **Ordem:** T1→T4 backend (sequencial; T4 depende do schema T1). T5→T8 web. T6 mexe em `_app.tsx`/AppShell (flag `canLayouts`).

## Execução
Backend (T1–T4) verificável por curl/testes; web (T5–T8) com verificação ao vivo (Playwright). Escolher modo no handoff.
