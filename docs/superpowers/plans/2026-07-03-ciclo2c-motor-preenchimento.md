# Ciclo 2c — Motor de Preenchimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor que auto-sugere quem preenche cada vaga aberta de uma escala, equilibrando equidade (contagem de serviços local) + descanso (janela pós-turno), com elegibilidade soft por patente e sem conflito de turno. Fluxo preview → aplicar (só vagas abertas, rascunho-only).

**Architecture:** Núcleo puro determinístico (`utils/preenchimento.ts`) + serviço (`preenchimento.service.ts`) que injeta os dados (pool, equidade, intervalos, esperadas) + 2 endpoints + UI de preview/aplicar. Reusa `turnos.ts`, `resumoServico.service`, `patenteService.esperadasPara`, `adminService.listarUsuarios`, e o padrão de escrita rascunho-only+tx+audit do `geracaoBloco.service`.

**Tech Stack:** Node 20 + TS ESM, Express, Prisma + PostgreSQL, Zod, Vitest; React 18 + Vite + TanStack + Mantine 7.

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-03-ciclo2c-motor-preenchimento-design.md`.
- **Aviso é SEMPRE soft** (patente/descanso nunca bloqueiam); só **conflito de turno no dia é barreira dura**.
- **Só vaga aberta** (`militar_id null`); nunca sobrescreve manual; **rascunho-only** (409 senão); intervalo no mês (422 senão).
- **Determinístico:** sem `Date.now`/random no núcleo; desempate por `militar_id`.
- **Equidade = contagem local:** escala atual + escalas `publicada`/`aprovada` anteriores da mesma lotação.
- ESM `.js`; 2 espaços; resposta `{success,message,data}`; rotas `/api/v1/`. Repo `escalas`: `main`, commit direto; push só sob ordem.
- Ao fim de cada task: `npm run typecheck`, `npm run lint`, `npm test` no app tocado (backend E web quando mexer em `packages/*`).

---

### Task 1: DTO + schema (shared)

**Files:**
- Create: `packages/shared-types/src/preenchimento.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-schemas/src/preenchimento.schemas.ts`
- Modify: `packages/shared-schemas/src/index.ts`

**Interfaces:**
- Produces: `PreenchimentoSugestaoDTO`; `preenchimentoInputSchema` / `PreenchimentoInput`.

- [ ] **Step 1: DTO**

`packages/shared-types/src/preenchimento.ts`:
```ts
export interface PreenchimentoSugestaoDTO {
  vaga_id: number;
  data: string; // YYYY-MM-DD
  guarnicao_sigla: string;
  funcao: string;
  militar_id: number | null;
  militar_nome: string | null;
  motivo: string;
  aviso_patente: boolean;
  aviso_descanso: boolean;
}
```
Em `packages/shared-types/src/index.ts` adicionar `export * from './preenchimento.js';`.

- [ ] **Step 2: Schema**

`packages/shared-schemas/src/preenchimento.schemas.ts`:
```ts
import { z } from 'zod';
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data YYYY-MM-DD');
export const preenchimentoInputSchema = z.object({
  data_ini: dataISO,
  data_fim: dataISO,
  descanso_horas: z.number().int().min(0).max(336).optional(),
});
export type PreenchimentoInput = z.infer<typeof preenchimentoInputSchema>;
```
Em `packages/shared-schemas/src/index.ts` adicionar `export * from './preenchimento.schemas.js';`.

- [ ] **Step 3: build/typecheck + commit**
```bash
cd apps/backend && npm run typecheck && cd ../web && npm run typecheck
cd ../.. && git add packages/shared-types/src/preenchimento.ts packages/shared-types/src/index.ts packages/shared-schemas/src/preenchimento.schemas.ts packages/shared-schemas/src/index.ts
git commit -m "✨ feat(shared): DTO e schema do motor de preenchimento (2c)"
```

---

### Task 2: Núcleo puro `planejarPreenchimento` + testes

**Files:**
- Create: `apps/backend/src/utils/preenchimento.ts`
- Create: `apps/backend/src/utils/preenchimento.test.ts`

**Interfaces:**
- Consumes: `parseHHmm` de `./turnos.js`.
- Produces: `planejarPreenchimento(input: PlanoInput): ResultadoVaga[]` e os tipos abaixo.

- [ ] **Step 1: Escrever os testes (falham)**

`apps/backend/src/utils/preenchimento.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planejarPreenchimento, type PlanoInput } from './preenchimento.js';

const T24 = { turno_inicio: '08:00', turno_fim: '08:00' }; // 24h
function base(over: Partial<PlanoInput> = {}): PlanoInput {
  return {
    descanso_horas: 72,
    militares: [
      { id: 1, nome: 'A', patente_id: 17 },
      { id: 2, nome: 'B', patente_id: 12 },
    ],
    contagemInicial: new Map(),
    intervalosExistentes: [],
    vagas: [],
    esperadasPorFuncao: new Map(),
    ...over,
  };
}
const vaga = (vaga_id: number, data: string, funcao = 'OP') => ({ vaga_id, data, guarnicao_sigla: 'INC', guarnicao_ordem: 0, funcao, ...T24 });

describe('planejarPreenchimento', () => {
  it('equidade: quem tem menos serviços é escolhido primeiro', () => {
    const out = planejarPreenchimento(base({ contagemInicial: new Map([[1, 5]]), vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(2); // A tem 5, B tem 0
    expect(out[0]!.aviso_descanso).toBe(false);
  });

  it('conflito de turno no mesmo dia nunca ocorre (hard): a 2ª vaga do dia vai p/ o outro militar', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-01')] }));
    const ids = out.map((r) => r.militar_id);
    expect(new Set(ids).size).toBe(2); // dois militares distintos no mesmo dia/turno 24h
  });

  it('descanso: com 1 militar só, a 2ª vaga em 72h é preenchida com aviso_descanso', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-02')], // 08→08 no dia seguinte: começa logo após o fim
    }));
    expect(out[1]!.militar_id).toBe(1);
    expect(out[1]!.aviso_descanso).toBe(true);
  });

  it('patente: prioriza compatível, mas não bloqueia divergente', () => {
    const out = planejarPreenchimento(base({
      esperadasPorFuncao: new Map([['OP', [12]]]), // espera patente 12 → militar B
      vagas: [vaga(10, '2026-08-01', 'OP')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.aviso_patente).toBe(false);
  });

  it('vaga sem candidato sem conflito → militar_id null', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      intervalosExistentes: [{ militar_id: 1, data: '2026-08-01', ...T24 }], // A já ocupado 24h nesse dia
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBeNull();
  });

  it('determinístico: empate total de equidade → menor militar_id', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar — falha**

```bash
cd apps/backend && npm test -- preenchimento
```
Esperado: FAIL.

- [ ] **Step 3: Implementar o núcleo puro**

`apps/backend/src/utils/preenchimento.ts`:
```ts
import { parseHHmm } from './turnos.js';

export interface MilitarPool { id: number; nome: string; patente_id: number | null }
export interface VagaAberta { vaga_id: number; data: string; guarnicao_sigla: string; guarnicao_ordem: number; funcao: string; turno_inicio: string; turno_fim: string }
export interface IntervaloExistente { militar_id: number; data: string; turno_inicio: string; turno_fim: string }
export interface PlanoInput {
  descanso_horas: number;
  militares: MilitarPool[];
  contagemInicial: Map<number, number>;
  intervalosExistentes: IntervaloExistente[];
  vagas: VagaAberta[];
  esperadasPorFuncao: Map<string, number[]>; // funcao (como vem na vaga) → patentes esperadas ([] = sem regra)
}
export interface ResultadoVaga {
  vaga_id: number; data: string; guarnicao_sigla: string; funcao: string;
  militar_id: number | null; militar_nome: string | null;
  motivo: string; aviso_patente: boolean; aviso_descanso: boolean;
}

// dias desde a época UTC → minutos absolutos; convenção 24h (fim ≤ início ⇒ dia seguinte).
function intervaloAbs(data: string, inicio: string, fim: string): [number, number] {
  const diaMin = Math.floor(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)) / 60000);
  const ini = diaMin + parseHHmm(inicio);
  let f = diaMin + parseHHmm(fim);
  if (parseHHmm(fim) <= parseHHmm(inicio)) f += 1440;
  return [ini, f];
}
const overlap = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && s2 < e1;

export function planejarPreenchimento(input: PlanoInput): ResultadoVaga[] {
  const { descanso_horas } = input;
  const descMin = descanso_horas * 60;
  const contagem = new Map(input.contagemInicial);
  // intervalos por militar (pré-existentes + atribuídos na rodada)
  const porMilitar = new Map<number, [number, number][]>();
  for (const m of input.militares) porMilitar.set(m.id, []);
  for (const ie of input.intervalosExistentes) {
    if (!porMilitar.has(ie.militar_id)) porMilitar.set(ie.militar_id, []);
    porMilitar.get(ie.militar_id)!.push(intervaloAbs(ie.data, ie.turno_inicio, ie.turno_fim));
  }
  const nomeDe = new Map(input.militares.map((m) => [m.id, m.nome] as const));
  const patenteDe = new Map(input.militares.map((m) => [m.id, m.patente_id] as const));

  const vagasOrdenadas = [...input.vagas].sort((a, b) =>
    a.data.localeCompare(b.data) || a.guarnicao_ordem - b.guarnicao_ordem || a.vaga_id - b.vaga_id);

  const out: ResultadoVaga[] = [];
  for (const v of vagasOrdenadas) {
    const [vs, ve] = intervaloAbs(v.data, v.turno_inicio, v.turno_fim);
    const esperadas = input.esperadasPorFuncao.get(v.funcao) ?? [];
    type Cand = { id: number; conflito: boolean; violaDescanso: boolean; patenteOk: boolean; contagem: number };
    const cands: Cand[] = input.militares.map((m) => {
      const ints = porMilitar.get(m.id) ?? [];
      const conflito = ints.some(([s, e]) => overlap(vs, ve, s, e));
      const violaDescanso = ints.some(([s, e]) => !overlap(vs, ve, s, e) && (
        (e <= vs && vs - e < descMin) || (ve <= s && s - ve < descMin)));
      const pid = patenteDe.get(m.id) ?? null;
      const patenteOk = esperadas.length === 0 || (pid != null && esperadas.includes(pid));
      return { id: m.id, conflito, violaDescanso, patenteOk, contagem: contagem.get(m.id) ?? 0 };
    }).filter((c) => !c.conflito);

    if (cands.length === 0) {
      out.push({ vaga_id: v.vaga_id, data: v.data, guarnicao_sigla: v.guarnicao_sigla, funcao: v.funcao, militar_id: null, militar_nome: null, motivo: 'sem candidato sem conflito de turno', aviso_patente: false, aviso_descanso: false });
      continue;
    }
    cands.sort((a, b) =>
      Number(a.violaDescanso) - Number(b.violaDescanso) ||
      Number(b.patenteOk) - Number(a.patenteOk) ||
      a.contagem - b.contagem ||
      a.id - b.id);
    const esc = cands[0]!;
    porMilitar.get(esc.id)!.push([vs, ve]);
    contagem.set(esc.id, (contagem.get(esc.id) ?? 0) + 1);
    const partes = [`menos serviços (${esc.contagem})`, esc.violaDescanso ? 'sem descanso pleno' : 'descansado', esc.patenteOk ? 'patente ok' : 'patente divergente'];
    out.push({
      vaga_id: v.vaga_id, data: v.data, guarnicao_sigla: v.guarnicao_sigla, funcao: v.funcao,
      militar_id: esc.id, militar_nome: nomeDe.get(esc.id) ?? null,
      motivo: partes.join(' · '), aviso_patente: !esc.patenteOk, aviso_descanso: esc.violaDescanso,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar — passa + typecheck + lint + commit**
```bash
cd apps/backend && npm test -- preenchimento && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/utils/preenchimento.ts apps/backend/src/utils/preenchimento.test.ts
git commit -m "✨ feat(preenchimento): núcleo puro do motor (greedy equidade+descanso, determinístico)"
```

---

### Task 3: Serviço `sugerir`/`aplicar` + endpoints

**Files:**
- Create: `apps/backend/src/services/preenchimento.service.ts`
- Modify: `apps/backend/src/controllers/escala.controller.ts`
- Modify: `apps/backend/src/routes/escala.routes.ts`
- Test: `apps/backend/src/tests/integration/preenchimento.routes.test.ts`

**Interfaces:**
- Consumes: `planejarPreenchimento` (T2); `PreenchimentoSugestaoDTO`/`preenchimentoInputSchema` (T1); `adminService.listarUsuarios`, `patenteService.esperadasPara`, `auditService`, `diasNoIntervalo`/`validarIntervaloNoMes` (padrões de `geracaoBloco.service`).
- Produces: `preenchimentoService.sugerir(...)`/`aplicar(...)`; `POST /escalas/:id/sugerir-preenchimento` e `/aplicar-preenchimento`.

- [ ] **Step 1: Serviço**

`apps/backend/src/services/preenchimento.service.ts` — implementar `sugerir` e `aplicar`:
- Guard rascunho (senão `ConflictError` 409) + intervalo dentro do mês (`HttpError(422)`), espelhando `geracaoBloco.escalaRascunho`/`validarIntervaloNoMes` (importar/replicar o mesmo padrão).
- **pool:** `adminService.listarUsuarios({ lotacao_id })` → `MilitarPool[]` (`id`, `nome`, `patente_id`).
- **contagemInicial:** somar, por militar, as vagas com `militar_id` preenchidas: (a) nesta escala + (b) nas escalas da mesma lotação com `status ∈ {publicada, aprovada}` e `(ano<escala.ano) OU (ano=escala.ano E mes<escala.mes)`. Query em `prisma.vaga` com `where: { militar_id: { not: null }, guarnicao: { dia: { escala: { lotacao_id, ... } } } }`, agrupando em JS.
- **intervalosExistentes:** vagas preenchidas nos `EscalaDia` do intervalo desta escala (militar_id, data do dia, turno_inicio/fim da vaga).
- **vagas (abertas):** vagas `militar_id null` nos dias do intervalo, com `guarnicao_sigla`, `guarnicao.ordem`, `funcao`, `turno_inicio/fim`, e o `data` do dia (YYYY-MM-DD, UTC slice).
- **esperadasPorFuncao:** para cada `funcao` distinta das vagas, `await patenteService.esperadasPara(funcao, escala.lotacao_id, escala.template_id, prisma)`, memoizado por `funcao_norm` (usar `normalizeFuncao`). Chave do Map = a `funcao` como aparece na vaga (o núcleo compara por igualdade da string da vaga; garantir que a mesma string é usada como chave e no lookup).
- `sugerir` retorna `planejarPreenchimento(...)` mapeado para `PreenchimentoSugestaoDTO[]` (o núcleo já devolve os campos do DTO).
- `aplicar`: recomputa o plano; numa `$transaction`, para cada resultado com `militar_id != null`, **relê a vaga** e só grava se ainda `militar_id null` (`updateMany where id, militar_id null`); soma `vagas_preenchidas`, `avisos_patente`, `avisos_descanso`; `auditService.log({ acao: 'preencher_auto', entidade: 'Escala', entidade_id, depois: { data_ini, data_fim, descanso_horas, vagas_preenchidas } })`.

- [ ] **Step 2: Controller + rotas**

Em `escala.controller.ts`, 2 handlers (`sugerirPreenchimento`, `aplicarPreenchimento`) no padrão dos existentes (`ok(res, msg, data)` / `handle(res,next,e)`), lendo `req.body.data_ini/data_fim/descanso_horas` e `req.params.id`, `req.user!.id`. Em `escala.routes.ts`, após `repetir-ciclo`:
```ts
escalaRoutes.post('/:id/sugerir-preenchimento', requireEscalaAccess(['ESCALANTE']), validate(preenchimentoInputSchema), escalaController.sugerirPreenchimento);
escalaRoutes.post('/:id/aplicar-preenchimento', requireEscalaAccess(['ESCALANTE']), validate(preenchimentoInputSchema), escalaController.aplicarPreenchimento);
```
(importar `preenchimentoInputSchema` de `@escalas/shared-schemas` e `preenchimentoService`.)

- [ ] **Step 3: Teste de integração**

`apps/backend/src/tests/integration/preenchimento.routes.test.ts` no padrão de `avisosPatente.routes.test.ts`/`escala.routes.test.ts`: lotação + escala rascunho 08/2026 com 2 dias de estrutura carimbada (vagas abertas); 3 militares da lotação (patentes variadas). Casos:
1. `POST /sugerir-preenchimento` (ESCALANTE) → 200, cada vaga aberta recebe `militar_id`, sem conflito de turno no mesmo dia, e **não grava** (as vagas seguem abertas depois).
2. `POST /aplicar-preenchimento` → 200 `vagas_preenchidas > 0`; reler os dias mostra as vagas agora preenchidas; re-aplicar não sobrescreve manual.
3. escala publicada → 409; intervalo fora do mês → 422.
Rodar: `cd apps/backend && npm test -- preenchimento.routes`.

- [ ] **Step 4: suite + typecheck + lint + commit**
```bash
cd apps/backend && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/backend/src/services/preenchimento.service.ts apps/backend/src/controllers/escala.controller.ts apps/backend/src/routes/escala.routes.ts apps/backend/src/tests/integration/preenchimento.routes.test.ts
git commit -m "🌐 feat(preenchimento): serviço sugerir/aplicar + endpoints (rascunho-only, soft)"
```

---

### Task 4: Web — cartão de preenchimento automático

**Files:**
- Modify: `apps/web/src/lib/api/escalas.ts` (ou o client de escala equivalente)
- Create: `apps/web/src/features/escalas/PreenchimentoAuto.tsx`
- Modify: a rota de detalhe da escala (`apps/web/src/routes/_app/escalas/$id.tsx`) para montar o cartão
- Test: `apps/web/src/features/escalas/PreenchimentoAuto.test.tsx`

**Interfaces:**
- Consumes: `POST /escalas/:id/sugerir-preenchimento` e `/aplicar-preenchimento`; `PreenchimentoSugestaoDTO`.

- [ ] **Step 1: Client**

Em `apps/web/src/lib/api/escalas.ts`, adicionar:
```ts
sugerirPreenchimento: (id: number, body: { data_ini: string; data_fim: string; descanso_horas?: number }) => apiPost<PreenchimentoSugestaoDTO[]>(`/escalas/${id}/sugerir-preenchimento`, body),
aplicarPreenchimento: (id: number, body: { data_ini: string; data_fim: string; descanso_horas?: number }) => apiPost<{ vagas_preenchidas: number; avisos_patente: number; avisos_descanso: number }>(`/escalas/${id}/aplicar-preenchimento`, body),
```
(usar o helper `apiPost` existente; importar `PreenchimentoSugestaoDTO` de `@escalas/shared-types`.)

- [ ] **Step 2: Componente `PreenchimentoAuto`**

Cartão Mantine com `TextInput` data_ini/data_fim (YYYY-MM-DD) + `NumberInput` descanso_horas (default 72). Botão **Pré-visualizar** → `useMutation` chama `sugerirPreenchimento` e mostra `Table` (Dia, Guarnição, Função, Militar, Motivo, avisos como `Badge` amarelo). Botão **Aplicar** → `useMutation` chama `aplicarPreenchimento`, `notifications.show` com o resumo e invalida `['escala-mes', id]`. Só habilita quando a escala é rascunho (receber via prop). Tratar 422/409 (`ApiError.message`).

- [ ] **Step 3: Montar na tela de detalhe**

Na rota de detalhe, renderizar `<PreenchimentoAuto escalaId={id} rascunho={escala.status === 'rascunho'} />` junto do `AcoesBloco` (mesmo local/condição).

- [ ] **Step 4: Teste**

`PreenchimentoAuto.test.tsx` (MSW mocka as 2 rotas): pré-visualizar renderiza uma linha com militar+motivo; aplicar chama a rota e dispara a notificação. Rodar `cd apps/web && npm test -- PreenchimentoAuto`.

- [ ] **Step 5: suite web + typecheck + lint + commit**
```bash
cd apps/web && npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/lib/api/escalas.ts apps/web/src/features/escalas/PreenchimentoAuto.tsx "apps/web/src/routes/_app/escalas/\$id.tsx" apps/web/src/features/escalas/PreenchimentoAuto.test.tsx
git commit -m "✨ feat(web): cartão de preenchimento automático (preview + aplicar)"
```

---

## Self-Review (preenchido)
- **Cobertura do spec:** núcleo puro (T2) + serviço/endpoints (T3) + web (T4) + DTO/schema (T1). Equidade local, descanso soft, patente soft, conflito hard, preview→aplicar, rascunho-only — todos cobertos. ✔
- **Sem placeholders:** núcleo com código completo + testes; serviço/rotas/web com assinaturas exatas e padrão-modelo nomeado (geracaoBloco/avisosPatente). ✔
- **Consistência de tipos:** `PreenchimentoSugestaoDTO` (T1) = saída do núcleo (T2) = retorno do serviço (T3) = consumo web (T4); `planejarPreenchimento(PlanoInput)` idêntico entre núcleo, testes e serviço. ✔
- **Riscos:** (a) chave do `esperadasPorFuncao` deve ser a MESMA string `funcao` da vaga (não normalizada) — o serviço monta o Map com a função da vaga; (b) intervalos em UTC (Date.UTC) casando com a convenção de `turnos.ts`; (c) `aplicar` relê vaga aberta dentro da tx (concorrência com edição manual).

## Validação final (controlador, pós-T4)
Backend dev :3000, escala rascunho com estrutura carimbada de um layout real (ex.: lot 174, INCENDIO/RESGATE 24h). `sugerir-preenchimento` num intervalo → conferir equidade (contagens espalhadas), descanso (avisos quando o pool aperta), patente (avisos soft), sem conflito no mesmo dia; `aplicar` preenche as vagas abertas sem tocar nas manuais. Verificar no web o cartão (preview + aplicar).
