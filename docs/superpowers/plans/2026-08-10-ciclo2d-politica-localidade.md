# Ciclo 2d — Política de Localidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao layout uma política de localidade (`rodizia` / `fixa` / `indiferente`) que o motor de preenchimento respeita — no GBSA o militar gira entre as praias, no quartel ele permanece na guarnição dele, e sem política o comportamento é idêntico ao de hoje.

**Architecture:** Enum novo no `TemplateLotacao` (lido pelo serviço a partir de `escala.template_id`); a contagem de equidade ganha uma segunda dimensão `(militar, localidade)` alimentada pelas mesmas consultas de hoje; o núcleo puro ganha **um** critério no `sort`, entre patente e contagem total. `localidade` = `EscalaGuarnicao.atividade` normalizada por `normalizeFuncao`.

**Tech Stack:** Node 20 + TS ESM, Express, Prisma + PostgreSQL, Zod, Vitest; React 18 + Vite + TanStack + Mantine 7.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-10-ciclo2d-rodizio-localidade-design.md`.
- **`indiferente` é o default e não pode mudar nada.** Todo layout existente continua com o comportamento do Ciclo 2c, incluindo a string exata de `motivo`.
- **`fixa` é binário** (`contagemLocal > 0`), nunca placar. Entre quem pertence, a equidade normal (menor `contagem` total) decide.
- **Conflito de turno continua a única barreira dura.** Patente e descanso continuam soft e continuam **antes** da política no ranqueio.
- **Determinístico:** sem `Date.now`/random; desempate final por `militar_id`.
- **Localidade normalizada** com `normalizeFuncao` de `utils/funcao.ts` (normalizador genérico de rótulo). `motivo` exibe a **atividade original**, não a chave normalizada.
- ESM `.js` nos imports; 2 espaços; resposta `{success,message,data}`; rotas `/api/v1/`. Repo `escalas`: branch `main`, commit direto; **push só sob ordem**.
- Ao fim de cada task: `npm run typecheck`, `npm run lint`, `npm test` no app tocado (backend **e** web quando mexer em `packages/*`).

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/shared-types/src/template.ts` | tipo `PoliticaLocalidade` + campo no `TemplateLotacaoDTO` | 1 |
| `packages/shared-schemas/src/template.schemas.ts` | enum Zod + campo no `criarLayoutSchema` (default) | 1 |
| `apps/backend/prisma/schema.prisma` | enum Prisma + coluna em `TemplateLotacao` | 1 |
| `apps/backend/prisma/migrations/<ts>_0012_layout_politica_localidade/` | migration | 1 |
| `apps/backend/src/services/template.service.ts` | grava a política em `criar`/`atualizar` | 1 |
| `apps/backend/src/tests/integration/layout-politica.test.ts` | prova persistência e default | 1 |
| `apps/backend/src/utils/preenchimento.ts` | tipos + critério no `sort` + `motivo` + contagem incremental | 2 |
| `apps/backend/src/utils/preenchimento.test.ts` | comportamento das três políticas | 2 |
| `apps/backend/src/services/preenchimento.service.ts` | lê a política e monta `contagemLocalInicial` | 3 |
| `apps/backend/src/tests/integration/preenchimento.routes.test.ts` | prova a fiação ponta a ponta | 3 |
| `apps/web/src/features/layouts/useLayoutDraft.ts` | campo no rascunho do form | 4 |
| `apps/web/src/features/layouts/LayoutEditor.tsx` | `SegmentedControl` das três políticas | 4 |
| `apps/web/src/routes/_app/layouts/index.tsx` | semeia a política ao editar layout existente | 4 |
| `apps/web/src/features/layouts/LayoutEditor.test.tsx` | prova o seletor | 4 |

---

### Task 1: Política no modelo, no schema e no CRUD de layouts

**Files:**
- Modify: `packages/shared-types/src/template.ts`
- Modify: `packages/shared-schemas/src/template.schemas.ts`
- Modify: `apps/backend/prisma/schema.prisma:99-114` (model `TemplateLotacao`)
- Modify: `apps/backend/src/services/template.service.ts` (`criar` e `atualizar`)
- Test: `apps/backend/src/tests/integration/layout-politica.test.ts` (criar)

**Interfaces:**
- Produces: `PoliticaLocalidade = 'indiferente' | 'rodizia' | 'fixa'` (shared-types); `criarLayoutSchema` com `politica_localidade` (default `'indiferente'`); coluna `TemplateLotacao.politica_localidade`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/tests/integration/layout-politica.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';
import { criarLayoutSchema } from '@escalas/shared-schemas';

const guarnicoes = [{
  sigla: 'PN', atividade: 'Ponta Negra',
  turno_padrao_inicio: '07:00', turno_padrao_fim: '17:00', ordem: 0,
  vagas_sugeridas: [{ funcao: 'GUARDA_VIDAS', quantidade_sugerida: 2 }],
}];

async function cenario(lotId = 940) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({
    data: { cpf: `PL${lotId}0`, nome: 'Escalante', last_sync_at: new Date() },
  });
  return { lot, esc };
}

describe('política de localidade no layout', () => {
  beforeEach(async () => { await resetDb(); });

  it('criar grava a política escolhida', async () => {
    const { lot, esc } = await cenario(940);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'rodizia', guarnicoes }),
      testPrisma,
    );
    expect(tpl.politica_localidade).toBe('rodizia');
  });

  it('atualizar troca a política', async () => {
    const { lot, esc } = await cenario(941);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'rodizia', guarnicoes }),
      testPrisma,
    );
    const upd = await layoutService.atualizar(
      tpl.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'fixa', guarnicoes }),
      testPrisma,
    );
    expect(upd.politica_localidade).toBe('fixa');
  });

  it('sem a chave no payload, o default é indiferente', async () => {
    const { lot, esc } = await cenario(942);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'Quartel', guarnicoes }),
      testPrisma,
    );
    expect(tpl.politica_localidade).toBe('indiferente');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/backend && npm test -- layout-politica`
Expected: FAIL — o typecheck do teste quebra em `politica_localidade` (não existe no schema Zod nem no retorno do service).

- [ ] **Step 3: Tipo em shared-types**

Em `packages/shared-types/src/template.ts`, acima de `TemplateLotacaoDTO`:

```ts
export type PoliticaLocalidade = 'indiferente' | 'rodizia' | 'fixa';
```

E dentro de `TemplateLotacaoDTO`, logo após `nome: string;`:

```ts
  politica_localidade: PoliticaLocalidade;
```

- [ ] **Step 4: Enum Zod em shared-schemas**

Em `packages/shared-schemas/src/template.schemas.ts`, antes de `criarLayoutSchema`:

```ts
export const politicaLocalidadeSchema = z.enum(['indiferente', 'rodizia', 'fixa']);
```

E dentro de `criarLayoutSchema`, entre `nome` e `guarnicoes`:

```ts
  politica_localidade: politicaLocalidadeSchema.default('indiferente'),
```

- [ ] **Step 5: Enum e coluna no Prisma**

Em `apps/backend/prisma/schema.prisma`, imediatamente antes de `model TemplateLotacao`:

```prisma
enum PoliticaLocalidade {
  indiferente
  rodizia
  fixa
}
```

E dentro de `model TemplateLotacao`, logo após `nome String`:

```prisma
  politica_localidade PoliticaLocalidade @default(indiferente)
```

- [ ] **Step 6: Gerar a migration**

Run: `cd apps/backend && npx prisma migrate dev --name 0012_layout_politica_localidade`
Expected: cria `prisma/migrations/<timestamp>_0012_layout_politica_localidade/migration.sql` e regenera o client.

- [ ] **Step 7: Gravar a política no service**

Em `apps/backend/src/services/template.service.ts`, no `criar`, adicionar o campo ao `data` do `templateLotacao.create`:

```ts
data: { lotacao_id, nome: input.nome, politica_localidade: input.politica_localidade, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
```

E no `atualizar`, no `data` do `templateLotacao.update`:

```ts
data: { nome: input.nome, politica_localidade: input.politica_localidade, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd apps/backend && npm test -- layout-politica`
Expected: PASS (3 testes).

- [ ] **Step 9: Suíte + typecheck + lint + commit**

```bash
cd apps/backend && npm test && npm run typecheck && npm run lint
cd ../web && npm run typecheck
cd ../.. && git add packages/shared-types/src/template.ts packages/shared-schemas/src/template.schemas.ts apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/services/template.service.ts apps/backend/src/tests/integration/layout-politica.test.ts
git commit -m "✨ feat(layout): política de localidade (rodizia/fixa/indiferente) + migration 0012"
```

---

### Task 2: Política no núcleo puro do motor

**Files:**
- Modify: `apps/backend/src/utils/preenchimento.ts`
- Test: `apps/backend/src/utils/preenchimento.test.ts`

**Interfaces:**
- Consumes: `PoliticaLocalidade` (Task 1); `normalizeFuncao` de `utils/funcao.js`.
- Produces: `VagaAberta.guarnicao_atividade: string`; `PlanoInput.contagemLocalInicial: Map<number, Map<string, number>>`; `PlanoInput.politicaLocalidade: PoliticaLocalidade`.

- [ ] **Step 1: Atualizar os helpers do teste**

Em `apps/backend/src/utils/preenchimento.test.ts`, substituir `base` e `vaga`:

```ts
function base(over: Partial<PlanoInput> = {}): PlanoInput {
  return {
    descanso_horas: 72,
    militares: [
      { id: 1, nome: 'A', patente_id: 17 },
      { id: 2, nome: 'B', patente_id: 12 },
    ],
    contagemInicial: new Map(),
    contagemLocalInicial: new Map(),
    politicaLocalidade: 'indiferente',
    intervalosExistentes: [],
    vagas: [],
    esperadasPorFuncao: new Map(),
    ...over,
  };
}
const vaga = (vaga_id: number, data: string, funcao = 'OP', atividade = 'INCENDIO') =>
  ({ vaga_id, data, guarnicao_sigla: 'INC', guarnicao_atividade: atividade, guarnicao_ordem: 0, funcao, ...T24 });
```

- [ ] **Step 2: Escrever os testes que falham**

No mesmo arquivo, dentro do `describe('planejarPreenchimento', …)`, acrescentar:

```ts
it('indiferente: a localidade não influencia e o motivo é o do 2c (regressão)', () => {
  const out = planejarPreenchimento(base({
    contagemInicial: new Map([[1, 5]]),
    contagemLocalInicial: new Map([[2, new Map([['INCENDIO', 99]])]]),
    vagas: [vaga(10, '2026-08-01')],
  }));
  expect(out[0]!.militar_id).toBe(2);
  expect(out[0]!.motivo).toBe('menos serviços (0) · descansado · patente ok');
});

it('rodizia: com o mesmo total, vence quem tirou menos serviços naquela localidade', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'rodizia',
    contagemInicial: new Map([[1, 3], [2, 3]]),
    contagemLocalInicial: new Map([
      [1, new Map([['PONTA NEGRA', 3]])],
      [2, new Map([['MIAMI', 3]])],
    ]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra')],
  }));
  expect(out[0]!.militar_id).toBe(2);
  expect(out[0]!.motivo).toContain('menos serviços em Ponta Negra (0)');
});

it('rodizia: com a mesma contagem local, o total desempata', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'rodizia',
    contagemInicial: new Map([[1, 9], [2, 2]]),
    contagemLocalInicial: new Map([
      [1, new Map([['PONTA NEGRA', 1]])],
      [2, new Map([['PONTA NEGRA', 1]])],
    ]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra')],
  }));
  expect(out[0]!.militar_id).toBe(2);
});

it('rodizia: espalha as localidades dentro da mesma rodada', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'rodizia',
    descanso_horas: 0,
    contagemInicial: new Map([[2, 5]]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra'), vaga(11, '2026-08-05', 'OP', 'Ponta Negra')],
  }));
  // 1ª vaga: ninguém serviu em Ponta Negra → decide o total → militar 1.
  // 2ª vaga: militar 1 já tem 1 em Ponta Negra → vai o militar 2, apesar do total maior.
  expect(out[0]!.militar_id).toBe(1);
  expect(out[1]!.militar_id).toBe(2);
});

it('fixa: quem já serviu na guarnição vence quem nunca serviu, mesmo com mais serviços no total', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'fixa',
    contagemInicial: new Map([[1, 12]]),
    contagemLocalInicial: new Map([[1, new Map([['INCENDIO', 12]])]]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
  }));
  expect(out[0]!.militar_id).toBe(1);
  expect(out[0]!.motivo).toContain('é do INCENDIO');
});

it('fixa: entre dois que pertencem à guarnição, vence o de menor total (o sinal é binário, não placar)', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'fixa',
    contagemInicial: new Map([[1, 20], [2, 4]]),
    contagemLocalInicial: new Map([
      [1, new Map([['INCENDIO', 20]])],
      [2, new Map([['INCENDIO', 4]])],
    ]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
  }));
  expect(out[0]!.militar_id).toBe(2);
});

it('fixa: sem ninguém com histórico na guarnição, o ranqueio cai no total', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'fixa',
    contagemInicial: new Map([[1, 7]]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
  }));
  expect(out[0]!.militar_id).toBe(2);
  expect(out[0]!.motivo).toContain('sem histórico em INCENDIO');
});

it('conflito de turno continua hard sob fixa', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'fixa',
    contagemLocalInicial: new Map([[1, new Map([['INCENDIO', 10]])]]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO'), vaga(11, '2026-08-01', 'OP', 'INCENDIO')],
  }));
  expect(new Set(out.map((r) => r.militar_id)).size).toBe(2);
});

it('localidade é normalizada (acento, caixa e espaços não criam contagens separadas)', () => {
  const out = planejarPreenchimento(base({
    politicaLocalidade: 'rodizia',
    contagemInicial: new Map([[2, 5]]),
    contagemLocalInicial: new Map([[1, new Map([['PRAIA DO MEIO', 2]])]]),
    vagas: [vaga(10, '2026-08-01', 'OP', 'Praia  do  Meio')],
  }));
  expect(out[0]!.militar_id).toBe(2); // militar 1 já tem 2 na mesma praia, apesar do total menor
});

it('determinismo: a mesma entrada produz a mesma saída', () => {
  const entrada = () => base({
    politicaLocalidade: 'rodizia',
    vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra'), vaga(11, '2026-08-02', 'OP', 'Miami')],
  });
  expect(planejarPreenchimento(entrada())).toEqual(planejarPreenchimento(entrada()));
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd apps/backend && npm test -- preenchimento.test`
Expected: FAIL — typecheck quebra em `contagemLocalInicial`, `politicaLocalidade` e `guarnicao_atividade` (não existem em `PlanoInput`/`VagaAberta`).

- [ ] **Step 4: Estender os tipos do núcleo**

Em `apps/backend/src/utils/preenchimento.ts`, trocar o topo do arquivo (linhas 1-13) por:

```ts
import type { PoliticaLocalidade } from '@escalas/shared-types';
import { parseHHmm } from './turnos.js';
import { normalizeFuncao } from './funcao.js';

export interface MilitarPool { id: number; nome: string; patente_id: number | null }
export interface VagaAberta { vaga_id: number; data: string; guarnicao_sigla: string; guarnicao_atividade: string; guarnicao_ordem: number; funcao: string; turno_inicio: string; turno_fim: string }
export interface IntervaloExistente { militar_id: number; data: string; turno_inicio: string; turno_fim: string }
export interface PlanoInput {
  descanso_horas: number;
  militares: MilitarPool[];
  contagemInicial: Map<number, number>;
  contagemLocalInicial: Map<number, Map<string, number>>; // militar → localidade normalizada → contagem
  politicaLocalidade: PoliticaLocalidade;
  intervalosExistentes: IntervaloExistente[];
  vagas: VagaAberta[];
  esperadasPorFuncao: Map<string, number[]>; // funcao (como vem na vaga) → patentes esperadas ([] = sem regra)
}
```

- [ ] **Step 5: Cópia local da contagem por localidade e o comparador**

Ainda em `preenchimento.ts`, logo após `const contagem = new Map(input.contagemInicial);`:

```ts
  // cópia profunda: o núcleo não muta a entrada (mesma disciplina de `contagem`).
  const contagemLocal = new Map<number, Map<string, number>>();
  for (const [mid, mapa] of input.contagemLocalInicial) contagemLocal.set(mid, new Map(mapa));
```

E antes do `const out: ResultadoVaga[] = [];`:

```ts
  type Cand = { id: number; conflito: boolean; violaDescanso: boolean; patenteOk: boolean; contagem: number; contagemLocal: number };
  const porLocalidade = (a: Cand, b: Cand) => {
    if (input.politicaLocalidade === 'rodizia') return a.contagemLocal - b.contagemLocal;
    if (input.politicaLocalidade === 'fixa') return Number(b.contagemLocal > 0) - Number(a.contagemLocal > 0);
    return 0;
  };
```

Remover o `type Cand = …` que hoje está declarado dentro do laço (linha 54) — ele passa a viver fora, junto do comparador.

- [ ] **Step 6: Usar a localidade no laço**

Em `preenchimento.ts`, dentro do `for (const v of vagasOrdenadas)`, logo após `const esperadas = …`:

```ts
    const localKey = normalizeFuncao(v.guarnicao_atividade);
```

No `map` que monta os candidatos, acrescentar o campo ao objeto retornado:

```ts
      return { id: m.id, conflito, violaDescanso, patenteOk, contagem: contagem.get(m.id) ?? 0, contagemLocal: contagemLocal.get(m.id)?.get(localKey) ?? 0 };
```

E incluir o critério no `sort`, entre patente e contagem total:

```ts
    cands.sort((a, b) =>
      Number(a.violaDescanso) - Number(b.violaDescanso) ||
      Number(b.patenteOk) - Number(a.patenteOk) ||
      porLocalidade(a, b) ||
      a.contagem - b.contagem ||
      a.id - b.id);
```

- [ ] **Step 7: Contagem incremental e motivo**

Ainda no laço, logo após `contagem.set(esc.id, (contagem.get(esc.id) ?? 0) + 1);`:

```ts
    const mapaLocal = contagemLocal.get(esc.id) ?? new Map<string, number>();
    mapaLocal.set(localKey, (mapaLocal.get(localKey) ?? 0) + 1);
    contagemLocal.set(esc.id, mapaLocal);
```

E substituir a linha do `const partes = …` por:

```ts
    const partes: string[] = [];
    if (input.politicaLocalidade === 'rodizia') partes.push(`menos serviços em ${v.guarnicao_atividade} (${esc.contagemLocal})`);
    if (input.politicaLocalidade === 'fixa') partes.push(esc.contagemLocal > 0 ? `é do ${v.guarnicao_atividade}` : `sem histórico em ${v.guarnicao_atividade}`);
    partes.push(`menos serviços (${esc.contagem})`, esc.violaDescanso ? 'sem descanso pleno' : 'descansado', esc.patenteOk ? 'patente ok' : 'patente divergente');
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd apps/backend && npm test -- preenchimento.test`
Expected: PASS — os testes novos e **todos os antigos** (que rodam sob `indiferente`).

- [ ] **Step 9: Commit**

```bash
cd apps/backend && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/utils/preenchimento.ts apps/backend/src/utils/preenchimento.test.ts
git commit -m "✨ feat(preenchimento): política de localidade no núcleo (rodizia/fixa, indiferente inalterado)"
```

---

### Task 3: Serviço lê a política e conta por localidade

**Files:**
- Modify: `apps/backend/src/services/preenchimento.service.ts:31-117` (`montarPlano`)
- Test: `apps/backend/src/tests/integration/preenchimento.routes.test.ts`

**Interfaces:**
- Consumes: `PlanoInput.contagemLocalInicial` e `PlanoInput.politicaLocalidade` (Task 2); `TemplateLotacao.politica_localidade` (Task 1).
- Produces: nada novo para fora — `sugerir`/`aplicar` mantêm assinatura e contrato.

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/backend/src/tests/integration/preenchimento.routes.test.ts`, no fim do `describe`, acrescentar:

```ts
it('fixa: lê a política do layout e prefere quem já serviu na guarnição', async () => {
  const { token, tmpl, escalaId, militares } = await cenario(933);
  await testPrisma.templateLotacao.update({
    where: { id: tmpl.id }, data: { politica_localidade: 'fixa' },
  });

  // militar 3 já serviu 'incendio' no dia 01 → passa a pertencer à guarnição.
  const vagas = await vagasDoIntervalo(escalaId);
  const dia1 = vagas.find((v) => v.guarnicao.dia.data.toISOString().slice(0, 10) === '2026-04-01')!;
  await testPrisma.vaga.update({ where: { id: dia1.id }, data: { militar_id: militares[2]!.id } });

  const r = await request(buildApp())
    .post(`/api/v1/escalas/${escalaId}/sugerir-preenchimento`)
    .set('authorization', `Bearer ${token}`)
    .send({ data_ini: '2026-04-01', data_fim: '2026-04-02', descanso_horas: 0 });

  expect(r.status).toBe(200);
  const dia2 = r.body.data.find((s: { data: string }) => s.data === '2026-04-02');
  expect(dia2.militar_id).toBe(militares[2]!.id);
  expect(dia2.motivo).toContain('é do incendio');
});

it('indiferente (default): o mesmo cenário escolhe pelo total, não pela guarnição', async () => {
  const { token, escalaId, militares } = await cenario(934);

  const vagas = await vagasDoIntervalo(escalaId);
  const dia1 = vagas.find((v) => v.guarnicao.dia.data.toISOString().slice(0, 10) === '2026-04-01')!;
  await testPrisma.vaga.update({ where: { id: dia1.id }, data: { militar_id: militares[2]!.id } });

  const r = await request(buildApp())
    .post(`/api/v1/escalas/${escalaId}/sugerir-preenchimento`)
    .set('authorization', `Bearer ${token}`)
    .send({ data_ini: '2026-04-01', data_fim: '2026-04-02', descanso_horas: 0 });

  expect(r.status).toBe(200);
  const dia2 = r.body.data.find((s: { data: string }) => s.data === '2026-04-02');
  expect(dia2.militar_id).not.toBe(militares[2]!.id); // militar 3 tem 1 serviço; os outros têm 0
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/backend && npm test -- preenchimento.routes`
Expected: FAIL — o teste `fixa` escolhe outro militar (a política ainda não é lida) e o typecheck de `montarPlano` quebra por faltarem os dois campos novos em `PlanoInput`.

- [ ] **Step 3: Ler a política do layout**

Em `apps/backend/src/services/preenchimento.service.ts`, dentro de `montarPlano`, logo após o `const militares = …`:

```ts
  // política de localidade vem do layout da escala; escala sem layout ⇒ indiferente.
  const template = escala.template_id == null
    ? null
    : await prisma.templateLotacao.findUnique({
        where: { id: escala.template_id },
        select: { politica_localidade: true },
      });
  const politicaLocalidade = template?.politica_localidade ?? 'indiferente';
```

- [ ] **Step 4: Trazer a atividade nas duas consultas de contagem**

No mesmo arquivo, trocar os dois `select: { militar_id: true },` (linhas 50 e 65) por:

```ts
      select: { militar_id: true, guarnicao: { select: { atividade: true } } },
```

- [ ] **Step 5: Montar a contagem por localidade**

Substituir o bloco que monta `contagemInicial` por:

```ts
  const contagemInicial = new Map<number, number>();
  const contagemLocalInicial = new Map<number, Map<string, number>>();
  for (const v of [...vagasNestaEscala, ...vagasAnteriores]) {
    if (v.militar_id == null) continue;
    contagemInicial.set(v.militar_id, (contagemInicial.get(v.militar_id) ?? 0) + 1);
    const key = normalizeFuncao(v.guarnicao.atividade);
    const mapa = contagemLocalInicial.get(v.militar_id) ?? new Map<string, number>();
    mapa.set(key, (mapa.get(key) ?? 0) + 1);
    contagemLocalInicial.set(v.militar_id, mapa);
  }
```

- [ ] **Step 6: Passar a atividade da vaga e devolver os campos novos**

No `map` que monta `vagas`, acrescentar após `guarnicao_sigla`:

```ts
    guarnicao_atividade: v.guarnicao.atividade,
```

E trocar o `return` final de `montarPlano` por:

```ts
  return { descanso_horas, militares, contagemInicial, contagemLocalInicial, politicaLocalidade, intervalosExistentes, vagas, esperadasPorFuncao };
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd apps/backend && npm test -- preenchimento.routes`
Expected: PASS — inclusive os testes de integração que já existiam.

- [ ] **Step 8: Suíte + typecheck + lint + commit**

```bash
cd apps/backend && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/services/preenchimento.service.ts apps/backend/src/tests/integration/preenchimento.routes.test.ts
git commit -m "✨ feat(preenchimento): serviço lê a política do layout e conta serviços por localidade"
```

---

### Task 4: Seletor de política no editor de layout (web)

**Files:**
- Modify: `apps/web/src/features/layouts/useLayoutDraft.ts`
- Modify: `apps/web/src/features/layouts/LayoutEditor.tsx:14-19`
- Modify: `apps/web/src/routes/_app/layouts/index.tsx:61`
- Test: `apps/web/src/features/layouts/LayoutEditor.test.tsx`

**Interfaces:**
- Consumes: `criarLayoutSchema` com `politica_localidade` e `TemplateLotacaoDTO.politica_localidade` (Task 1).

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/web/src/features/layouts/LayoutEditor.test.tsx`, acrescentar ao fim do arquivo. O `Harness` que já existe não expõe o rascunho, então este teste usa um espelho próprio; `mockPatentes`, `renderWithProviders`, `screen` e `fireEvent` já estão importados no arquivo e devem ser reaproveitados como estão:

```tsx
function HarnessComEspelho() {
  const draft = useLayoutDraft();
  return (
    <>
      <LayoutEditor draft={draft} onSalvar={() => {}} salvando={false} />
      <span data-testid="politica">{draft.values.politica_localidade}</span>
    </>
  );
}

it('permite escolher a política de localidade e reflete no rascunho', () => {
  mockPatentes();
  renderWithProviders(<HarnessComEspelho />);
  expect(screen.getByTestId('politica')).toHaveTextContent('indiferente');
  fireEvent.click(screen.getByRole('radio', { name: 'Rodiziar' }));
  expect(screen.getByTestId('politica')).toHaveTextContent('rodizia');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && npm test -- LayoutEditor`
Expected: FAIL — não existe radio "Rodiziar" e `politica_localidade` é `undefined` no rascunho.

- [ ] **Step 3: Campo no rascunho**

Em `apps/web/src/features/layouts/useLayoutDraft.ts`, trocar a linha do `useForm` por:

```ts
  const form = useForm<CriarLayoutInput>({ initialValues: inicial ?? { nome: '', politica_localidade: 'indiferente', guarnicoes: [novaGuarnicao(0)] } });
```

- [ ] **Step 4: Seletor no editor**

Em `apps/web/src/features/layouts/LayoutEditor.tsx`, acrescentar `SegmentedControl` e `Text` ao import do `@mantine/core`, e logo abaixo do `TextInput` do nome (linha 17):

```tsx
      <Stack gap={4}>
        <SegmentedControl
          w={420}
          data={[
            { value: 'indiferente', label: 'Indiferente' },
            { value: 'rodizia', label: 'Rodiziar' },
            { value: 'fixa', label: 'Fixar' },
          ]}
          {...draft.getInputProps('politica_localidade')}
        />
        <Text size="xs" c="dimmed">
          {draft.values.politica_localidade === 'rodizia'
            ? 'O preenchimento automático gira o militar entre as guarnições — usar nas praias do GBSA.'
            : draft.values.politica_localidade === 'fixa'
              ? 'O militar permanece na guarnição dele (incêndio, resgate). Militar sem histórico precisa de uma primeira escalação manual.'
              : 'A guarnição não influencia a escolha do preenchimento automático.'}
        </Text>
      </Stack>
```

- [ ] **Step 5: Semear a política ao editar layout existente**

Em `apps/web/src/routes/_app/layouts/index.tsx`, no objeto `inicial` (linha 61), acrescentar após `nome: existente.nome,`:

```ts
        politica_localidade: existente.politica_localidade,
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `cd apps/web && npm test -- LayoutEditor`
Expected: PASS.

- [ ] **Step 7: Suíte + typecheck + lint + commit**

```bash
cd apps/web && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/features/layouts/useLayoutDraft.ts apps/web/src/features/layouts/LayoutEditor.tsx apps/web/src/features/layouts/LayoutEditor.test.tsx "apps/web/src/routes/_app/layouts/index.tsx"
git commit -m "✨ feat(web): seletor de política de localidade no editor de layout"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** modelo/migration + CRUD (T1) · núcleo com os três estados, contagem incremental e motivo (T2) · serviço lendo a política e contando por localidade (T3) · seletor no editor de layout (T4). Contrato do motor inalterado, como o spec exige. ✔
- **Sem placeholders:** todo passo traz o código exato ou o comando exato, com a saída esperada. ✔
- **Consistência de tipos:** `PoliticaLocalidade` (T1) é o mesmo tipo importado pelo núcleo (T2) e produzido pelo serviço (T3); `contagemLocalInicial: Map<number, Map<string, number>>` idêntico entre `PlanoInput` (T2), o teste (T2) e `montarPlano` (T3); `guarnicao_atividade` idêntico entre `VagaAberta` (T2) e o `map` de vagas (T3); a chave é sempre `normalizeFuncao(atividade)` nos dois lados. ✔
- **Riscos de execução:**
  (a) o Step 6 da T1 exige banco de dev de pé (`prisma migrate dev`);
  (b) o teste de regressão `indiferente` da T2 é o **primeiro** a travar a string de `motivo` (nenhum teste do 2c a assertava) — de agora em diante ela é contrato;
  (c) o teste `fixa` da T3 depende de `descanso_horas: 0` no corpo — sem isso o descanso (critério anterior) derruba o militar do dia 01 e o teste mede a coisa errada.

## Validação final (controlador, pós-T4)

Backend dev :3000 + web. No layout "Padrão (mapa de força)" do GBSA, marcar **Rodiziar** e salvar; num layout de SGB, marcar **Fixar**. Criar escala rascunho do mês, carimbar a estrutura e rodar o **Preenchimento automático** com `descanso_horas = 48` (GBSA) e `72` (quartel). Conferir no preview: no GBSA o mesmo militar não repete a praia entre as voltas do ciclo e o motivo cita a praia; no quartel os militares permanecem na guarnição de origem e o motivo diz "é do …". Num layout sem política marcada, conferir que o motivo continua exatamente `menos serviços (N) · descansado · patente ok`.
