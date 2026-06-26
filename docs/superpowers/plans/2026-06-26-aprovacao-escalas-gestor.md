# Aprovação de Escalas (gestor) + Resumo de Serviços local — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao gestor a tela de aprovar/rejeitar a escala prevista, apoiada por um resumo de serviços computado localmente (semana × fim-de-semana/feriado), fechando o passo 5 do Feriado (Opção A).

**Architecture:** Backend: novo `resumoServicoService` que classifica cada dia da escala via `feriadosBrasil` + tabela `Feriado` e conta serviços por militar; exposto em `GET /escalas/:id/resumo-servicos`. Reusa os endpoints de validação já existentes (`/validacoes/pendentes`, `POST /escalas/:id/validar`, `/escalas/:id/mes`). Web: item de menu "Aprovação de Escalas" (gestor) → worklist + tela lado a lado (prevista read-only + resumo) com Aprovar/Rejeitar.

**Tech Stack:** Backend — Node/Express/Prisma/Zod/Vitest. Web — React 18 + Vite + TanStack Router/Query + Mantine 7 + Vitest/RTL/MSW.

## Global Constraints

- Branch `main` (escalas commita direto na main). NÃO push, NÃO deploy.
- Backend: respostas `{success,message,data}` via `ok/fail`; rotas `/api/v1` pt-BR; erros HttpError via `handle(res,next,e)`. NÃO alterar contratos existentes; NÃO tocar `getMapaForca` (proxy SISBOM fica para a Sprint 10).
- "Resumo de serviços" = contagem LOCAL sobre a escala: por militar previsto, `total` / `semana` / `fim_semana_feriado` (sáb/dom OU feriado nacional via `feriadosBrasil` OU feriado da tabela). SEM distinção ordinário/diária (dado de execução).
- Datas em UTC meia-noite; strings `YYYY-MM-DD` na borda.
- Web: não editar `routeTree.gen.ts` à mão. MSW com `onUnhandledRequest: 'error'` → handler para todo request nos testes. Tema cor `cbmrn`.
- Reusar: `requireEscalaAccess(roles)`, `validarEscalaSchema`, `ValidacaoEscalaDTO`, `EscalaDTO`, `feriadosBrasil`, `navFlags`/`AppShellNav`.
- Spec: `docs/superpowers/specs/2026-06-26-aprovacao-escalas-gestor-design.md`.

## Tipos/contratos a produzir
- `ResumoServicoDTO` { militar_id, nome, posto: string|null, total, semana, fim_semana_feriado } (shared-types).
- `EscalaMesDTO` { id, mes, ano, status, dias: { data, vagas_total, vagas_preenchidas }[] } (shared-types — tipa o `GET /escalas/:id/mes` existente).
- `resumoServicoService.calcular(escala_id: number, prisma): Promise<ResumoServicoDTO[]>`.

## Estrutura de arquivos
```
packages/shared-types/src/validacao.ts                          (T1: +ResumoServicoDTO)
packages/shared-types/src/escala.ts                             (T1: +EscalaMesDTO)
apps/backend/src/services/resumoServico.service.ts              (T2) + tests/integration/resumoServico.service.test.ts
apps/backend/src/controllers/resumoServico.controller.ts        (T3)
apps/backend/src/routes/escala.routes.ts                        (T3: +rota) + tests/integration/resumoServico.routes.test.ts
apps/web/src/lib/api/escalas.ts                                 (T4: +getMes)
apps/web/src/lib/api/validacoes.ts                              (T4)
apps/web/src/features/aprovacao/ResumoServicosTable.tsx         (T5) + .test.tsx
apps/web/src/components/AppShell.tsx                            (T6: item Aprovação) + .test.tsx
apps/web/src/routes/_app/aprovacao/index.tsx                    (T7) + worklist.test.tsx
apps/web/src/routes/_app/aprovacao/escalas/$id.tsx              (T8) + aprovacaoEscala.test.tsx
```
Verificação backend (de `apps/backend`): `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Verificação web (de `apps/web`): `pnpm test`, `pnpm typecheck`, `pnpm lint`.

---

### Task 1: DTOs (shared)

**Files:**
- Modify: `packages/shared-types/src/validacao.ts`
- Modify: `packages/shared-types/src/escala.ts`

**Interfaces:**
- Produces: `ResumoServicoDTO`, `EscalaMesDTO`.

> Sem teste dedicado; coberto pelos consumidores (T2/T8).

- [ ] **Step 1: Adicionar `ResumoServicoDTO`**

Acrescentar ao fim de `packages/shared-types/src/validacao.ts`:
```ts
export interface ResumoServicoDTO {
  militar_id: number;
  nome: string;
  posto: string | null;
  total: number;
  semana: number;
  fim_semana_feriado: number;
}
```

- [ ] **Step 2: Adicionar `EscalaMesDTO`**

Acrescentar ao fim de `packages/shared-types/src/escala.ts`:
```ts
export interface EscalaMesDiaDTO {
  data: string; // YYYY-MM-DD
  vagas_total: number;
  vagas_preenchidas: number;
}
export interface EscalaMesDTO {
  id: number;
  mes: number;
  ano: number;
  status: EscalaStatusDTO;
  dias: EscalaMesDiaDTO[];
}
```
(`EscalaStatusDTO` já existe neste arquivo.)

- [ ] **Step 3: Typecheck + commit**

Run (de `apps/backend`): `pnpm typecheck` → PASS.
```bash
git add packages/shared-types/src/validacao.ts packages/shared-types/src/escala.ts
git commit -m "✨ feat(shared): ResumoServicoDTO + EscalaMesDTO"
```

---

### Task 2: `resumoServicoService.calcular` + testes

**Files:**
- Create: `apps/backend/src/services/resumoServico.service.ts`
- Test: `apps/backend/src/tests/integration/resumoServico.service.test.ts`

**Interfaces:**
- Consumes: `ResumoServicoDTO` (T1), `feriadosBrasil` (`../utils/feriados.js`).
- Produces: `resumoServicoService.calcular(escala_id, prisma): Promise<ResumoServicoDTO[]>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/resumoServico.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { resumoServicoService } from '../../services/resumoServico.service.js';

beforeEach(resetDb);

// Escala set/2026. Datas: 04=sex(semana), 05=sáb(fds), 07=Independência(feriado nacional),
// 08=ter(semana), 15=ter + Feriado-tabela(feriado). Militar A em todas (5); Militar B só 08 (1).
async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 830, sigla: 'L830', nome: 'Lot 830', nivel: 3, operacional: true } });
  const a = await testPrisma.user.create({ data: { cpf: '83000000001', nome: 'Alfa', posto: 'SD', last_sync_at: new Date() } });
  const b = await testPrisma.user.create({ data: { cpf: '83000000002', nome: 'Bravo', posto: 'CB', last_sync_at: new Date() } });
  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: a.id, publicado_em: new Date() } });
  await testPrisma.feriado.create({ data: { data: new Date('2026-09-15T00:00:00.000Z'), descricao: 'Feriado estadual teste', tipo: 'estadual' } });
  async function vaga(dataISO: string, militarId: number) {
    const dia = await testPrisma.escalaDia.upsert({
      where: { escala_id_data: { escala_id: escala.id, data: new Date(`${dataISO}T00:00:00.000Z`) } },
      update: {}, create: { escala_id: escala.id, data: new Date(`${dataISO}T00:00:00.000Z`) },
    });
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: militarId, turno_inicio: '07:00', turno_fim: '19:00' } });
  }
  for (const d of ['2026-09-04','2026-09-05','2026-09-07','2026-09-08','2026-09-15']) await vaga(d, a.id);
  await vaga('2026-09-08', b.id);
  return { escala, a, b };
}

describe('resumoServicoService.calcular', () => {
  it('classifica semana × fim-de-semana/feriado (sáb, feriado nacional, feriado da tabela)', async () => {
    const { escala, a } = await cenario();
    const r = await resumoServicoService.calcular(escala.id, testPrisma);
    const alfa = r.find((x) => x.militar_id === a.id)!;
    expect(alfa.total).toBe(5);
    expect(alfa.semana).toBe(2);            // 04 (sex) + 08 (ter)
    expect(alfa.fim_semana_feriado).toBe(3); // 05 (sáb) + 07 (Independência) + 15 (tabela)
  });

  it('lista um item por militar, ordenado por nome', async () => {
    const { escala } = await cenario();
    const r = await resumoServicoService.calcular(escala.id, testPrisma);
    expect(r.map((x) => x.nome)).toEqual(['Alfa', 'Bravo']);
    expect(r.find((x) => x.nome === 'Bravo')!.total).toBe(1);
  });
});
```

> Nota: o teste usa `escalaDia.upsert` com a unique composta `escala_id_data` (já existe `@@unique([escala_id, data])`) porque vários militares compartilham o mesmo dia.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test resumoServico.service`
Expected: FAIL.

- [ ] **Step 3: Implementar o service**

```ts
// apps/backend/src/services/resumoServico.service.ts
import { type PrismaClient } from '@prisma/client';
import type { ResumoServicoDTO } from '@escalas/shared-types';
import { NotFoundError } from '../utils/errors.js';
import { feriadosBrasil } from '../utils/feriados.js';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const resumoServicoService = {
  async calcular(escala_id: number, prisma: PrismaClient): Promise<ResumoServicoDTO[]> {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
    if (!escala) throw new NotFoundError('Escala não encontrada.');

    // Conjunto de feriados do mês: nacionais (feriadosBrasil) + tabela Feriado.
    const inicio = new Date(Date.UTC(escala.ano, escala.mes - 1, 1));
    const fim = new Date(Date.UTC(escala.ano, escala.mes, 0)); // último dia do mês
    const feriadoSet = new Set<string>(feriadosBrasil(escala.ano).map((f) => ymd(f.data)));
    const tabela = await prisma.feriado.findMany({ where: { data: { gte: inicio, lte: fim } } });
    for (const f of tabela) feriadoSet.add(ymd(f.data));

    const vagas = await prisma.vaga.findMany({
      where: { militar_id: { not: null }, guarnicao: { dia: { escala_id } } },
      include: { guarnicao: { include: { dia: true } }, militar: true },
    });

    const acc = new Map<number, ResumoServicoDTO>();
    for (const v of vagas) {
      if (v.militar_id == null || !v.militar) continue;
      const cur = acc.get(v.militar_id) ?? {
        militar_id: v.militar_id, nome: v.militar.nome, posto: v.militar.posto ?? null,
        total: 0, semana: 0, fim_semana_feriado: 0,
      };
      const data = v.guarnicao.dia.data;
      const dow = data.getUTCDay();
      const ehFdsFeriado = dow === 0 || dow === 6 || feriadoSet.has(ymd(data));
      cur.total += 1;
      if (ehFdsFeriado) cur.fim_semana_feriado += 1; else cur.semana += 1;
      acc.set(v.militar_id, cur);
    }
    return [...acc.values()].sort((x, y) => x.nome.localeCompare(y.nome));
  },
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test resumoServico.service`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/resumoServico.service.ts apps/backend/src/tests/integration/resumoServico.service.test.ts
git commit -m "✨ feat(backend): resumoServicoService (contagem local semana×fds/feriado — passo 5/A)"
```

---

### Task 3: Controller + rota `/:id/resumo-servicos` + testes HTTP

**Files:**
- Create: `apps/backend/src/controllers/resumoServico.controller.ts`
- Modify: `apps/backend/src/routes/escala.routes.ts`
- Test: `apps/backend/src/tests/integration/resumoServico.routes.test.ts`

**Interfaces:**
- Consumes: `resumoServicoService` (T2).
- Produces: rota `GET /api/v1/escalas/:id/resumo-servicos`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/backend/src/tests/integration/resumoServico.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 840, sigla: 'L840', nome: 'Lot 840', nivel: 3, operacional: true } });
  const gestor = await testPrisma.user.create({ data: { cpf: '84000000001', nome: 'Gestor', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
  const outro = await testPrisma.user.create({ data: { cpf: '84000000009', nome: 'Outro', last_sync_at: new Date() } });
  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: gestor.id, publicado_em: new Date() } });
  const dia = await testPrisma.escalaDia.create({ data: { escala_id: escala.id, data: new Date('2026-09-04T00:00:00.000Z') } });
  const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: gestor.id, turno_inicio: '07:00', turno_fim: '19:00' } });
  return {
    escala,
    tokenGestor: signAccess({ user_id: gestor.id, cpf: gestor.cpf }),
    tokenOutro: signAccess({ user_id: outro.id, cpf: outro.cpf }),
  };
}

describe('GET /api/v1/escalas/:id/resumo-servicos', () => {
  it('gestor da lotação obtém o resumo (200)', async () => {
    const { escala, tokenGestor } = await cenario();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/resumo-servicos`).set('authorization', `Bearer ${tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].semana).toBe(1);
    expect(r.body.data[0].fim_semana_feriado).toBe(0);
  });

  it('403 para quem não tem papel na lotação', async () => {
    const { escala, tokenOutro } = await cenario();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/resumo-servicos`).set('authorization', `Bearer ${tokenOutro}`);
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test resumoServico.routes`
Expected: FAIL.

- [ ] **Step 3: Implementar o controller**

```ts
// apps/backend/src/controllers/resumoServico.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { resumoServicoService } from '../services/resumoServico.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

export const resumoServicoController = {
  // GET /api/v1/escalas/:id/resumo-servicos — contagem local de serviços por militar.
  async resumo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lista = await resumoServicoService.calcular(Number(req.params.id), prisma);
      ok(res, 'Resumo de serviços calculado.', lista);
    } catch (e) { handle(res, next, e); }
  },
};
```

- [ ] **Step 4: Registrar a rota em `escala.routes.ts`**

Importar o controller e adicionar (junto às outras rotas `/:id/...`):
```ts
import { resumoServicoController } from '../controllers/resumoServico.controller.js';
// ...
escalaRoutes.get('/:id/resumo-servicos', requireEscalaAccess(['ESCALANTE', 'GESTOR']), resumoServicoController.resumo);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test resumoServico.routes`
Expected: PASS (2 testes). Rodar `pnpm test` (suíte inteira), `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/controllers/resumoServico.controller.ts apps/backend/src/routes/escala.routes.ts apps/backend/src/tests/integration/resumoServico.routes.test.ts
git commit -m "✨ feat(backend): GET /escalas/:id/resumo-servicos"
```

> Backend completo e verificável por curl:
> `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/escalas/<id>/resumo-servicos`.

---

### Task 4: API web — `validacoesApi` + `escalasApi.getMes`

**Files:**
- Modify: `apps/web/src/lib/api/escalas.ts`
- Create: `apps/web/src/lib/api/validacoes.ts`

**Interfaces:**
- Produces: `escalasApi.getMes(id)`; `validacoesApi.pendentes/resumoServicos/validar/validacoes`.

> Sem teste dedicado (mirrors `escalas.ts`); coberto via MSW em T7/T8.

- [ ] **Step 1: Adicionar `getMes` ao `escalasApi`**

Em `apps/web/src/lib/api/escalas.ts` — adicionar o import de tipo e a linha no objeto:
```ts
import type { EscalaDTO, EscalaDiaDTO, EscalaMesDTO } from '@escalas/shared-types';
// ... dentro de escalasApi:
  getMes: (id: number) => apiGet<EscalaMesDTO>(`/escalas/${id}/mes`),
```

- [ ] **Step 2: Criar `validacoes.ts`**

```ts
// apps/web/src/lib/api/validacoes.ts
import type { EscalaDTO, ResumoServicoDTO, ValidacaoEscalaDTO } from '@escalas/shared-types';
import type { ValidarEscalaInput } from '@escalas/shared-schemas';
import { apiGet, apiPost } from './client';

export const validacoesApi = {
  pendentes: () => apiGet<EscalaDTO[]>('/validacoes/pendentes'),
  resumoServicos: (id: number) => apiGet<ResumoServicoDTO[]>(`/escalas/${id}/resumo-servicos`),
  validar: (id: number, input: ValidarEscalaInput) => apiPost<ValidacaoEscalaDTO>(`/escalas/${id}/validar`, input),
  validacoes: (id: number) => apiGet<ValidacaoEscalaDTO[]>(`/escalas/${id}/validacoes`),
};
```

- [ ] **Step 3: Typecheck + commit**

Run (de `apps/web`): `pnpm typecheck` → PASS.
```bash
git add apps/web/src/lib/api/escalas.ts apps/web/src/lib/api/validacoes.ts
git commit -m "✨ feat(web): API de validação/aprovação (pendentes, resumo, validar) + getMes"
```

---

### Task 5: `ResumoServicosTable`

**Files:**
- Create: `apps/web/src/features/aprovacao/ResumoServicosTable.tsx`
- Test: `apps/web/src/features/aprovacao/ResumoServicosTable.test.tsx`

**Interfaces:**
- Produces: `<ResumoServicosTable itens={ResumoServicoDTO[]} />`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/features/aprovacao/ResumoServicosTable.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ResumoServicosTable } from './ResumoServicosTable';

const itens: any[] = [
  { militar_id: 1, nome: 'Alfa', posto: 'SD', total: 5, semana: 2, fim_semana_feriado: 3 },
  { militar_id: 2, nome: 'Bravo', posto: 'CB', total: 1, semana: 1, fim_semana_feriado: 0 },
];

it('mostra uma linha por militar e o total geral', () => {
  renderWithProviders(<ResumoServicosTable itens={itens} />);
  expect(screen.getByText('SD Alfa')).toBeInTheDocument();
  expect(screen.getByText('CB Bravo')).toBeInTheDocument();
  // total geral de serviços = 6
  expect(screen.getByText('Total: 6')).toBeInTheDocument();
});

it('estado vazio', () => {
  renderWithProviders(<ResumoServicosTable itens={[]} />);
  expect(screen.getByText(/nenhum militar/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test ResumoServicosTable`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/features/aprovacao/ResumoServicosTable.tsx
import { Table, Text } from '@mantine/core';
import type { ResumoServicoDTO } from '@escalas/shared-types';

export function ResumoServicosTable({ itens }: { itens: ResumoServicoDTO[] }) {
  if (itens.length === 0) return <Text c="dimmed" ta="center" py="md">Nenhum militar previsto na escala.</Text>;
  const totalGeral = itens.reduce((s, r) => s + r.total, 0);
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr><Table.Th>Militar</Table.Th><Table.Th>Total</Table.Th><Table.Th>Semana</Table.Th><Table.Th>FDS/Feriado</Table.Th></Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {itens.map((r) => (
          <Table.Tr key={r.militar_id}>
            <Table.Td>{[r.posto, r.nome].filter(Boolean).join(' ')}</Table.Td>
            <Table.Td>{r.total}</Table.Td>
            <Table.Td>{r.semana}</Table.Td>
            <Table.Td>{r.fim_semana_feriado}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
      <Table.Tfoot>
        <Table.Tr><Table.Th colSpan={4}>Total: {totalGeral}</Table.Th></Table.Tr>
      </Table.Tfoot>
    </Table>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test ResumoServicosTable`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/aprovacao/ResumoServicosTable.tsx apps/web/src/features/aprovacao/ResumoServicosTable.test.tsx
git commit -m "✨ feat(web): tabela de resumo de serviços"
```

---

### Task 6: Item de menu "Aprovação de Escalas"

**Files:**
- Modify: `apps/web/src/components/AppShell.tsx`
- Test: `apps/web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: `canValidar` (já é prop de `AppShellNav`).
- Produces: NavLink "Aprovação de Escalas" (to `/aprovacao`) quando `canValidar`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao `apps/web/src/components/AppShell.test.tsx` (dentro do bloco de gating, reusando os imports já presentes):
```tsx
it('mostra "Aprovação de Escalas" quando canValidar', () => {
  renderWithProviders(<AppShellNav nome="A" papel="Administrador" canExecutar={false} canValidar onLogout={() => {}} />);
  expect(screen.getByText('Aprovação de Escalas')).toBeInTheDocument();
});
it('esconde "Aprovação de Escalas" quando não canValidar', () => {
  renderWithProviders(<AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} onLogout={() => {}} />);
  expect(screen.queryByText('Aprovação de Escalas')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test AppShell`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `apps/web/src/components/AppShell.tsx`: importar `IconGavel` de `@tabler/icons-react` (junto aos outros ícones) e adicionar o NavLink logo após o item "Validação" (dentro do `{canValidar && (...)}` já existente ou um novo bloco):
```tsx
{canValidar && (
  <NavLink component={Link} to="/aprovacao" label="Aprovação de Escalas" c="white" leftSection={<IconGavel size={18} />} />
)}
```
(Manter o item "Validação" da execução; este é adicional, ambos sob `canValidar`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test AppShell`
Expected: PASS. Rodar `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/AppShell.tsx apps/web/src/components/AppShell.test.tsx
git commit -m "✨ feat(web): item de menu Aprovação de Escalas (gestor)"
```

---

### Task 7: Worklist `/aprovacao`

**Files:**
- Create: `apps/web/src/routes/_app/aprovacao/index.tsx`
- Test: `apps/web/src/routes/_app/aprovacao/worklist.test.tsx`

**Interfaces:**
- Consumes: `validacoesApi.pendentes` (T4), `EscalaDTO`.
- Produces: rota `/_app/aprovacao/`; componente exportado `AprovacaoWorklist`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/routes/_app/aprovacao/worklist.test.tsx
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { AprovacaoWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista escalas em validação', async () => {
  server.use(http.get(`${BASE}/validacoes/pendentes`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { id: 7, lotacao_id: 100, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: 1, publicado_em: null },
    ] })));
  renderWithProviders(<AprovacaoWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('09/2026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /revisar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/validacoes/pendentes`, () => HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<AprovacaoWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhuma escala aguardando aprovação/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test aprovacao/worklist`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/routes/_app/aprovacao/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Stack, Table, Text, Title, Button, Badge } from '@mantine/core';
import type { EscalaDTO } from '@escalas/shared-types';
import { validacoesApi } from '../../../lib/api/validacoes';

export const Route = createFileRoute('/_app/aprovacao/')({ component: AprovacaoWorklistPage });

function AprovacaoWorklistPage() {
  const navigate = useNavigate();
  return <AprovacaoWorklist onAbrir={(e) => navigate({ to: '/aprovacao/escalas/$id', params: { id: String(e.id) } })} />;
}

export function AprovacaoWorklist({ onAbrir }: { onAbrir: (e: EscalaDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['validacoes', 'pendentes'], queryFn: validacoesApi.pendentes });
  if (isLoading) return <Loader />;
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Aprovação de Escalas</Title>
      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhuma escala aguardando aprovação.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Lotação</Table.Th><Table.Th>Período</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ação</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>#{e.lotacao_id}</Table.Td>
                <Table.Td>{String(e.mes).padStart(2, '0')}/{e.ano}</Table.Td>
                <Table.Td><Badge color="yellow">{e.status}</Badge></Table.Td>
                <Table.Td><Button size="xs" variant="light" onClick={() => onAbrir(e)}>Revisar</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test aprovacao/worklist`
Expected: PASS (2 testes).

> O `navigate` referencia a rota da T8; o typecheck do `to` pode reclamar até a T8 existir — registre e siga (resolve na T8). Os testes importam `AprovacaoWorklist` direto.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_app/aprovacao/index.tsx apps/web/src/routes/_app/aprovacao/worklist.test.tsx
git commit -m "✨ feat(web): worklist de aprovação (/aprovacao)"
```

---

### Task 8: Tela de aprovação `/aprovacao/escalas/$id`

**Files:**
- Create: `apps/web/src/routes/_app/aprovacao/escalas/$id.tsx`
- Test: `apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx`

**Interfaces:**
- Consumes: `validacoesApi` (T4), `escalasApi.getMes` (T4), `ResumoServicosTable` (T5), `validarEscalaSchema` (shared), `ApiError`.
- Produces: rota `/_app/aprovacao/escalas/$id`; componente exportado `AprovacaoEscalaScreen`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { AprovacaoEscalaScreen } from './$id';

const BASE = 'http://localhost:3000/api/v1';
function mockBase() {
  server.use(
    http.get(`${BASE}/escalas/7/mes`, () => HttpResponse.json({ success: true, message: 'ok', data: { id: 7, mes: 9, ano: 2026, status: 'em_validacao', dias: [{ data: '2026-09-04', vagas_total: 3, vagas_preenchidas: 2 }] } })),
    http.get(`${BASE}/escalas/7/resumo-servicos`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ militar_id: 1, nome: 'Alfa', posto: 'SD', total: 5, semana: 2, fim_semana_feriado: 3 }] })),
  );
}

it('mostra a prevista (cobertura) e o resumo', async () => {
  mockBase();
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  expect(await screen.findByText('2026-09-04')).toBeInTheDocument();
  expect(screen.getByText('2/3')).toBeInTheDocument();
  expect(screen.getByText('SD Alfa')).toBeInTheDocument();
});

it('aprovar → notificação de sucesso', async () => {
  mockBase();
  server.use(http.post(`${BASE}/escalas/7/validar`, () => HttpResponse.json({ success: true, message: 'ok', data: { id: 1, escala_versao_id: 1, gestor_id: 1, status: 'aprovada', justificativa: null, created_at: '2026-09-01T00:00:00.000Z' } }, { status: 201 })));
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /aprovar/i }));
  await waitFor(() => expect(screen.getByText(/escala aprovada/i)).toBeInTheDocument());
});

it('rejeitar exige justificativa (botão confirmar desabilitado sem texto)', async () => {
  mockBase();
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  expect(screen.getByRole('button', { name: /confirmar rejeição/i })).toBeDisabled();
});

it('409 ao aprovar → notificação de recarga', async () => {
  mockBase();
  server.use(http.post(`${BASE}/escalas/7/validar`, () => HttpResponse.json({ success: false, message: 'A escala não está em validação.', data: null }, { status: 409 })));
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /aprovar/i }));
  await waitFor(() => expect(screen.getByText(/recarregue/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test aprovacaoEscala`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/routes/_app/aprovacao/escalas/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Loader, Modal, SimpleGrid, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { validacoesApi } from '../../../../lib/api/validacoes';
import { escalasApi } from '../../../../lib/api/escalas';
import { ApiError } from '../../../../lib/api/client';
import { ResumoServicosTable } from '../../../../features/aprovacao/ResumoServicosTable';

export const Route = createFileRoute('/_app/aprovacao/escalas/$id')({ component: AprovacaoEscalaPage });

function AprovacaoEscalaPage() {
  const { id } = Route.useParams();
  return <AprovacaoEscalaScreen escalaId={Number(id)} />;
}

export function AprovacaoEscalaScreen({ escalaId }: { escalaId: number }) {
  const { data: mes, isLoading: l1 } = useQuery({ queryKey: ['escala', 'mes', escalaId], queryFn: () => escalasApi.getMes(escalaId) });
  const { data: resumo = [], isLoading: l2 } = useQuery({ queryKey: ['resumo-servicos', escalaId], queryFn: () => validacoesApi.resumoServicos(escalaId) });
  const [rejeitarOpen, rejeitar] = useDisclosure(false);
  const [justificativa, setJustificativa] = useState('');
  const qc = useQueryClient();

  const validar = useMutation({
    mutationFn: (input: { status: 'aprovada' | 'rejeitada'; justificativa?: string }) => validacoesApi.validar(escalaId, input),
    onSuccess: (_r, input) => {
      rejeitar.close();
      notifications.show({ message: input.status === 'aprovada' ? 'Escala aprovada.' : 'Escala rejeitada.' });
      qc.invalidateQueries({ queryKey: ['validacoes', 'pendentes'] });
      qc.invalidateQueries({ queryKey: ['escala', 'mes', escalaId] });
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.status === 409) notifications.show({ color: 'red', message: 'A escala mudou de estado. Recarregue.' });
      else if (err.status === 422) notifications.show({ color: 'red', message: err.message });
      else notifications.show({ color: 'red', message: err.message });
    },
  });

  if (l1 || l2 || !mes) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Aprovação — {String(mes.mes).padStart(2, '0')}/{mes.ano}</Title>
        <Group>
          <Button color="green" onClick={() => validar.mutate({ status: 'aprovada' })} loading={validar.isPending}>Aprovar</Button>
          <Button color="red" variant="light" onClick={rejeitar.open}>Rejeitar</Button>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Stack gap="xs">
          <Text fw={700}>Prevista (cobertura por dia)</Text>
          <Table striped withTableBorder>
            <Table.Thead><Table.Tr><Table.Th>Dia</Table.Th><Table.Th>Vagas preenchidas</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {mes.dias.map((d) => (
                <Table.Tr key={d.data}><Table.Td>{d.data}</Table.Td><Table.Td>{d.vagas_preenchidas}/{d.vagas_total}</Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Resumo de serviços</Text>
          <ResumoServicosTable itens={resumo} />
        </Stack>
      </SimpleGrid>
      <Modal opened={rejeitarOpen} onClose={() => { rejeitar.close(); setJustificativa(''); }} title="Rejeitar escala" centered>
        <Stack>
          <Textarea label="Justificativa" placeholder="Descreva o que precisa ser corrigido" minRows={3} maxLength={500} value={justificativa} onChange={(e) => setJustificativa(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { rejeitar.close(); setJustificativa(''); }}>Cancelar</Button>
            <Button color="red" disabled={!justificativa.trim()} loading={validar.isPending} onClick={() => validar.mutate({ status: 'rejeitada', justificativa: justificativa.trim() })}>Confirmar rejeição</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test aprovacaoEscala`
Expected: PASS (4 testes).

- [ ] **Step 5: Verificação final**

Run (de `apps/web`): `pnpm test && pnpm typecheck && pnpm lint` → tudo verde (o `to` da T7 resolve agora).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_app/aprovacao/escalas/
git commit -m "✨ feat(web): tela de aprovação da escala (prevista + resumo + aprovar/rejeitar)"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** resumo local com classificação semana×fds/feriado (T2, dados concretos de set/2026), rota (T3), DTOs (T1), API web (T4), tabela de resumo (T5), menu (T6), worklist (T7), tela lado a lado prevista+resumo+aprovar/rejeitar com 422/409 (T8). Reusa `/validacoes/pendentes`, `/escalas/:id/validar`, `/escalas/:id/mes`. `getMapaForca` intocado.
- **Sem placeholders:** todo passo tem código/comando concreto; datas de teste verificadas (04=sex,05=sáb,07=Independência,08=ter,15=ter+tabela).
- **Consistência de tipos:** `ResumoServicoDTO` (T1) usado em T2/T3/T5/T8; `EscalaMesDTO` (T1) em T4/T8; `resumoServicoService.calcular` (T2) chamado por T3; `validacoesApi` (T4) consumido por T7/T8; `escalasApi.getMes` (T4) por T8; `ResumoServicosTable` (T5) por T8.
- **Ordem:** T7→T8 vizinhas (o `navigate` da T7 referencia a rota da T8) — concluir T8 antes do typecheck final.

## Execução

Backend (T1–T3) verificável por mim (curl/testes); web (T4–T8) com verificação ao vivo (Playwright). Escolher o modo no handoff.
