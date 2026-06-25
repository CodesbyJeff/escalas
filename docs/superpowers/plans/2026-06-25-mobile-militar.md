# Mobile Militar (1º corte) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao militar a visão da própria escala — uma API "meus serviços" no backend e um app RN/Expo (login + home + calendário), sem push.

**Architecture:** Backend: novo endpoint `GET /api/v1/me/servicos` (só `authMiddleware`, filtra por `req.user.id`), seguindo o padrão service/controller/route + DTO/Zod compartilhados. Mobile: novo `apps/mobile` (Expo + Expo Router + Context API + react-native-calendars + expo-secure-store) consumindo essa API. Backend primeiro (pré-requisito testável); app depois.

**Tech Stack:** Backend — Node/Express/Prisma/Zod/Vitest (existente). Mobile — Expo (SDK atual), TypeScript, Expo Router, Context API, react-native-calendars, expo-secure-store, Jest (jest-expo) para lógica.

## Global Constraints

- Branch `main` (escalas commita direto na main). NÃO push, NÃO deploy.
- Backend: respostas `{success,message,data}` via `ok/fail`; rotas `/api/v1` pt-BR snake_case; erros HttpError mapeados por `handle(res,next,e)`. NÃO alterar contratos existentes.
- "Meus serviços" = `Vaga.militar_id = req.user.id` em escalas com `status ∈ {publicada, em_validacao, aprovada}`. SEM dados de execução.
- Datas em UTC meia-noite (padrão de `EscalaDia.data`); strings `YYYY-MM-DD` na borda.
- Auth: `POST /api/v1/auth/login` (CPF+senha) já existente; token JWT; refresh em `POST /api/v1/auth/refresh`.
- Mobile reusa `@escalas/shared-types` via Metro monorepo; **fallback**: tipos locais se o Metro brigar com symlinks do pnpm (Task 4 trata isso explicitamente).
- Navegação: Expo Router. Não introduzir libs fora da stack travada.
- Verificação visual do app é manual (Expo Go/device) — não automatizada nesta sessão.
- Spec: `docs/superpowers/specs/2026-06-25-mobile-militar-design.md`.

## Tipos/contratos a produzir

- `MeuServicoDTO` (shared-types/src/me.ts):
```ts
export interface MeuServicoDTO {
  vaga_id: number;
  data: string;              // YYYY-MM-DD
  funcao: string;
  turno_inicio: string;      // HH:MM
  turno_fim: string;
  guarnicao: { sigla: string; atividade: string; turno_inicio: string; turno_fim: string };
  lotacao: { id: number; sigla: string; nome: string };
}
```
- `meServicosQuerySchema` (shared-schemas/src/me.schemas.ts): `{ from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }`.
- `meService.listarMeusServicos(userId: number, from: Date, to: Date, prisma): Promise<MeuServicoDTO[]>`.

## Estrutura de arquivos
```
packages/shared-types/src/me.ts                  (T1) + index.ts (mod)
packages/shared-schemas/src/me.schemas.ts        (T1) + index.ts (mod)
apps/backend/src/services/me.service.ts          (T2) + tests/integration/me.service.test.ts
apps/backend/src/controllers/me.controller.ts    (T3)
apps/backend/src/routes/me.routes.ts             (T3) + routes/index.ts (mod) + tests/integration/me.routes.test.ts
apps/mobile/ (Expo)                              (T4 scaffold; T5–T8 telas/lógica)
```

Verificação backend (de `apps/backend`): `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Verificação mobile (de `apps/mobile`): `pnpm test` (jest lógica), `pnpm exec tsc --noEmit`; visual manual via `pnpm start` + Expo Go.

---

### Task 1: DTO + Zod da query (shared)

**Files:**
- Create: `packages/shared-types/src/me.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-schemas/src/me.schemas.ts`
- Modify: `packages/shared-schemas/src/index.ts`

**Interfaces:**
- Produces: `MeuServicoDTO`; `meServicosQuerySchema` + `MeServicosQuery`.

> Sem teste dedicado (tipos/constantes); coberto pelos consumidores (T2/T3).

- [ ] **Step 1: Criar o DTO**

```ts
// packages/shared-types/src/me.ts
export interface MeuServicoDTO {
  vaga_id: number;
  data: string; // YYYY-MM-DD
  funcao: string;
  turno_inicio: string;
  turno_fim: string;
  guarnicao: { sigla: string; atividade: string; turno_inicio: string; turno_fim: string };
  lotacao: { id: number; sigla: string; nome: string };
}
```

- [ ] **Step 2: Exportar no index de shared-types**

Adicionar ao fim de `packages/shared-types/src/index.ts`:
```ts
export * from './me.js';
```

- [ ] **Step 3: Criar o schema da query**

```ts
// packages/shared-schemas/src/me.schemas.ts
import { z } from 'zod';

const dataYMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD');

export const meServicosQuerySchema = z.object({
  from: dataYMD.optional(),
  to: dataYMD.optional(),
});
export type MeServicosQuery = z.infer<typeof meServicosQuerySchema>;
```

- [ ] **Step 4: Exportar no index de shared-schemas**

Adicionar ao fim de `packages/shared-schemas/src/index.ts`:
```ts
export * from './me.schemas.js';
```

- [ ] **Step 5: Verificar typecheck**

Run (de `apps/backend`): `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/me.ts packages/shared-types/src/index.ts packages/shared-schemas/src/me.schemas.ts packages/shared-schemas/src/index.ts
git commit -m "✨ feat(shared): MeuServicoDTO + schema da query de meus serviços"
```

---

### Task 2: `meService.listarMeusServicos` + testes

**Files:**
- Create: `apps/backend/src/services/me.service.ts`
- Test: `apps/backend/src/tests/integration/me.service.test.ts`

**Interfaces:**
- Consumes: `MeuServicoDTO` (T1).
- Produces: `meService.listarMeusServicos(userId: number, from: Date, to: Date, prisma: PrismaClient): Promise<MeuServicoDTO[]>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/me.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { meService } from '../../services/me.service.js';

beforeEach(resetDb);

// militar com 1 vaga em escala publicada (dia 2026-07-10) + 1 vaga em rascunho (não deve vir)
async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 800, sigla: 'L800', nome: 'Lot 800', nivel: 3, operacional: true } });
  const militar = await testPrisma.user.create({ data: { cpf: '80000000001', nome: 'Militar Teste', last_sync_at: new Date() } });
  const outro = await testPrisma.user.create({ data: { cpf: '80000000002', nome: 'Outro', last_sync_at: new Date() } });

  async function escalaComVaga(status: string, dataISO: string, militarId: number | null) {
    const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: Number(dataISO.slice(5, 7)), ano: Number(dataISO.slice(0, 4)), status, criado_por_id: militar.id, publicado_em: new Date() } as any });
    const dia = await testPrisma.escalaDia.create({ data: { escala_id: esc.id, data: new Date(`${dataISO}T00:00:00.000Z`) } });
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Motorista', militar_id: militarId, turno_inicio: '07:00', turno_fim: '19:00' } });
    return esc;
  }

  await escalaComVaga('publicada', '2026-07-10', militar.id);   // deve vir
  await escalaComVaga('rascunho', '2026-08-10', militar.id);    // NÃO (rascunho) — mês diferente p/ não colidir unique
  await escalaComVaga('publicada', '2026-09-10', outro.id);     // NÃO (outro militar)
  return { militar, outro, lot };
}

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('meService.listarMeusServicos', () => {
  it('retorna só as vagas do militar em escalas publicadas, dentro da faixa', async () => {
    const { militar } = await cenario();
    const r = await meService.listarMeusServicos(militar.id, D('2026-07-01'), D('2026-12-31'), testPrisma);
    expect(r).toHaveLength(1);
    expect(r[0]!.data).toBe('2026-07-10');
    expect(r[0]!.funcao).toBe('Motorista');
    expect(r[0]!.guarnicao.sigla).toBe('ABT-01');
    expect(r[0]!.lotacao.sigla).toBe('L800');
  });

  it('exclui dias fora da faixa de datas', async () => {
    const { militar } = await cenario();
    const r = await meService.listarMeusServicos(militar.id, D('2026-08-01'), D('2026-08-31'), testPrisma);
    expect(r).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test me.service`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar o service**

```ts
// apps/backend/src/services/me.service.ts
import { type PrismaClient } from '@prisma/client';
import type { MeuServicoDTO } from '@escalas/shared-types';

const VISIVEIS = ['publicada', 'em_validacao', 'aprovada'] as const;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const meService = {
  async listarMeusServicos(
    userId: number,
    from: Date,
    to: Date,
    prisma: PrismaClient,
  ): Promise<MeuServicoDTO[]> {
    const vagas = await prisma.vaga.findMany({
      where: {
        militar_id: userId,
        guarnicao: {
          dia: {
            data: { gte: from, lte: to },
            escala: { status: { in: VISIVEIS as unknown as string[] } },
          },
        },
      },
      include: {
        guarnicao: {
          include: {
            dia: { include: { escala: { include: { lotacao: true } } } },
          },
        },
      },
    });

    const servicos: MeuServicoDTO[] = vagas.map((v) => ({
      vaga_id: v.id,
      data: ymd(v.guarnicao.dia.data),
      funcao: v.funcao,
      turno_inicio: v.turno_inicio,
      turno_fim: v.turno_fim,
      guarnicao: {
        sigla: v.guarnicao.sigla,
        atividade: v.guarnicao.atividade,
        turno_inicio: v.guarnicao.turno_inicio,
        turno_fim: v.guarnicao.turno_fim,
      },
      lotacao: {
        id: v.guarnicao.dia.escala.lotacao.id,
        sigla: v.guarnicao.dia.escala.lotacao.sigla,
        nome: v.guarnicao.dia.escala.lotacao.nome,
      },
    }));

    servicos.sort((a, b) => (a.data === b.data ? a.turno_inicio.localeCompare(b.turno_inicio) : a.data.localeCompare(b.data)));
    return servicos;
  },
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test me.service`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/me.service.ts apps/backend/src/tests/integration/me.service.test.ts
git commit -m "✨ feat(backend): meService.listarMeusServicos (vagas do militar em escalas publicadas)"
```

---

### Task 3: Controller + rota `/me/servicos` + testes HTTP

**Files:**
- Create: `apps/backend/src/controllers/me.controller.ts`
- Create: `apps/backend/src/routes/me.routes.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/src/tests/integration/me.routes.test.ts`

**Interfaces:**
- Consumes: `meService` (T2), `meServicosQuerySchema` (T1).
- Produces: rota `GET /api/v1/me/servicos`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/me.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 810, sigla: 'L810', nome: 'Lot 810', nivel: 3, operacional: true } });
  const militar = await testPrisma.user.create({ data: { cpf: '81000000001', nome: 'Militar', last_sync_at: new Date() } });
  const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 7, ano: 2026, status: 'publicada', criado_por_id: militar.id, publicado_em: new Date() } });
  const dia = await testPrisma.escalaDia.create({ data: { escala_id: esc.id, data: new Date('2026-07-15T00:00:00.000Z') } });
  const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'UR-01', atividade: 'APH', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Socorrista', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' } });
  return { militar, token: signAccess({ user_id: militar.id, cpf: militar.cpf }) };
}

describe('GET /api/v1/me/servicos', () => {
  it('401 sem token', async () => {
    const r = await request(buildApp()).get('/api/v1/me/servicos');
    expect(r.status).toBe(401);
  });

  it('lista os serviços do militar autenticado dentro da faixa', async () => {
    const { token } = await cenario();
    const r = await request(buildApp()).get('/api/v1/me/servicos?from=2026-07-01&to=2026-07-31').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].funcao).toBe('Socorrista');
    expect(r.body.data[0].data).toBe('2026-07-15');
  });

  it('422 quando to < from', async () => {
    const { token } = await cenario();
    const r = await request(buildApp()).get('/api/v1/me/servicos?from=2026-07-31&to=2026-07-01').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(422);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test me.routes`
Expected: FAIL.

- [ ] **Step 3: Implementar o controller**

```ts
// apps/backend/src/controllers/me.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { meServicosQuerySchema } from '@escalas/shared-schemas';
import { meService } from '../services/me.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

function diaUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
function hojeUtc(): Date {
  return diaUtc(new Date().toISOString().slice(0, 10));
}

export const meController = {
  // GET /api/v1/me/servicos?from&to — serviços previstos do militar autenticado.
  async servicos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = meServicosQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        fail(res, parsed.error.errors[0]?.message ?? 'Query inválida', 422);
        return;
      }
      const from = parsed.data.from ? diaUtc(parsed.data.from) : hojeUtc();
      const to = parsed.data.to ? diaUtc(parsed.data.to) : new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
      if (to < from) { fail(res, 'Intervalo inválido: "to" anterior a "from".', 422); return; }
      const lista = await meService.listarMeusServicos(req.user!.id, from, to, prisma);
      ok(res, 'Meus serviços listados.', lista);
    } catch (e) { handle(res, next, e); }
  },
};
```

- [ ] **Step 4: Implementar a rota e registrar**

```ts
// apps/backend/src/routes/me.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { meController } from '../controllers/me.controller.js';

export const meRoutes = Router();
meRoutes.use(authMiddleware);
meRoutes.get('/servicos', meController.servicos);
```

Em `apps/backend/src/routes/index.ts`: importar e registrar (junto aos outros `router.use`):
```ts
import { meRoutes } from './me.routes.js';
// ...
router.use('/me', meRoutes);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test me.routes`
Expected: PASS (3 testes). Rodar também `pnpm test` (suíte inteira), `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/controllers/me.controller.ts apps/backend/src/routes/me.routes.ts apps/backend/src/routes/index.ts apps/backend/src/tests/integration/me.routes.test.ts
git commit -m "✨ feat(backend): GET /me/servicos (escala do militar autenticado)"
```

> Após esta task, o backend militar está completo e verificável por API:
> `curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/v1/me/servicos?from=2026-06-01&to=2026-07-31"`.

---

### Task 4: Scaffold do `apps/mobile` (Expo + Router + Metro monorepo) — TASK DE RISCO

**Files:**
- Create: `apps/mobile/` (projeto Expo: `package.json`, `app.json`, `tsconfig.json`, `metro.config.js`, `app/_layout.tsx`, `app/index.tsx`)

**Interfaces:**
- Produces: app Expo que builda e abre uma tela placeholder; resolve `@escalas/shared-types` (ou fallback de tipos locais).

> Greenfield, dependente de ambiente. Não é TDD; o "teste" é o app abrir. Trate o Metro como risco e aplique o fallback se necessário.

- [ ] **Step 1: Criar o app Expo dentro do monorepo**

De `apps/`:
```bash
cd apps
pnpm create expo-app@latest mobile --template blank-typescript
```
Ajustar `apps/mobile/package.json`: `"name": "@escalas/mobile"`, e instalar Expo Router + deps:
```bash
cd mobile
pnpm add expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
pnpm add expo-secure-store react-native-calendars
```
Configurar Expo Router conforme docs: em `package.json` `"main": "expo-router/entry"`, e em `app.json` adicionar o plugin `"expo-router"` e um `scheme`.

- [ ] **Step 2: Metro monorepo + resolução de shared-types**

Criar `apps/mobile/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
```

- [ ] **Step 3: Telas mínimas (placeholder)**

`apps/mobile/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```
`apps/mobile/app/index.tsx`:
```tsx
import { View, Text } from 'react-native';
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Escalas CBMRN — Mobile (placeholder)</Text>
    </View>
  );
}
```

- [ ] **Step 4: Verificar que builda e o typecheck passa**

Run (de `apps/mobile`):
```bash
pnpm exec tsc --noEmit
pnpm start --no-dev --max-workers 1   # (ou `pnpm start`) — confirmar bundle sem erro de resolução
```
Expected: typecheck PASS; Metro inicia o bundler sem erro de "Unable to resolve". **Se** `@escalas/shared-types` não resolver no Metro mesmo com a config: aplicar o **fallback** — criar `apps/mobile/src/types.ts` com `MeuServicoDTO`/`AuthUser`/`LoginInput` copiados, e usar esses tipos no app em vez de importar o pacote. Documentar a escolha no commit.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-workspace.yaml
git commit -m "✨ feat(mobile): scaffold Expo + Router + Metro monorepo"
```

> Se `pnpm-workspace.yaml` já cobre `apps/*`, o novo app entra automaticamente; senão, incluir `apps/mobile` no glob.

---

### Task 5: Storage (SecureStore) + cliente de API + APIs auth/servicos

**Files:**
- Create: `apps/mobile/src/auth/storage.ts`
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/auth.ts`
- Create: `apps/mobile/src/api/servicos.ts`
- Test: `apps/mobile/src/api/client.test.ts`

**Interfaces:**
- Consumes: `MeuServicoDTO`, `AuthUser` (shared ou fallback local).
- Produces: `getToken/setTokens/clearTokens`; `apiGet/apiPost`, `ApiError`; `authApi.login/me`; `servicosApi.meus(from?,to?)`.

> Jest com `jest-expo` para a lógica de unwrap/erro do client (fetch mockado). Configurar Jest no `package.json`: `"jest": { "preset": "jest-expo" }` e script `"test": "jest"`. Mockar `expo-secure-store`.

- [ ] **Step 1: Escrever o teste do client (falha)**

```ts
// apps/mobile/src/api/client.test.ts
import { apiGet, ApiError } from './client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'tok'),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, message: 'ok', data }) });

afterEach(() => jest.restoreAllMocks());

it('desembrulha data em sucesso', async () => {
  global.fetch = jest.fn(async () => okJson([{ vaga_id: 1 }]) as any) as any;
  const r = await apiGet<any[]>('/me/servicos');
  expect(r).toEqual([{ vaga_id: 1 }]);
});

it('lança ApiError com status em erro', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 422, json: async () => ({ success: false, message: 'ruim', data: null }) }) as any) as any;
  await expect(apiGet('/me/servicos')).rejects.toMatchObject({ status: 422, message: 'ruim' });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/mobile`): `pnpm test client`
Expected: FAIL.

- [ ] **Step 3: Implementar storage + client + apis**

```ts
// apps/mobile/src/auth/storage.ts
import * as SecureStore from 'expo-secure-store';
const TOKEN = 'escalas.token';
const REFRESH = 'escalas.refresh';
export const getToken = () => SecureStore.getItemAsync(TOKEN);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH);
export const setToken = (t: string) => SecureStore.setItemAsync(TOKEN, t);
export const setTokens = async (t: string, r: string) => { await SecureStore.setItemAsync(TOKEN, t); await SecureStore.setItemAsync(REFRESH, r); };
export const clearTokens = async () => { await SecureStore.deleteItemAsync(TOKEN); await SecureStore.deleteItemAsync(REFRESH); };
```

```ts
// apps/mobile/src/api/client.ts
import { getToken, getRefreshToken, setToken, clearTokens } from '../auth/storage';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

async function refresh(): Promise<boolean> {
  const refresh_token = await getRefreshToken();
  if (!refresh_token) return false;
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) });
  if (!res.ok) return false;
  const body = await res.json();
  if (!body.success) return false;
  await setToken(body.data.token);
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !retried) {
    if (await refresh()) return request<T>(method, path, body, true);
    await clearTokens();
    throw new ApiError(401, 'Sessão expirada.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.success) throw new ApiError(res.status, json?.message ?? 'Erro de comunicação.');
  return json.data as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
```

```ts
// apps/mobile/src/api/auth.ts
import type { AuthUser } from '@escalas/shared-types';
import { apiGet, apiPost } from './client';
export interface LoginResponse { token: string; refresh_token: string; user: AuthUser; }
export const authApi = {
  login: (cpf: string, senha: string) => apiPost<LoginResponse>('/auth/login', { cpf, senha }),
  me: () => apiGet<AuthUser>('/auth/me'),
};
```

```ts
// apps/mobile/src/api/servicos.ts
import type { MeuServicoDTO } from '@escalas/shared-types';
import { apiGet } from './client';
export const servicosApi = {
  meus: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return apiGet<MeuServicoDTO[]>(`/me/servicos${qs ? `?${qs}` : ''}`);
  },
};
```

> Se o fallback de tipos foi aplicado na T4, importar de `../types` em vez de `@escalas/shared-types`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test client`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src apps/mobile/package.json
git commit -m "✨ feat(mobile): storage SecureStore + cliente de API + auth/servicos"
```

---

### Task 6: AuthContext + tela de Login

**Files:**
- Create: `apps/mobile/src/auth/AuthContext.tsx`
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/index.tsx` (redireciona conforme auth)

**Interfaces:**
- Consumes: `authApi` (T5), storage (T5).
- Produces: `AuthProvider`, `useAuth()` → `{ user, loading, login, logout }`.

> Sem teste automatizado (UI nativa). Verificação manual no Step final.

- [ ] **Step 1: Implementar AuthContext**

```tsx
// apps/mobile/src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';
import { authApi } from '../api/auth';
import { getToken, setTokens, clearTokens } from './storage';

interface Ctx { user: AuthUser | null; loading: boolean; login: (cpf: string, senha: string) => Promise<void>; logout: () => Promise<void>; }
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (!(await getToken())) { setLoading(false); return; }
      try { setUser(await authApi.me()); } catch { await clearTokens(); } finally { setLoading(false); }
    })();
  }, []);
  const login = async (cpf: string, senha: string) => {
    const res = await authApi.login(cpf, senha);
    await setTokens(res.token, res.refresh_token);
    setUser(res.user);
  };
  const logout = async () => { await clearTokens(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
```

- [ ] **Step 2: Envolver o app no provider**

```tsx
// apps/mobile/app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth/AuthContext';
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Index redireciona conforme auth**

```tsx
// apps/mobile/app/index.tsx
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
```

- [ ] **Step 4: Tela de Login**

```tsx
// apps/mobile/app/login.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onEntrar = async () => {
    setErro(null); setBusy(true);
    try { await login(cpf, senha); router.replace('/(tabs)'); }
    catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#b3001b' }}>ESCALAS CBMRN</Text>
      {erro && <Text style={{ color: 'red' }}>{erro}</Text>}
      <TextInput placeholder="CPF" keyboardType="number-pad" value={cpf} onChangeText={setCpf} style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      <TextInput placeholder="Senha" secureTextEntry value={senha} onChangeText={setSenha} style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }} />
      <Pressable onPress={onEntrar} disabled={busy} style={{ backgroundColor: '#b3001b', padding: 14, borderRadius: 8, alignItems: 'center' }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>ENTRAR</Text>}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Verificação (typecheck + manual)**

Run (de `apps/mobile`): `pnpm exec tsc --noEmit` → PASS.
Manual (opcional agora; obrigatório no fim): `pnpm start` + Expo Go → login com um militar de teste.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app apps/mobile/src/auth/AuthContext.tsx
git commit -m "✨ feat(mobile): AuthContext + tela de login"
```

---

### Task 7: `lib/datas` (TDD) + Home (card + lista 7 dias)

**Files:**
- Create: `apps/mobile/src/lib/datas.ts`
- Test: `apps/mobile/src/lib/datas.test.ts`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/src/features/ProximoServicoCard.tsx`
- Create: `apps/mobile/src/features/ListaServicos.tsx`

**Interfaces:**
- Consumes: `servicosApi` (T5), `MeuServicoDTO`.
- Produces: `proximoServico(servicos, hojeYMD)`, `proximos7Dias(servicos, hojeYMD)`, `agruparPorDia(servicos)`, `markedDates(servicos)`.

- [ ] **Step 1: Escrever os testes de `lib/datas` (falha)**

```ts
// apps/mobile/src/lib/datas.test.ts
import { proximoServico, proximos7Dias, agruparPorDia, markedDates } from './datas';

const mk = (data: string, turno = '07:00'): any => ({ vaga_id: 1, data, funcao: 'X', turno_inicio: turno, turno_fim: '19:00', guarnicao: { sigla: 'G', atividade: 'A', turno_inicio: turno, turno_fim: '19:00' }, lotacao: { id: 1, sigla: 'L', nome: 'L' } });
const servicos = [mk('2026-06-20'), mk('2026-06-26'), mk('2026-06-28'), mk('2026-07-30')];

it('proximoServico devolve o primeiro serviço >= hoje', () => {
  expect(proximoServico(servicos, '2026-06-25')?.data).toBe('2026-06-26');
  expect(proximoServico([mk('2026-06-20')], '2026-06-25')).toBeNull();
});

it('proximos7Dias filtra a janela [hoje, hoje+6]', () => {
  const r = proximos7Dias(servicos, '2026-06-25');
  expect(r.map((s) => s.data)).toEqual(['2026-06-26', '2026-06-28']);
});

it('agruparPorDia agrupa por data', () => {
  const g = agruparPorDia([mk('2026-06-26', '07:00'), mk('2026-06-26', '19:00')]);
  expect(g['2026-06-26']).toHaveLength(2);
});

it('markedDates marca cada dia com serviço', () => {
  expect(markedDates(servicos)['2026-06-26']).toEqual({ marked: true });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test datas`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/datas`**

```ts
// apps/mobile/src/lib/datas.ts
import type { MeuServicoDTO } from '@escalas/shared-types';

export function proximoServico(servicos: MeuServicoDTO[], hojeYMD: string): MeuServicoDTO | null {
  return servicos.filter((s) => s.data >= hojeYMD).sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;
}

function addDiasYMD(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function proximos7Dias(servicos: MeuServicoDTO[], hojeYMD: string): MeuServicoDTO[] {
  const fim = addDiasYMD(hojeYMD, 6);
  return servicos.filter((s) => s.data >= hojeYMD && s.data <= fim).sort((a, b) => (a.data === b.data ? a.turno_inicio.localeCompare(b.turno_inicio) : a.data.localeCompare(b.data)));
}

export function agruparPorDia(servicos: MeuServicoDTO[]): Record<string, MeuServicoDTO[]> {
  const out: Record<string, MeuServicoDTO[]> = {};
  for (const s of servicos) (out[s.data] ??= []).push(s);
  return out;
}

export function markedDates(servicos: MeuServicoDTO[]): Record<string, { marked: true }> {
  const out: Record<string, { marked: true }> = {};
  for (const s of servicos) out[s.data] = { marked: true };
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test datas`
Expected: PASS (4 testes).

- [ ] **Step 5: Componentes de apresentação**

```tsx
// apps/mobile/src/features/ProximoServicoCard.tsx
import { View, Text } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
export function ProximoServicoCard({ servico }: { servico: MeuServicoDTO | null }) {
  if (!servico) return <View style={{ padding: 16 }}><Text style={{ color: '#777' }}>Sem próximo serviço.</Text></View>;
  return (
    <View style={{ backgroundColor: '#b3001b', borderRadius: 12, padding: 16, gap: 4 }}>
      <Text style={{ color: '#fff', fontSize: 12, opacity: 0.8 }}>PRÓXIMO SERVIÇO</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{servico.data} · {servico.turno_inicio}–{servico.turno_fim}</Text>
      <Text style={{ color: '#fff' }}>{servico.guarnicao.sigla} — {servico.guarnicao.atividade}</Text>
      <Text style={{ color: '#fff' }}>{servico.funcao} · {servico.lotacao.sigla}</Text>
    </View>
  );
}
```

```tsx
// apps/mobile/src/features/ListaServicos.tsx
import { View, Text } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
export function ListaServicos({ servicos }: { servicos: MeuServicoDTO[] }) {
  if (servicos.length === 0) return <Text style={{ color: '#777', paddingVertical: 12 }}>Nenhum serviço nos próximos dias.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {servicos.map((s) => (
        <View key={s.vaga_id} style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12 }}>
          <Text style={{ fontWeight: '600' }}>{s.data} · {s.turno_inicio}–{s.turno_fim}</Text>
          <Text>{s.guarnicao.sigla} — {s.funcao}</Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 6: Tabs + Home**

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#b3001b' }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendário' }} />
    </Tabs>
  );
}
```

```tsx
// apps/mobile/app/(tabs)/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, RefreshControl, View } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { servicosApi } from '../../src/api/servicos';
import { proximoServico, proximos7Dias } from '../../src/lib/datas';
import { ProximoServicoCard } from '../../src/features/ProximoServicoCard';
import { ListaServicos } from '../../src/features/ListaServicos';

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const [servicos, setServicos] = useState<MeuServicoDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const carregar = useCallback(async () => {
    setRefreshing(true);
    try { setServicos(await servicosApi.meus(hoje())); } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const h = hoje();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={carregar} />}>
      <ProximoServicoCard servico={proximoServico(servicos, h)} />
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700' }}>Próximos 7 dias</Text>
        <ListaServicos servicos={proximos7Dias(servicos, h)} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 7: Verificar typecheck + testes**

Run (de `apps/mobile`): `pnpm test` (datas verde) e `pnpm exec tsc --noEmit` (PASS).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib apps/mobile/src/features apps/mobile/app/'(tabs)'
git commit -m "✨ feat(mobile): home (próximo serviço + 7 dias) e helpers de data"
```

---

### Task 8: Calendário

**Files:**
- Create: `apps/mobile/app/(tabs)/calendario.tsx`
- Create: `apps/mobile/src/features/CalendarioServicos.tsx`

**Interfaces:**
- Consumes: `servicosApi` (T5), `agruparPorDia`/`markedDates` (T7), `react-native-calendars`.

> Apresentação; sem teste automatizado (a lógica de marcação já é testada em `lib/datas`). Verificação manual.

- [ ] **Step 1: Componente do calendário**

```tsx
// apps/mobile/src/features/CalendarioServicos.tsx
import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { agruparPorDia, markedDates } from '../lib/datas';
import { ListaServicos } from './ListaServicos';

export function CalendarioServicos({ servicos }: { servicos: MeuServicoDTO[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const grupos = useMemo(() => agruparPorDia(servicos), [servicos]);
  const marks = useMemo(() => {
    const m: Record<string, any> = markedDates(servicos);
    if (sel) m[sel] = { ...(m[sel] ?? {}), selected: true, selectedColor: '#b3001b' };
    return m;
  }, [servicos, sel]);
  return (
    <View style={{ gap: 12 }}>
      <Calendar markedDates={marks} onDayPress={(d) => setSel(d.dateString)} theme={{ todayTextColor: '#b3001b' }} />
      {sel && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>{sel}</Text>
          <ListaServicos servicos={grupos[sel] ?? []} />
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Tela do calendário**

```tsx
// apps/mobile/app/(tabs)/calendario.tsx
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { servicosApi } from '../../src/api/servicos';
import { CalendarioServicos } from '../../src/features/CalendarioServicos';

const hoje = () => new Date().toISOString().slice(0, 10);
function maisUmAno(ymd: string) { const d = new Date(`${ymd}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 365); return d.toISOString().slice(0, 10); }

export default function CalendarioScreen() {
  const [servicos, setServicos] = useState<MeuServicoDTO[]>([]);
  useEffect(() => { servicosApi.meus(hoje(), maisUmAno(hoje())).then(setServicos).catch(() => setServicos([])); }, []);
  return <ScrollView contentContainerStyle={{ paddingVertical: 12 }}><CalendarioServicos servicos={servicos} /></ScrollView>;
}
```

- [ ] **Step 3: Verificar typecheck**

Run (de `apps/mobile`): `pnpm exec tsc --noEmit` → PASS. `pnpm test` → tudo verde.

- [ ] **Step 4: Verificação manual final (você/usuário)**

`pnpm start` em `apps/mobile` + Expo Go (ou emulador): login com um militar de teste (ver cenário), ver o card do próximo serviço, a lista de 7 dias e o calendário marcado. Pré-requisito de dados: um militar com `senha_hash` local e vagas em escala publicada (setup de cenário, fora do código).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/'(tabs)'/calendario.tsx apps/mobile/src/features/CalendarioServicos.tsx
git commit -m "✨ feat(mobile): calendário de serviços do militar"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** API militar (T1 DTO/schema, T2 service, T3 controller/rota) — filtro por militar/status/faixa e ordenação (T2); 401/422/200 (T3). App: scaffold+Metro+fallback (T4), storage+client+apis (T5), auth+login (T6), home+lib/datas (T7), calendário (T8). Reuso de shared-types com fallback (T4/T5). Testes: backend service+rota (T2/T3), mobile lógica client+datas (T5/T7). Verificação manual do app (T8 Step 4).
- **Placeholders:** nenhum — todo passo tem código/comando concreto. As tasks de UI nativa declaram explicitamente "sem teste automatizado" com verificação manual, não placeholder.
- **Consistência de tipos:** `MeuServicoDTO` (T1) usado em T2/T5/T7/T8; `meService.listarMeusServicos(userId,from,to,prisma)` (T2) chamado por T3; `servicosApi.meus(from?,to?)` (T5) consumido por T7/T8; `proximoServico/proximos7Dias/agruparPorDia/markedDates` (T7) consumidos por Home/Calendário; `useAuth` (T6) usado por Index/Login.
- **Riscos sinalizados:** T4 (Metro+pnpm) com fallback explícito de tipos locais; verificação nativa é manual; backend é totalmente verificável por API (curl) após T3.

## Execução

Backend (T1–T3) é verificável por mim (curl/testes); mobile (T4–T8) precisa de validação manual sua via Expo Go. Escolher o modo de execução no handoff.
