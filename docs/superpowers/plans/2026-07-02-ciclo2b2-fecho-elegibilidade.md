# Ciclo 2b.2 — Fecho da Elegibilidade por Patente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as pendências do 2b: camada LAYOUT da cascata (UI no editor de layout), aviso live por vaga-id no editor do dia, lista de divergências de patente na aprovação do gestor, e as limpezas diferidas do review 2b.1.

**Architecture:** Reusa a `FuncaoPatente` do 2b.1 (sem migration). O layout autora regras `FuncaoPatente(template_id, funcao_norm)` sincronizadas pelo `layoutService`. O editor do dia passa a resolver `patentes_esperadas` a partir do draft (por vaga, não por índice posicional). Um endpoint novo varre a escala e lista as vagas divergentes para o gestor. Aviso continua SOFT.

**Tech Stack:** Node 20 + TypeScript ESM, Express, Prisma + PostgreSQL 16, Zod, Vitest; React 18 + Vite + TanStack + Mantine 7 + Vitest/RTL/MSW.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-02-ciclo2b2-fecho-elegibilidade-design.md`.
- **Aviso é SEMPRE soft** — nunca bloqueia; o conflito de turno (422) permanece intacto.
- **Sem migration nova** — usa a tabela `FuncaoPatente` do 2b.1 (`{lotacao_id?, template_id?, funcao_norm, patente_ids Int[]}`, índices únicos parciais por escopo).
- **Regra do layout é por `(template_id, funcao_norm)`** — mesma função em duas guarnições do layout compartilha a regra (dedupe por `funcao_norm`, última ocorrência vence).
- **`normalizeFuncao`** (`apps/backend/src/utils/funcao.js`): UPPER + sem acento + trim + colapsa espaços. Toda comparação por função usa isso.
- **ESM:** imports com `.js`; 2 espaços; resposta `{success, message, data}`; rotas `/api/v1/`.
- Ao fim de cada task: `npm run typecheck` e `npm run lint` no app tocado (**rodar em `apps/web` E `apps/backend` quando a task mexe em `packages/*`**, pois os DTOs/schemas são consumidos nos dois); `npm test` nas tasks com testes.
- Repo `escalas`: sempre `main`, commit direto; push só sob ordem explícita.

---

### Task 1: Camada LAYOUT — backend (schema + DTO + sync + leitura no layoutService)

**Files:**
- Modify: `packages/shared-schemas/src/template.schemas.ts` (`vagaSugeridaInputSchema`)
- Modify: `packages/shared-types/src/template.ts` (`TemplateVagaSugeridaDTO`)
- Modify: `apps/backend/src/services/template.service.ts`
- Test: `apps/backend/src/tests/integration/layout-patentes.service.test.ts`

**Interfaces:**
- Consumes: `FuncaoPatente`, `normalizeFuncao` (2b.1).
- Produces: `layoutService.criar/atualizar` sincronizam `FuncaoPatente(template_id, funcao_norm)`; `layoutService.obter` retorna `patentes_esperadas: number[]` por vaga sugerida.

- [ ] **Step 1: Zod — aceitar `patentes_esperadas` na vaga sugerida**

Em `packages/shared-schemas/src/template.schemas.ts`, dentro de `vagaSugeridaInputSchema`, após `quantidade_sugerida`:
```ts
  patentes_esperadas: z.array(z.number().int().positive()).max(72).optional(),
```

- [ ] **Step 2: DTO — expor `patentes_esperadas` por vaga sugerida**

Em `packages/shared-types/src/template.ts`, no `TemplateVagaSugeridaDTO`, após `quantidade_sugerida`:
```ts
  patentes_esperadas: number[];
```

- [ ] **Step 3: Escrever os testes (falhando)**

Criar `apps/backend/src/tests/integration/layout-patentes.service.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';

async function ctx() {
  const lot = await testPrisma.lotacao.create({ data: { id: 950, sigla: 'L950', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM950', nome: 'Adm', last_sync_at: new Date() } });
  return { lot, admin };
}
const guarn = (funcao: string, patentes?: number[]) => ({
  sigla: 'INC', atividade: 'INCENDIO', turno_padrao_inicio: '08:00', turno_padrao_fim: '08:00', ordem: 0,
  vagas_sugeridas: [{ funcao, quantidade_sugerida: 1, ...(patentes ? { patentes_esperadas: patentes } : {}) }],
});

describe('layoutService — camada patentes', () => {
  beforeEach(async () => { await resetDb(); });

  it('criar sincroniza FuncaoPatente(template_id) para funções com patentes', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12, 13])] }, testPrisma);
    const regras = await testPrisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
    expect(regras).toHaveLength(1);
    expect(regras[0]!).toMatchObject({ funcao_norm: 'COMANDANTE', patente_ids: [12, 13] });
  });

  it('função sem patentes não cria regra', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Motorista')] }, testPrisma);
    expect(await testPrisma.funcaoPatente.count({ where: { template_id: tpl.id } })).toBe(0);
  });

  it('atualizar faz replace-all das regras do layout', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12])] }, testPrisma);
    await layoutService.atualizar(tpl.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [4])] }, testPrisma);
    const regras = await testPrisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
    expect(regras).toHaveLength(1);
    expect(regras[0]!.patente_ids).toEqual([4]);
  });

  it('obter devolve patentes_esperadas por vaga (e [] quando sem regra)', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12])] }, testPrisma);
    const obtido = await layoutService.obter(tpl.id, testPrisma);
    const vaga = obtido!.guarnicoes[0]!.vagas_sugeridas[0]! as unknown as { patentes_esperadas: number[] };
    expect(vaga.patentes_esperadas).toEqual([12]);
  });
});
```

- [ ] **Step 4: Rodar — verificar que falha**

```bash
cd apps/backend && npm test -- layout-patentes
```
Esperado: FAIL (sync não existe).

- [ ] **Step 5: Implementar o sync + leitura no `template.service.ts`**

Em `apps/backend/src/services/template.service.ts`:

Importar no topo:
```ts
import { normalizeFuncao } from '../utils/funcao.js';
```

Adicionar helper (acima de `layoutService`):
```ts
// Regra do layout é por (template_id, funcao_norm): dedupe por função (última vence).
async function syncLayoutPatentes(tx: Prisma.TransactionClient, template_id: number, guarnicoes: CriarLayoutInput['guarnicoes']) {
  await tx.funcaoPatente.deleteMany({ where: { template_id } });
  const porFuncao = new Map<string, number[]>();
  for (const g of guarnicoes) {
    for (const v of g.vagas_sugeridas) {
      const pats = v.patentes_esperadas ?? [];
      if (pats.length > 0) porFuncao.set(normalizeFuncao(v.funcao), pats);
    }
  }
  for (const [funcao_norm, patente_ids] of porFuncao) {
    await tx.funcaoPatente.create({ data: { template_id, funcao_norm, patente_ids } });
  }
}

// Anexa patentes_esperadas (das regras FuncaoPatente do template) a cada vaga sugerida, por funcao_norm.
async function anexarPatentes<T extends { id: number; guarnicoes: { vagas_sugeridas: { funcao: string }[] }[] }>(tpl: T, prisma: PrismaClient): Promise<T> {
  const regras = await prisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
  const porFuncao = new Map(regras.map((r) => [r.funcao_norm, r.patente_ids] as const));
  for (const g of tpl.guarnicoes) {
    for (const v of g.vagas_sugeridas as ({ funcao: string } & { patentes_esperadas: number[] })[]) {
      v.patentes_esperadas = porFuncao.get(normalizeFuncao(v.funcao)) ?? [];
    }
  }
  return tpl;
}
```

Trocar `criar` para transacionar e sincronizar:
```ts
  async criar(lotacao_id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const lot = await prisma.lotacao.findUnique({ where: { id: lotacao_id } });
    if (!lot) throw new NotFoundError('Lotação não encontrada.');
    try {
      const tpl = await prisma.$transaction(async (tx) => {
        const criado = await tx.templateLotacao.create({
          data: { lotacao_id, nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
          include: includeAninhado,
        });
        await syncLayoutPatentes(tx, criado.id, input.guarnicoes);
        return criado;
      });
      return anexarPatentes(tpl, prisma);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe um layout com esse nome nesta lotação.');
      throw e;
    }
  },
```

No `atualizar`, dentro da `$transaction`, após o `update` das guarnições e antes do `findUniqueOrThrow`, adicionar `await syncLayoutPatentes(tx, id, input.guarnicoes);`, e trocar o retorno final para `return anexarPatentes(await tx.templateLotacao.findUniqueOrThrow({ where: { id }, include: includeAninhado }), tx as unknown as PrismaClient);`.

No `obter`, trocar o retorno por:
```ts
  async obter(id: number, prisma: PrismaClient) {
    const tpl = await prisma.templateLotacao.findUnique({ where: { id }, include: includeAninhado });
    return tpl ? anexarPatentes(tpl, prisma) : tpl;
  },
```

- [ ] **Step 6: Rodar — passar + suite + typecheck + lint + commit**

```bash
cd apps/backend && npm test -- layout-patentes && npm test && npm run typecheck && npm run lint
cd ../.. && git add packages/shared-schemas/src/template.schemas.ts packages/shared-types/src/template.ts apps/backend/src/services/template.service.ts apps/backend/src/tests/integration/layout-patentes.service.test.ts
git commit -m "✨ feat(layout): camada de patentes no layout (sync FuncaoPatente por template)"
```

---

### Task 2: Camada LAYOUT — web (MultiSelect de patentes no editor de layout)

**Files:**
- Modify: `apps/web/src/features/layouts/useLayoutDraft.ts`
- Modify: `apps/web/src/features/layouts/LayoutEditor.tsx`
- Test: `apps/web/src/features/layouts/LayoutEditor.test.tsx`

**Interfaces:**
- Consumes: `patentesApi.listar()` (2b.1); `patentes_esperadas` no input/DTO (Task 1).

- [ ] **Step 1: Default no draft**

Em `apps/web/src/features/layouts/useLayoutDraft.ts`, trocar `novaVaga`:
```ts
const novaVaga = () => ({ funcao: '', quantidade_sugerida: 1, patentes_esperadas: [] as number[] });
```

- [ ] **Step 2: MultiSelect no editor**

Em `apps/web/src/features/layouts/LayoutEditor.tsx`:
- Importar: `import { MultiSelect } from '@mantine/core';`, `import { useQuery } from '@tanstack/react-query';`, `import { patentesApi } from '../../lib/api/patentes';`.
- No corpo do componente, buscar patentes uma vez:
```tsx
  const { data: patentes = [] } = useQuery({ queryKey: ['patentes'], queryFn: () => patentesApi.listar() });
  const patenteOpts = [...patentes]
    .sort((a, b) => a.forca_id - b.forca_id || a.ordem - b.ordem)
    .map((p) => ({ value: String(p.id), label: `${p.sigla} — ${p.nome}` }));
```
- Dentro do bloco de cada vaga sugerida (onde há o `TextInput` de Função e o `NumberInput` de quantidade), adicionar:
```tsx
<MultiSelect
  label="Patentes esperadas" placeholder="(herda da lotação/global)" w={260} data={patenteOpts} searchable clearable
  value={(draft.values.guarnicoes[gi]!.vagas_sugeridas[vi]!.patentes_esperadas ?? []).map(String)}
  onChange={(vals) => draft.setFieldValue(`guarnicoes.${gi}.vagas_sugeridas.${vi}.patentes_esperadas`, vals.map(Number))}
/>
```
(Ajustar `gi`/`vi` aos nomes de índice usados no `.map` do editor.)

- [ ] **Step 3: Teste do editor**

Em `apps/web/src/features/layouts/LayoutEditor.test.tsx`, adicionar um caso (MSW mocka `/patentes` retornando 2 patentes; usar `renderWithProviders`): renderiza o editor com uma guarnição/vaga, confirma que o campo "Patentes esperadas" aparece. Se os testes existentes não mockam `/patentes`, adicionar o handler no setup do arquivo. Rodar:
```bash
cd apps/web && npm test -- LayoutEditor
```
Esperado: PASS.

- [ ] **Step 4: Suite web + typecheck + lint + commit**

```bash
cd apps/web && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/features/layouts/useLayoutDraft.ts apps/web/src/features/layouts/LayoutEditor.tsx apps/web/src/features/layouts/LayoutEditor.test.tsx
git commit -m "✨ feat(web): patentes esperadas por função no editor de layout"
```

---

### Task 3: Aviso live por vaga-id no editor do dia

**Files:**
- Modify: `apps/web/src/features/escalas/useDiaDraft.ts`
- Modify: `apps/web/src/routes/_app/escalas/$id.dias.$data.tsx`
- Test: `apps/web/src/features/escalas/useDiaDraft.test.ts`

**Interfaces:**
- Consumes: `VagaDTO.patentes_esperadas` (2b.1); `GuarnicaoCard`/`VagaRow`/`MilitarPicker` (2b.1).
- Produces: `getPatentesEsperadas` lê do draft (estável a add/remove).

- [ ] **Step 1: Draft carrega `patentes_esperadas` por vaga**

Em `apps/web/src/features/escalas/useDiaDraft.ts`:
- `novaVaga`: adicionar `patentes_esperadas: null as number[] | null` ao objeto retornado.
- No `initialValues`, no `.map` das vagas, adicionar `patentes_esperadas: v.patentes_esperadas,` (o `v` é `VagaDTO`, já tem o campo).
- No `toPutInput`, remover os campos só-de-UI antes de enviar:
```ts
    toPutInput: (): PutDiaInput => ({
      observacoes: form.values.observacoes,
      guarnicoes: form.values.guarnicoes.map((g) => ({
        sigla: g.sigla, atividade: g.atividade, viatura_id: g.viatura_id,
        turno_inicio: g.turno_inicio, turno_fim: g.turno_fim, ordem: g.ordem,
        vagas: g.vagas.map((v) => ({ funcao: v.funcao, militar_id: v.militar_id, turno_inicio: v.turno_inicio, turno_fim: v.turno_fim, observacoes: v.observacoes })),
      })),
    }),
```
> `PutDiaInput`/`VagaInput` não têm `patentes_esperadas`; ao mantê-lo só no estado do form e removê-lo no `toPutInput`, o tipo do form passa a divergir de `PutDiaInput`. Trocar o genérico do `useForm` para um tipo local `DiaDraft` que estende as vagas com `patentes_esperadas?: number[] | null`, e o `toPutInput` retorna `PutDiaInput`. Definir no topo do arquivo:
```ts
type VagaDraft = VagaInput & { patentes_esperadas?: number[] | null };
type GuarnicaoDraft = Omit<GuarnicaoInput, 'vagas'> & { vagas: VagaDraft[] };
type DiaDraft = { observacoes: string | null; guarnicoes: GuarnicaoDraft[] };
```
e `useForm<DiaDraft>(...)`.

- [ ] **Step 2: A rota lê do draft (não do `diaInicial` por índice)**

Em `apps/web/src/routes/_app/escalas/$id.dias.$data.tsx`, trocar o prop passado ao `GuarnicaoCard`:
```tsx
getPatentesEsperadas={(gix, vix) => draft.values.guarnicoes[gix]?.vagas[vix]?.patentes_esperadas ?? null}
```

- [ ] **Step 3: Teste — o aviso acompanha a vaga por posição no draft após remover**

Em `apps/web/src/features/escalas/useDiaDraft.test.ts`, adicionar (o fixture do dia precisa das vagas com `patentes_esperadas`/`aviso_patente`):
```ts
it('mantém patentes_esperadas por vaga ao remover uma guarnição/vaga (não desalinha)', () => {
  const dia = {
    id: 1, data: '2026-03-15', observacoes: null,
    guarnicoes: [
      { id: 1, sigla: 'A', atividade: 'X', viatura_id: null, turno_inicio: '08:00', turno_fim: '08:00', ordem: 0,
        vagas: [
          { id: 9, funcao: 'Comandante', militar_id: 100, turno_inicio: '08:00', turno_fim: '08:00', observacoes: null, patentes_esperadas: [12], aviso_patente: false },
          { id: 10, funcao: 'Motorista', militar_id: 101, turno_inicio: '08:00', turno_fim: '08:00', observacoes: null, patentes_esperadas: [17], aviso_patente: false },
        ] },
    ],
  };
  const { result } = renderHook(() => useDiaDraft(dia as never));
  act(() => result.current.removeVaga(0, 0)); // remove a 1ª vaga (Comandante)
  // agora a vaga na posição 0 é a Motorista → patentes_esperadas [17]
  expect(result.current.values.guarnicoes[0]!.vagas[0]!.patentes_esperadas).toEqual([17]);
});
```
(Importar `act`/`renderHook` como no teste existente.) Rodar:
```bash
cd apps/web && npm test -- useDiaDraft
```
Esperado: PASS.

- [ ] **Step 4: Suite web + typecheck + lint + commit**

```bash
cd apps/web && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/features/escalas/useDiaDraft.ts "apps/web/src/routes/_app/escalas/\$id.dias.\$data.tsx" apps/web/src/features/escalas/useDiaDraft.test.ts
git commit -m "✨ feat(web): aviso de patente acompanha a vaga por id no editor do dia"
```

---

### Task 4: Divergências de patente na escala — backend (endpoint)

**Files:**
- Create: `packages/shared-types/src/avisoPatente.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `apps/backend/src/services/patente.service.ts`
- Modify: `apps/backend/src/controllers/escala.controller.ts`
- Modify: `apps/backend/src/routes/escala.routes.ts`
- Test: `apps/backend/src/tests/integration/avisosPatente.routes.test.ts`

**Interfaces:**
- Consumes: `esperadasPara`, `patenteDivergente` (2b.1).
- Produces: `AvisoPatenteDTO`; `patenteService.avisosDaEscala(escala_id, prisma): Promise<AvisoPatenteDTO[]>`; `GET /api/v1/escalas/:id/avisos-patente`.

- [ ] **Step 1: DTO**

Criar `packages/shared-types/src/avisoPatente.ts`:
```ts
export interface AvisoPatenteDTO {
  data: string; // YYYY-MM-DD
  guarnicao_sigla: string;
  funcao: string;
  militar_id: number;
  militar_nome: string;
  patente_sigla: string | null;
  patentes_esperadas: number[];
}
```
Em `packages/shared-types/src/index.ts`, adicionar `export * from './avisoPatente.js';`.

- [ ] **Step 2: Teste (falhando)**

Criar `apps/backend/src/tests/integration/avisosPatente.routes.test.ts` no padrão dos `*.routes.test.ts` (usar `buildApp`, `signAccess`, helper de super-admin/escalante como em `feriado.routes.test.ts`/`escala.routes.test.ts`). Cenário: lotação + escala publicada com um dia; patentes 12 e 17; regra global `COMANDANTE→[12]`; uma vaga "Comandante" preenchida com militar de patente 17 (divergente) e outra com patente 12 (ok). Chamar `GET /escalas/:id/avisos-patente` com token de ESCALANTE/GESTOR da lotação; esperar 200 e **exatamente uma** entrada (a divergente) com `funcao`, `militar_nome`, `patentes_esperadas: [12]`, `data`. Rodar:
```bash
cd apps/backend && npm test -- avisosPatente.routes
```
Esperado: FAIL.

- [ ] **Step 3: Service — `avisosDaEscala` (memoizado por função)**

Em `apps/backend/src/services/patente.service.ts`, adicionar ao objeto `patenteService`:
```ts
  async avisosDaEscala(escala_id: number, prisma: PrismaClient) {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id }, select: { lotacao_id: true, template_id: true } });
    if (!escala) return [];
    const dias = await prisma.escalaDia.findMany({
      where: { escala_id },
      orderBy: { data: 'asc' },
      include: { guarnicoes: { orderBy: { ordem: 'asc' }, include: { vagas: { orderBy: { id: 'asc' }, include: { militar: { select: { id: true, nome: true, patente: { select: { sigla: true } } } } } } } } },
    });
    const memo = new Map<string, number[] | null>();
    const esperadasMemo = async (funcao: string) => {
      const k = normalizeFuncao(funcao);
      if (!memo.has(k)) memo.set(k, await this.esperadasPara(funcao, escala.lotacao_id, escala.template_id, prisma));
      return memo.get(k)!;
    };
    const out = [];
    for (const dia of dias) {
      const dataStr = dia.data.toISOString().slice(0, 10);
      for (const g of dia.guarnicoes) {
        for (const v of g.vagas) {
          if (!v.militar_id || !v.militar) continue;
          const esperadas = await esperadasMemo(v.funcao);
          if (!this.patenteDivergente(v.militar.patente_id ?? null, esperadas)) continue;
          out.push({
            data: dataStr, guarnicao_sigla: g.sigla, funcao: v.funcao,
            militar_id: v.militar.id, militar_nome: v.militar.nome,
            patente_sigla: v.militar.patente?.sigla ?? null, patentes_esperadas: esperadas ?? [],
          });
        }
      }
    }
    return out;
  },
```
> `esperadasPara` já importa `normalizeFuncao` no arquivo. `v.militar.patente_id` não vem no select acima — trocar o select do militar para `{ id: true, nome: true, patente_id: true, patente: { select: { sigla: true } } }`.

- [ ] **Step 4: Controller + rota**

Em `apps/backend/src/controllers/escala.controller.ts`, importar `patenteService` (`import { patenteService } from '../services/patente.service.js';` se ainda não) e adicionar handler:
```ts
  async avisosPatente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await patenteService.avisosDaEscala(Number(req.params.id), prisma);
      ok(res, 'Avisos de patente.', data);
    } catch (e) { handle(res, next, e); }
  },
```
Em `apps/backend/src/routes/escala.routes.ts`, após a rota de `resumo-servicos`:
```ts
escalaRoutes.get('/:id/avisos-patente', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.avisosPatente);
```

- [ ] **Step 5: Rodar — passar + suite + typecheck + lint + commit**

```bash
cd apps/backend && npm test -- avisosPatente.routes && npm test && npm run typecheck && npm run lint
cd ../.. && git add packages/shared-types/src/avisoPatente.ts packages/shared-types/src/index.ts apps/backend/src/services/patente.service.ts apps/backend/src/controllers/escala.controller.ts apps/backend/src/routes/escala.routes.ts apps/backend/src/tests/integration/avisosPatente.routes.test.ts
git commit -m "🌐 feat(patente): endpoint de divergências de patente da escala (gestor)"
```

---

### Task 5: Divergências de patente — web (tabela na Aprovação)

**Files:**
- Modify: `apps/web/src/lib/api/validacoes.ts`
- Modify: `apps/web/src/routes/_app/aprovacao/escalas/$id.tsx`
- Test: `apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx`

**Interfaces:**
- Consumes: `GET /escalas/:id/avisos-patente` (Task 4), `AvisoPatenteDTO`.

- [ ] **Step 1: Cliente de API**

Em `apps/web/src/lib/api/validacoes.ts`, importar `AvisoPatenteDTO` de `@escalas/shared-types` e adicionar ao objeto:
```ts
  avisosPatente: (id: number) => apiGet<AvisoPatenteDTO[]>(`/escalas/${id}/avisos-patente`),
```

- [ ] **Step 2: Seção na tela de aprovação**

Em `apps/web/src/routes/_app/aprovacao/escalas/$id.tsx`:
- Adicionar query: `const { data: avisos = [] } = useQuery({ queryKey: ['avisos-patente', escalaId], queryFn: () => validacoesApi.avisosPatente(escalaId) });`
- Abaixo do `ResumoServicosTable`, renderizar uma seção:
```tsx
<Title order={5} mt="md">Divergências de patente</Title>
{avisos.length === 0 ? (
  <Text c="dimmed" size="sm">Nenhuma divergência de patente.</Text>
) : (
  <Table striped withTableBorder>
    <Table.Thead><Table.Tr><Table.Th>Dia</Table.Th><Table.Th>Guarnição</Table.Th><Table.Th>Função</Table.Th><Table.Th>Militar</Table.Th><Table.Th>Patente</Table.Th></Table.Tr></Table.Thead>
    <Table.Tbody>
      {avisos.map((a, i) => (
        <Table.Tr key={i}><Table.Td>{a.data}</Table.Td><Table.Td>{a.guarnicao_sigla}</Table.Td><Table.Td>{a.funcao}</Table.Td><Table.Td>{a.militar_nome}</Table.Td><Table.Td>{a.patente_sigla ?? '—'}</Table.Td></Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
)}
```
(`Table`/`Text`/`Title` já são importados na tela; se `Text` não estiver, adicionar ao import de `@mantine/core`.)

- [ ] **Step 3: Teste**

Em `apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx`, adicionar o mock MSW de `/escalas/:id/avisos-patente` (retornar uma divergência) e afirmar que a linha aparece (ex.: nome do militar + função). Garantir que os mocks já existentes (`getMes`, `resumo-servicos`) seguem. Rodar:
```bash
cd apps/web && npm test -- aprovacaoEscala
```
Esperado: PASS.

- [ ] **Step 4: Suite web + typecheck + lint + commit**

```bash
cd apps/web && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/lib/api/validacoes.ts "apps/web/src/routes/_app/aprovacao/escalas/\$id.tsx" apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx
git commit -m "✨ feat(web): tabela de divergências de patente na aprovação do gestor"
```

---

### Task 6: Limpezas diferidas do review 2b.1

**Files:**
- Modify: `apps/backend/src/services/escala.service.ts` (`enriquecerComPatentes` — memoizar)
- Modify: `apps/backend/src/services/funcaoPatente.service.ts` (`criar` — P2002→409)
- Modify: `apps/backend/src/controllers/funcaoPatente.controller.ts` (`listar` — NaN guard)
- Modify: `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx` (MultiSelect plano)
- Test: `apps/backend/src/tests/integration/funcaoPatente.routes.test.ts` (reforço opcional)

**Interfaces:** nenhuma nova (ajustes internos).

- [ ] **Step 1: Memoizar `esperadasPara` por função dentro de `enriquecerComPatentes`**

Em `apps/backend/src/services/escala.service.ts`, no `enriquecerComPatentes`, substituir a chamada direta por um memo local por `funcao_norm`:
```ts
  const memo = new Map<string, number[] | null>();
  const esperadasMemo = async (funcao: string) => {
    const k = normalizeFuncao(funcao);
    if (!memo.has(k)) memo.set(k, await patenteService.esperadasPara(funcao, escala.lotacao_id, escala.template_id, prisma));
    return memo.get(k)!;
  };
```
e trocar `const esperadas = await patenteService.esperadasPara(...)` por `const esperadas = await esperadasMemo(v.funcao);`. Importar `normalizeFuncao` de `../utils/funcao.js` no topo (se ainda não).

- [ ] **Step 2: `funcaoPatenteService.criar` — mapear P2002 → 409**

Em `apps/backend/src/services/funcaoPatente.service.ts`, envolver o `create` em try/catch (mantendo o pre-check existente):
```ts
    try {
      return await prisma.funcaoPatente.create({ data: { lotacao_id, template_id: null, funcao_norm, patente_ids: input.patente_ids } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe regra para essa função neste escopo.');
      throw e;
    }
```
Importar `Prisma` de `@prisma/client` no topo (`import { Prisma, type PrismaClient } from '@prisma/client';`).

- [ ] **Step 3: `listar` — NaN guard**

Em `apps/backend/src/controllers/funcaoPatente.controller.ts`, no `listar`:
```ts
      const raw = req.query.lotacao_id ? Number(req.query.lotacao_id) : undefined;
      const lotacao_id = raw != null && !Number.isNaN(raw) ? raw : undefined;
```

- [ ] **Step 4: Catálogo — MultiSelect plano (sem "Força {id}")**

Em `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx`, trocar a montagem do `data` do MultiSelect de patentes por uma lista plana ordenada:
```tsx
  const patenteOpts = [...patentes]
    .sort((a, b) => a.forca_id - b.forca_id || a.ordem - b.ordem)
    .map((p) => ({ value: String(p.id), label: `${p.sigla} — ${p.nome}` }));
```
(remover o agrupamento `group: 'Força ${forca_id}'`.)

- [ ] **Step 5: Rodar tudo + typecheck + lint + commit**

```bash
cd apps/backend && npm test && npm run typecheck && npm run lint
cd ../web && npm test && npm run typecheck && npm run lint
cd .. && git add apps/backend/src/services/escala.service.ts apps/backend/src/services/funcaoPatente.service.ts apps/backend/src/controllers/funcaoPatente.controller.ts apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx
git commit -m "🧹 chore(patente): memoiza esperadasPara, P2002→409, NaN guard, catálogo lista plana"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** camada layout backend (T1) + web (T2); aviso live por vaga-id (T3); divergências gestor backend (T4) + web (T5); limpezas — N+1/P2002/NaN/lista plana (T6). O gancho 2c é explicitamente fora-de-escopo no spec. ✔
- **Sem placeholders:** SQL/código/comandos concretos; os testes de rota (T4/T5) apontam o arquivo-modelo e os casos exatos. ✔
- **Consistência de tipos:** `patentes_esperadas` no `vagaSugeridaInputSchema`/`TemplateVagaSugeridaDTO` (T1) consumido em T2; `VagaDTO.patentes_esperadas` (2b.1) no draft (T3); `AvisoPatenteDTO` (T4) consumido em T5; `avisosDaEscala`/`patenteDivergente`/`esperadasPara` assinaturas idênticas entre service, endpoint e memo. ✔
- **Riscos anotados:** (a) T1 `anexarPatentes` recebe `tx as PrismaClient` no atualizar (só faz findMany — ok). (b) T3 muda o genérico do `useForm` para `DiaDraft` — conferir que `getInputProps`/`setFieldValue` seguem tipando (o mantine form é agnóstico). (c) T4 select do militar precisa de `patente_id` além de `patente.sigla` (nota no Step 3). (d) `Prisma` já importado em vários services — não duplicar import.

## Validação final (controlador, pós-T6)
Backend `:3000` + `seed:patentes`. (1) Criar/editar um layout com "Patentes esperadas" numa função e conferir via `GET /templates/:id` que volta `patentes_esperadas`; criar escala com esse layout e ver a cascata layout vencer no `GET .../dias/:data`. (2) No editor do dia, remover uma vaga acima e ver o aviso acompanhar a vaga certa. (3) `GET /escalas/:id/avisos-patente` lista as divergências; a tela de Aprovação mostra a tabela. (4) Catálogo com lista plana de patentes; criar regra duplicada em corrida ainda dá 409.
