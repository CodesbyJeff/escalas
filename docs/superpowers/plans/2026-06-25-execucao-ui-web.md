# UI de Execução/Fiscalização (web) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a UI web do ciclo de execução/fiscalização — o FISCAL registra a situação executada por vaga e fecha o dia; o GESTOR valida ou rejeita.

**Architecture:** `apps/web` (React 18 + Vite + TanStack Router/Query + Mantine). Novo módulo de API tipado, um hook de rascunho por-vaga, componentes de apresentação compartilhados (badge de status, linha da vaga, card da guarnição, view do dia) e duas frentes de rota (fiscal em `/execucao`, gestor em `/validacao`), cada uma com worklist + tela do dia. Consome os 6 endpoints já existentes no backend.

**Tech Stack:** TypeScript, React 18, Vite, TanStack Router (file-based), TanStack Query, Mantine 7, Vitest + React Testing Library + MSW.

## Global Constraints

- Branch `main` (o repo escalas commita direto na main). NÃO fazer push (só sob ordem do usuário). NÃO fazer deploy.
- NÃO alterar backend nem os pacotes `shared-types`/`shared-schemas` — apenas consumir.
- NÃO editar `apps/web/src/routeTree.gen.ts` à mão (é gerado pelo plugin do router; basta criar os arquivos de rota e o dev server regenera).
- Respostas da API no padrão `{ success, message, data }`; o client (`apiGet/apiPost/apiPut`) já desembrulha `data` e lança `ApiError` com `.status` em erro.
- Base de API nos testes: `const BASE = 'http://localhost:3000/api/v1'`.
- MSW roda com `onUnhandledRequest: 'error'` — todo request que um componente dispara em teste PRECISA de um handler `server.use(...)`. Em especial, o `MilitarPicker` faz `GET /escalas/:id/militares`.
- Tema de cor do projeto: `cbmrn`. Seguir o padrão denso Mantine das telas existentes.
- Situações (pt-BR): `presente`=Presente, `falta`=Falta, `substituido`=Substituído, `preenchido`=Preenchido. Campo `do` = **Diária Operacional (DO)** (booleano por vaga).
- Regras de situação (do `putExecucaoSchema`): `falta` ⇒ `militar_executado_id` null; `substituido`/`preenchido` ⇒ `militar_executado_id` não-nulo. Validar client-side com `safeParse` antes do PUT (como o editor faz).
- Spec de referência: `docs/superpowers/specs/2026-06-25-execucao-ui-web-design.md`.

## Tipos e contratos já existentes (consumir, não redefinir)

- De `@escalas/shared-types`: `ExecucaoDiaDTO`, `ExecucaoPendenteDTO`, `ExecucaoVagaDTO`, `SituacaoExecucaoDTO` (`'presente'|'falta'|'substituido'|'preenchido'`), `ExecucaoStatusDTO` (`'pendente'|'registrada'|'validada'|'rejeitada'`), `AuthUser`, `MilitarDTO`.
- De `@escalas/shared-schemas`: `putExecucaoSchema`, `PutExecucaoInput`, `validarExecucaoSchema`, `ValidarExecucaoInput`.
- `ExecucaoDiaDTO` = `{ escala_id, data, execucao_status, validado_em: string|null, justificativa: string|null, guarnicoes: Array<{ id, sigla, atividade, turno_inicio, turno_fim, ordem, vagas: Array<{ id, funcao, militar_id: number|null, turno_inicio, turno_fim, execucao: { vaga_id, situacao, militar_executado_id: number|null, do: boolean, observacoes: string|null } | null }> }> }`.
- `ExecucaoPendenteDTO` = `{ escala_id, lotacao_id, data, execucao_status, vagas_total }`.
- Endpoints: `GET /execucoes/pendentes/fiscal`, `GET /execucoes/pendentes/gestor`, `GET /escalas/:id/execucao/:data`, `PUT /escalas/:id/execucao/:data`, `POST /escalas/:id/execucao/:data/fechar`, `POST /escalas/:id/execucao/:data/validar`.

## Estrutura de arquivos

```
apps/web/src/
  lib/api/execucao.ts                                    (Task 1 — novo)
  features/execucao/
    useExecucaoDraft.ts                                  (Task 2 — novo) + .test.ts
    StatusExecucaoBadge.tsx                              (Task 3 — novo) + .test.tsx
    ExecucaoVagaRow.tsx                                  (Task 4 — novo) + .test.tsx
    ExecucaoGuarnicaoCard.tsx                            (Task 5 — novo)
    ExecucaoDiaView.tsx                                  (Task 5 — novo) + .test.tsx
    ExecucaoWorklistTable.tsx                            (Task 7 — novo)
  components/AppShell.tsx                                (Task 6 — modificar) + .test.tsx
  routes/_app.tsx                                        (Task 6 — modificar)
  routes/_app/execucao/index.tsx                         (Task 7 — novo) + worklist.test.tsx
  routes/_app/execucao/escalas/$id.dias.$data.tsx        (Task 8 — novo) + .test.tsx
  routes/_app/validacao/index.tsx                        (Task 9 — novo) + worklist.test.tsx
  routes/_app/validacao/escalas/$id.dias.$data.tsx       (Task 10 — novo) + .test.tsx
```

Comandos de verificação (rodar de `apps/web`): `pnpm test`, `pnpm typecheck`, `pnpm lint`.

---

### Task 1: Módulo de API da execução

**Files:**
- Create: `apps/web/src/lib/api/execucao.ts`

**Interfaces:**
- Produces: `execucaoApi` com `pendentesFiscal()`, `pendentesGestor()`, `getDia(id,data)`, `salvar(id,data,input)`, `fechar(id,data)`, `validar(id,data,input)`.
- Consumes: `apiGet/apiPost/apiPut` de `./client`; tipos de shared.

> Sem teste unitário dedicado — segue o padrão de `lib/api/escalas.ts` (não testado isoladamente; coberto via MSW pelos consumidores nas Tasks 7–10).

- [ ] **Step 1: Criar o módulo**

```ts
// apps/web/src/lib/api/execucao.ts
import type { ExecucaoDiaDTO, ExecucaoPendenteDTO } from '@escalas/shared-types';
import type { PutExecucaoInput, ValidarExecucaoInput } from '@escalas/shared-schemas';
import { apiGet, apiPost, apiPut } from './client';

export const execucaoApi = {
  pendentesFiscal: () => apiGet<ExecucaoPendenteDTO[]>('/execucoes/pendentes/fiscal'),
  pendentesGestor: () => apiGet<ExecucaoPendenteDTO[]>('/execucoes/pendentes/gestor'),
  getDia: (id: number, data: string) => apiGet<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}`),
  salvar: (id: number, data: string, input: PutExecucaoInput) =>
    apiPut<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}`, input),
  fechar: (id: number, data: string) =>
    apiPost<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}/fechar`),
  validar: (id: number, data: string, input: ValidarExecucaoInput) =>
    apiPost<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}/validar`, input),
};
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm typecheck`
Expected: PASS (sem erros).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/execucao.ts
git commit -m "✨ feat(web): módulo de API da execução"
```

---

### Task 2: Hook `useExecucaoDraft`

**Files:**
- Create: `apps/web/src/features/execucao/useExecucaoDraft.ts`
- Test: `apps/web/src/features/execucao/useExecucaoDraft.test.ts`

**Interfaces:**
- Produces: `useExecucaoDraft(dia: ExecucaoDiaDTO)` → `{ vagas, getVaga(id), setVaga(id, patch), toPutInput() }`; tipo `ExecucaoVagaDraft = { vaga_id, situacao, militar_executado_id, do, observacoes: string }`.
- Consumes: `ExecucaoDiaDTO`, `SituacaoExecucaoDTO`, `PutExecucaoInput`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/src/features/execucao/useExecucaoDraft.test.ts
import { renderHook, act } from '@testing-library/react';
import { useExecucaoDraft } from './useExecucaoDraft';

const dia: any = {
  escala_id: 2, data: '2026-06-25', execucao_status: 'pendente', validado_em: null, justificativa: null,
  guarnicoes: [{
    id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
    vagas: [
      { id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null },
      { id: 11, funcao: 'Motorista', militar_id: 5, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 11, situacao: 'substituido', militar_executado_id: 9, do: true, observacoes: 'troca' } },
    ],
  }],
};

it('semeia presente por padrão e preserva execução existente', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  expect(result.current.getVaga(10)!.situacao).toBe('presente');
  expect(result.current.getVaga(10)!.militar_executado_id).toBeNull();
  expect(result.current.getVaga(11)!.situacao).toBe('substituido');
  expect(result.current.getVaga(11)!.militar_executado_id).toBe(9);
  expect(result.current.getVaga(11)!.do).toBe(true);
});

it('mudar para falta zera o substituto', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  act(() => result.current.setVaga(11, { situacao: 'falta' }));
  expect(result.current.getVaga(11)!.situacao).toBe('falta');
  expect(result.current.getVaga(11)!.militar_executado_id).toBeNull();
});

it('toPutInput devolve uma entrada por vaga com observacoes opcional', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  const input = result.current.toPutInput();
  expect(input.vagas).toHaveLength(2);
  const v10 = input.vagas.find((v) => v.vaga_id === 10)!;
  expect(v10.situacao).toBe('presente');
  expect(v10.observacoes).toBeUndefined();
  const v11 = input.vagas.find((v) => v.vaga_id === 11)!;
  expect(v11.observacoes).toBe('troca');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test useExecucaoDraft`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/features/execucao/useExecucaoDraft.ts
import { useState } from 'react';
import type { ExecucaoDiaDTO, SituacaoExecucaoDTO } from '@escalas/shared-types';
import type { PutExecucaoInput } from '@escalas/shared-schemas';

export interface ExecucaoVagaDraft {
  vaga_id: number;
  situacao: SituacaoExecucaoDTO;
  militar_executado_id: number | null;
  do: boolean;
  observacoes: string;
}

function seed(dia: ExecucaoDiaDTO): Record<number, ExecucaoVagaDraft> {
  const m: Record<number, ExecucaoVagaDraft> = {};
  for (const g of dia.guarnicoes) {
    for (const v of g.vagas) {
      m[v.id] = v.execucao
        ? {
            vaga_id: v.id, situacao: v.execucao.situacao,
            militar_executado_id: v.execucao.militar_executado_id,
            do: v.execucao.do, observacoes: v.execucao.observacoes ?? '',
          }
        : { vaga_id: v.id, situacao: 'presente', militar_executado_id: null, do: false, observacoes: '' };
    }
  }
  return m;
}

export function useExecucaoDraft(dia: ExecucaoDiaDTO) {
  const [vagas, setVagas] = useState<Record<number, ExecucaoVagaDraft>>(() => seed(dia));

  const setVaga = (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) =>
    setVagas((prev) => {
      const atual = prev[vaga_id];
      if (!atual) return prev;
      const next = { ...atual, ...patch };
      // presente/falta não têm substituto
      if (next.situacao === 'presente' || next.situacao === 'falta') next.militar_executado_id = null;
      return { ...prev, [vaga_id]: next };
    });

  const toPutInput = (): PutExecucaoInput => ({
    vagas: Object.values(vagas).map((v) => ({
      vaga_id: v.vaga_id,
      situacao: v.situacao,
      militar_executado_id: v.militar_executado_id,
      do: v.do,
      observacoes: v.observacoes.trim() ? v.observacoes.trim() : undefined,
    })),
  });

  return { vagas, getVaga: (id: number) => vagas[id], setVaga, toPutInput };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test useExecucaoDraft`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/execucao/useExecucaoDraft.ts apps/web/src/features/execucao/useExecucaoDraft.test.ts
git commit -m "✨ feat(web): hook useExecucaoDraft (rascunho de execução por vaga)"
```

---

### Task 3: `StatusExecucaoBadge`

**Files:**
- Create: `apps/web/src/features/execucao/StatusExecucaoBadge.tsx`
- Test: `apps/web/src/features/execucao/StatusExecucaoBadge.test.tsx`

**Interfaces:**
- Produces: `<StatusExecucaoBadge status={ExecucaoStatusDTO} />`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/features/execucao/StatusExecucaoBadge.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';

it('mostra o rótulo de cada status', () => {
  const { rerender } = renderWithProviders(<StatusExecucaoBadge status="registrada" />);
  expect(screen.getByText(/aguardando validação/i)).toBeInTheDocument();
  rerender(<StatusExecucaoBadge status="validada" />);
  expect(screen.getByText(/^validada$/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test StatusExecucaoBadge`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/features/execucao/StatusExecucaoBadge.tsx
import { Badge } from '@mantine/core';
import type { ExecucaoStatusDTO } from '@escalas/shared-types';

const MAP: Record<ExecucaoStatusDTO, { color: string; label: string }> = {
  pendente: { color: 'gray', label: 'Pendente' },
  registrada: { color: 'blue', label: 'Aguardando validação' },
  validada: { color: 'green', label: 'Validada' },
  rejeitada: { color: 'red', label: 'Rejeitada' },
};

export function StatusExecucaoBadge({ status }: { status: ExecucaoStatusDTO }) {
  const { color, label } = MAP[status];
  return <Badge color={color}>{label}</Badge>;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test StatusExecucaoBadge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/execucao/StatusExecucaoBadge.tsx apps/web/src/features/execucao/StatusExecucaoBadge.test.tsx
git commit -m "✨ feat(web): badge de status da execução"
```

---

### Task 4: `ExecucaoVagaRow`

**Files:**
- Create: `apps/web/src/features/execucao/ExecucaoVagaRow.tsx`
- Test: `apps/web/src/features/execucao/ExecucaoVagaRow.test.tsx`

**Interfaces:**
- Produces: `<ExecucaoVagaRow escalaId vaga getMilitarNome mode draft? onChange? />`; exporta `SITUACAO_OPCOES` e o tipo `DiaVaga`.
- Consumes: `MilitarPicker` (de `../../components/MilitarPicker`), `ExecucaoVagaDraft` (Task 2), `ExecucaoDiaDTO`, `SituacaoExecucaoDTO`.

> O `MilitarPicker` dispara `GET /escalas/:id/militares` ao montar — todo teste que renderiza a linha em modo `registrar` com situação `substituido`/`preenchido` precisa de handler MSW para essa rota.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/features/execucao/ExecucaoVagaRow.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { ExecucaoVagaRow } from './ExecucaoVagaRow';

const BASE = 'http://localhost:3000/api/v1';
const vaga: any = { id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null };
const draftBase: any = { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: '' };

it('modo registrar: presente esconde o picker de substituto', () => {
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={draftBase} onChange={() => {}} />,
  );
  expect(screen.queryByPlaceholderText(/buscar militar/i)).not.toBeInTheDocument();
});

it('modo registrar: substituído mostra o picker', () => {
  server.use(http.get(`${BASE}/escalas/2/militares`, () => HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={{ ...draftBase, situacao: 'substituido' }} onChange={() => {}} />,
  );
  expect(screen.getByPlaceholderText(/buscar militar/i)).toBeInTheDocument();
});

it('modo registrar: alternar DO chama onChange', async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={draftBase} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith({ do: true });
});

it('modo validar: mostra a situação registrada como badge', () => {
  const vagaEx: any = { ...vaga, execucao: { vaga_id: 10, situacao: 'falta', militar_executado_id: null, do: false, observacoes: null } };
  renderWithProviders(<ExecucaoVagaRow escalaId={2} vaga={vagaEx} getMilitarNome={() => 'X'} mode="validar" />);
  expect(screen.getByText(/^falta$/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test ExecucaoVagaRow`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/features/execucao/ExecucaoVagaRow.tsx
import { Badge, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { ExecucaoDiaDTO, SituacaoExecucaoDTO } from '@escalas/shared-types';
import { MilitarPicker } from '../../components/MilitarPicker';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

export type DiaVaga = ExecucaoDiaDTO['guarnicoes'][number]['vagas'][number];

export const SITUACAO_OPCOES: { value: SituacaoExecucaoDTO; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'falta', label: 'Falta' },
  { value: 'substituido', label: 'Substituído' },
  { value: 'preenchido', label: 'Preenchido' },
];
const SITUACAO_LABEL: Record<SituacaoExecucaoDTO, string> = {
  presente: 'Presente', falta: 'Falta', substituido: 'Substituído', preenchido: 'Preenchido',
};

export function ExecucaoVagaRow({ escalaId, vaga, getMilitarNome, mode, draft, onChange }: {
  escalaId: number;
  vaga: DiaVaga;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  draft?: ExecucaoVagaDraft;
  onChange?: (patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  const previsto = vaga.militar_id != null ? getMilitarNome(vaga.militar_id) : 'VAGO';

  if (mode === 'validar') {
    const ex = vaga.execucao;
    return (
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={500}>{vaga.funcao} — <Text span c="dimmed">{previsto}</Text></Text>
        {ex ? (
          <Group gap="xs">
            <Badge variant="light">{SITUACAO_LABEL[ex.situacao]}</Badge>
            {ex.militar_executado_id != null && <Text size="xs">→ {getMilitarNome(ex.militar_executado_id)}</Text>}
            {ex.do && <Badge color="grape" variant="light">DO</Badge>}
            {ex.observacoes && <Text size="xs" c="dimmed">“{ex.observacoes}”</Text>}
          </Group>
        ) : <Badge color="gray" variant="outline">Sem registro</Badge>}
      </Group>
    );
  }

  const d = draft!;
  const mostrarPicker = d.situacao === 'substituido' || d.situacao === 'preenchido';
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>{vaga.funcao} — <Text span c="dimmed">{previsto}</Text></Text>
        <Switch
          label="DO"
          checked={d.do}
          onChange={(e) => onChange!({ do: e.currentTarget.checked })}
          aria-label={`Diária Operacional ${vaga.funcao}`}
        />
      </Group>
      <Group grow align="flex-start">
        <Select
          aria-label={`Situação ${vaga.funcao}`}
          data={SITUACAO_OPCOES}
          value={d.situacao}
          onChange={(v) => v && onChange!({ situacao: v as SituacaoExecucaoDTO })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: false }}
        />
        {mostrarPicker && (
          <MilitarPicker
            escalaId={escalaId}
            value={d.militar_executado_id}
            onChange={(id) => onChange!({ militar_executado_id: id })}
          />
        )}
      </Group>
      <TextInput
        placeholder="Observações"
        maxLength={280}
        value={d.observacoes}
        onChange={(e) => onChange!({ observacoes: e.currentTarget.value })}
        aria-label={`Observações ${vaga.funcao}`}
      />
    </Stack>
  );
}
```

> Nota: `comboboxProps={{ withinPortal: false }}` no `Select` mantém as opções no DOM do teste (jsdom) sem portal, facilitando asserts; segue o que já funciona nas telas existentes com Mantine.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test ExecucaoVagaRow`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/execucao/ExecucaoVagaRow.tsx apps/web/src/features/execucao/ExecucaoVagaRow.test.tsx
git commit -m "✨ feat(web): linha de vaga da execução (registrar/validar)"
```

---

### Task 5: `ExecucaoGuarnicaoCard` + `ExecucaoDiaView`

**Files:**
- Create: `apps/web/src/features/execucao/ExecucaoGuarnicaoCard.tsx`
- Create: `apps/web/src/features/execucao/ExecucaoDiaView.tsx`
- Test: `apps/web/src/features/execucao/ExecucaoDiaView.test.tsx`

**Interfaces:**
- Produces:
  - `<ExecucaoGuarnicaoCard escalaId guarnicao getMilitarNome mode getDraft? onChangeVaga? />`
  - `<ExecucaoDiaView escalaId dia getMilitarNome mode getDraft? onChangeVaga? />`
  - `getDraft?: (vaga_id: number) => ExecucaoVagaDraft | undefined`; `onChangeVaga?: (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) => void`.
- Consumes: `ExecucaoVagaRow` (Task 4), `StatusExecucaoBadge` (Task 3), `ExecucaoVagaDraft` (Task 2).

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/features/execucao/ExecucaoDiaView.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ExecucaoDiaView } from './ExecucaoDiaView';

const dia: any = {
  escala_id: 2, data: '2026-06-25', execucao_status: 'rejeitada', validado_em: null, justificativa: 'Corrigir o motorista',
  guarnicoes: [{
    id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
    vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
      execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }],
  }],
};

it('mostra o badge de status, a guarnição e o alerta de rejeição', () => {
  renderWithProviders(
    <ExecucaoDiaView escalaId={2} dia={dia} getMilitarNome={() => 'SD Filho'} mode="validar" />,
  );
  expect(screen.getByText(/rejeitada/i)).toBeInTheDocument();
  expect(screen.getByText(/ABT-01/)).toBeInTheDocument();
  expect(screen.getByText(/corrigir o motorista/i)).toBeInTheDocument();
  expect(screen.getByText(/comandante/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test ExecucaoDiaView`
Expected: FAIL.

- [ ] **Step 3: Implementar `ExecucaoGuarnicaoCard`**

```tsx
// apps/web/src/features/execucao/ExecucaoGuarnicaoCard.tsx
import { Card, Divider, Group, Stack, Text } from '@mantine/core';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { ExecucaoVagaRow } from './ExecucaoVagaRow';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

type Guarnicao = ExecucaoDiaDTO['guarnicoes'][number];

export function ExecucaoGuarnicaoCard({ escalaId, guarnicao, getMilitarNome, mode, getDraft, onChangeVaga }: {
  escalaId: number;
  guarnicao: Guarnicao;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  getDraft?: (vaga_id: number) => ExecucaoVagaDraft | undefined;
  onChangeVaga?: (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  return (
    <Card withBorder>
      <Group justify="space-between">
        <Text fw={700}>{guarnicao.sigla} — {guarnicao.atividade}</Text>
        <Text size="sm" c="dimmed">{guarnicao.turno_inicio} – {guarnicao.turno_fim}</Text>
      </Group>
      <Divider my="xs" />
      <Stack gap="sm">
        {guarnicao.vagas.map((v) => (
          <ExecucaoVagaRow
            key={v.id}
            escalaId={escalaId}
            vaga={v}
            getMilitarNome={getMilitarNome}
            mode={mode}
            draft={mode === 'registrar' ? getDraft?.(v.id) : undefined}
            onChange={mode === 'registrar' ? (patch) => onChangeVaga?.(v.id, patch) : undefined}
          />
        ))}
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 4: Implementar `ExecucaoDiaView`**

```tsx
// apps/web/src/features/execucao/ExecucaoDiaView.tsx
import { Alert, SimpleGrid, Stack } from '@mantine/core';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { ExecucaoGuarnicaoCard } from './ExecucaoGuarnicaoCard';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

export function ExecucaoDiaView({ escalaId, dia, getMilitarNome, mode, getDraft, onChangeVaga }: {
  escalaId: number;
  dia: ExecucaoDiaDTO;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  getDraft?: (vaga_id: number) => ExecucaoVagaDraft | undefined;
  onChangeVaga?: (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  return (
    <Stack>
      <StatusExecucaoBadge status={dia.execucao_status} />
      {dia.execucao_status === 'rejeitada' && dia.justificativa && (
        <Alert color="red" title="Rejeitada pelo gestor">{dia.justificativa}</Alert>
      )}
      {dia.guarnicoes.length === 0 ? (
        <Alert color="gray">Sem guarnições neste dia.</Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {dia.guarnicoes.map((g) => (
            <ExecucaoGuarnicaoCard
              key={g.id}
              escalaId={escalaId}
              guarnicao={g}
              getMilitarNome={getMilitarNome}
              mode={mode}
              getDraft={getDraft}
              onChangeVaga={onChangeVaga}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test ExecucaoDiaView`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/execucao/ExecucaoGuarnicaoCard.tsx apps/web/src/features/execucao/ExecucaoDiaView.tsx apps/web/src/features/execucao/ExecucaoDiaView.test.tsx
git commit -m "✨ feat(web): card de guarnição e view do dia da execução"
```

---

### Task 6: Gating de navegação por papel (AppShell + _app)

**Files:**
- Modify: `apps/web/src/components/AppShell.tsx`
- Modify: `apps/web/src/routes/_app.tsx`
- Test: `apps/web/src/components/AppShell.test.tsx`

**Interfaces:**
- Produces: `navFlags(user: AuthUser | null) => { canExecutar: boolean; canValidar: boolean }`; `AppShellNav` ganha props `canExecutar: boolean` e `canValidar: boolean`.
- Consumes: `AuthUser`, `useAuth` (em `_app.tsx`).

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao arquivo `apps/web/src/components/AppShell.test.tsx` (importe o que faltar no topo: `navFlags` de `./AppShell`):

```tsx
import { navFlags, AppShellNav } from './AppShell';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';

describe('navFlags', () => {
  it('super-admin vê execução e validação', () => {
    expect(navFlags({ is_super_admin: true, roles: [] } as any)).toEqual({ canExecutar: true, canValidar: true });
  });
  it('FISCAL vê execução; GESTOR vê validação', () => {
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'FISCAL', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: true, canValidar: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'GESTOR', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: true });
  });
  it('usuário sem papéis não vê nenhum', () => {
    expect(navFlags({ is_super_admin: false, roles: [] } as any)).toEqual({ canExecutar: false, canValidar: false });
  });
});

describe('AppShellNav gating', () => {
  it('mostra Execução/Validação quando habilitados', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="Administrador" canExecutar canValidar onLogout={() => {}} />,
    );
    expect(screen.getByText('Execução')).toBeInTheDocument();
    expect(screen.getByText('Validação')).toBeInTheDocument();
  });
  it('esconde Execução quando desabilitada', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} onLogout={() => {}} />,
    );
    expect(screen.queryByText('Execução')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test AppShell`
Expected: FAIL (`navFlags` e props inexistentes).

- [ ] **Step 3: Implementar em `AppShell.tsx`**

Adicione o import de tipo e a função `navFlags`, troque a assinatura de `AppShellNav` e substitua os dois últimos `NavLink` (Execução/Validação). Bloco completo do arquivo:

```tsx
// apps/web/src/components/AppShell.tsx
import { AppShell, Burger, Group, NavLink, Text, ActionIcon, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconCalendar, IconShieldCheck, IconClipboardCheck, IconLogout } from '@tabler/icons-react';
import { Link, Outlet } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';

export function navFlags(user: AuthUser | null): { canExecutar: boolean; canValidar: boolean } {
  const roles = user?.roles ?? [];
  const sa = user?.is_super_admin ?? false;
  return {
    canExecutar: sa || roles.some((r) => r.role === 'FISCAL'),
    canValidar: sa || roles.some((r) => r.role === 'GESTOR'),
  };
}

export function AppShellNav({ nome, papel, canExecutar, canValidar, onLogout, children }: {
  nome: string; papel: string; canExecutar: boolean; canValidar: boolean; onLogout: () => void; children?: ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Group ml="auto" gap="xs">
            <Avatar color="cbmrn" radius="xl">{nome.charAt(0)}</Avatar>
            <div><Text size="sm" fw={600}>{nome}</Text><Text size="xs" c="dimmed">{papel}</Text></div>
            <ActionIcon variant="subtle" aria-label="Sair" onClick={onLogout}><IconLogout size={18} /></ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" bg="cbmrn.7">
        <Text c="white" fw={700} mb="md">Escalas CBMRN</Text>
        <NavLink component={Link} to="/painel" label="Painel" c="white" leftSection={<IconLayoutDashboard size={18} />} />
        <NavLink label="Escala" c="white" leftSection={<IconCalendar size={18} />} defaultOpened>
          <NavLink component={Link} to="/escalas" label="Listar" c="white" />
          <NavLink component={Link} to="/escalas/nova" label="Nova Escala" c="white" />
        </NavLink>
        {canExecutar && (
          <NavLink component={Link} to="/execucao" label="Execução" c="white" leftSection={<IconClipboardCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink component={Link} to="/validacao" label="Validação" c="white" leftSection={<IconShieldCheck size={18} />} />
        )}
      </AppShell.Navbar>
      <AppShell.Main>{children ?? <Outlet />}</AppShell.Main>
    </AppShell>
  );
}
```

- [ ] **Step 4: Ligar em `_app.tsx`**

```tsx
// apps/web/src/routes/_app.tsx
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Center, Loader } from '@mantine/core';
import { getToken } from '../lib/auth/storage';
import { useAuth } from '../lib/auth/AuthContext';
import { AppShellNav, navFlags } from '../components/AppShell';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => { if (!getToken()) throw redirect({ to: '/login' }); },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  if (loading) return <Center mih="100vh"><Loader /></Center>;
  const papel = user?.is_super_admin ? 'Administrador' : 'Operador';
  const { canExecutar, canValidar } = navFlags(user);
  return (
    <AppShellNav
      nome={user?.nome ?? ''}
      papel={papel}
      canExecutar={canExecutar}
      canValidar={canValidar}
      onLogout={() => { logout(); navigate({ to: '/login' }); }}
    />
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test AppShell`
Expected: PASS. Rode também `pnpm typecheck` (a nova prop obrigatória pode quebrar outros usos — só `_app.tsx` usa `AppShellNav`, já ajustado).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/AppShell.tsx apps/web/src/components/AppShell.test.tsx apps/web/src/routes/_app.tsx
git commit -m "✨ feat(web): itens de menu Execução/Validação gateados por papel"
```

---

### Task 7: Worklist do Fiscal (`/execucao`) + tabela compartilhada

**Files:**
- Create: `apps/web/src/features/execucao/ExecucaoWorklistTable.tsx`
- Create: `apps/web/src/routes/_app/execucao/index.tsx`
- Test: `apps/web/src/routes/_app/execucao/worklist.test.tsx`

**Interfaces:**
- Produces:
  - `<ExecucaoWorklistTable itens actionLabel emptyText onAbrir />` (reusado na Task 9).
  - rota `/_app/execucao/` com componente exportado `FiscalWorklist({ onAbrir })`.
- Consumes: `execucaoApi` (Task 1), `StatusExecucaoBadge` (Task 3), `ExecucaoPendenteDTO`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/routes/_app/execucao/worklist.test.tsx
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { FiscalWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista os dias pendentes do fiscal', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/fiscal`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { escala_id: 2, lotacao_id: 100, data: '2026-06-25', execucao_status: 'pendente', vagas_total: 5 },
    ] })));
  renderWithProviders(<FiscalWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('2026-06-25')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /registrar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/fiscal`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<FiscalWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhum dia pendente de registro/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test execucao/worklist`
Expected: FAIL.

- [ ] **Step 3: Implementar a tabela compartilhada**

```tsx
// apps/web/src/features/execucao/ExecucaoWorklistTable.tsx
import { Button, Table, Text } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';

export function ExecucaoWorklistTable({ itens, actionLabel, emptyText, onAbrir }: {
  itens: ExecucaoPendenteDTO[];
  actionLabel: string;
  emptyText: string;
  onAbrir: (item: ExecucaoPendenteDTO) => void;
}) {
  if (itens.length === 0) return <Text c="dimmed" ta="center" py="xl">{emptyText}</Text>;
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Lotação</Table.Th><Table.Th>Data</Table.Th><Table.Th>Status</Table.Th>
          <Table.Th>Vagas</Table.Th><Table.Th>Ação</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {itens.map((it) => (
          <Table.Tr key={`${it.escala_id}-${it.data}`}>
            <Table.Td>#{it.lotacao_id}</Table.Td>
            <Table.Td>{it.data}</Table.Td>
            <Table.Td><StatusExecucaoBadge status={it.execucao_status} /></Table.Td>
            <Table.Td>{it.vagas_total}</Table.Td>
            <Table.Td><Button size="xs" variant="light" onClick={() => onAbrir(it)}>{actionLabel}</Button></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

- [ ] **Step 4: Implementar a rota da worklist do fiscal**

```tsx
// apps/web/src/routes/_app/execucao/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Stack, Title } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { execucaoApi } from '../../../lib/api/execucao';
import { ExecucaoWorklistTable } from '../../../features/execucao/ExecucaoWorklistTable';

export const Route = createFileRoute('/_app/execucao/')({ component: FiscalWorklistPage });

function FiscalWorklistPage() {
  const navigate = useNavigate();
  return (
    <FiscalWorklist
      onAbrir={(it) => navigate({ to: '/execucao/escalas/$id/dias/$data', params: { id: String(it.escala_id), data: it.data } })}
    />
  );
}

export function FiscalWorklist({ onAbrir }: { onAbrir: (it: ExecucaoPendenteDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['execucao', 'pendentes', 'fiscal'], queryFn: execucaoApi.pendentesFiscal });
  if (isLoading) return <Loader />;
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Execução — dias a registrar</Title>
      <ExecucaoWorklistTable itens={data} actionLabel="Registrar" emptyText="Nenhum dia pendente de registro." onAbrir={onAbrir} />
    </Stack>
  );
}
```

> A navegação referencia a rota da Task 8 (`/execucao/escalas/$id/dias/$data`). Enquanto a Task 8 não existir, o dev server pode não ter o tipo da rota — o `navigate` está só no `FiscalWorklistPage` (não exercitado pelos testes desta task). Se o typecheck reclamar do `to`, conclua a Task 8 antes de rodar `pnpm typecheck` da Task 7 (as duas são vizinhas).

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test execucao/worklist`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/execucao/ExecucaoWorklistTable.tsx apps/web/src/routes/_app/execucao/index.tsx apps/web/src/routes/_app/execucao/worklist.test.tsx
git commit -m "✨ feat(web): worklist do fiscal (/execucao) + tabela de pendências"
```

---

### Task 8: Tela do dia — Fiscal (`/execucao/escalas/$id/dias/$data`)

**Files:**
- Create: `apps/web/src/routes/_app/execucao/escalas/$id.dias.$data.tsx`
- Test: `apps/web/src/routes/_app/execucao/escalas/fiscalDia.test.tsx`

**Interfaces:**
- Produces: rota `/_app/execucao/escalas/$id/dias/$data`; componente exportado `FiscalDiaScreen({ escalaId, data })`.
- Consumes: `execucaoApi` (Task 1), `militaresApi` (`lib/api/militares`), `useExecucaoDraft` (Task 2), `ExecucaoDiaView` (Task 5), `StatusExecucaoBadge` (Task 3), `putExecucaoSchema` (shared), `ApiError` (`lib/api/client`).

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// apps/web/src/routes/_app/execucao/escalas/fiscalDia.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { FiscalDiaScreen } from './$id.dias.$data';

const BASE = 'http://localhost:3000/api/v1';

function diaPendente(over: any = {}) {
  return {
    escala_id: 2, data: '2026-06-25', execucao_status: 'pendente', validado_em: null, justificativa: null,
    guarnicoes: [{
      id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null }],
    }],
    ...over,
  };
}
function mockBase(dia: any) {
  server.use(
    http.get(`${BASE}/escalas/2/execucao/2026-06-25`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.get(`${BASE}/escalas/2/militares`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ id: 4, nome: 'Francisco Filho', nome_curto: 'FILHO', posto: 'SD', matricula: 'M1' }] })),
  );
}

it('fiscal salva a execução e mostra notificação', async () => {
  mockBase(diaPendente());
  server.use(http.put(`${BASE}/escalas/2/execucao/2026-06-25`, () => HttpResponse.json({ success: true, message: 'ok', data: diaPendente() })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
  await waitFor(() => expect(screen.getByText(/execução salva/i)).toBeInTheDocument());
});

it('mostra alerta inline no 422 ao salvar', async () => {
  mockBase(diaPendente());
  server.use(http.put(`${BASE}/escalas/2/execucao/2026-06-25`, () =>
    HttpResponse.json({ success: false, message: 'Vaga 99 não pertence ao dia.', data: null }, { status: 422 })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
  await waitFor(() => {
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /não pertence ao dia/i.test(el.textContent ?? ''))).toBe(true);
  });
});

it('fecha para validação com confirmação', async () => {
  mockBase(diaPendente());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/fechar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaPendente({ execucao_status: 'registrada' }) })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /fechar para validação/i }));
  // confirma no modal
  await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => expect(screen.getByText(/execução fechada/i)).toBeInTheDocument());
});

it('quando registrada, fica somente leitura (sem botões de ação)', async () => {
  mockBase(diaPendente({ execucao_status: 'registrada',
    guarnicoes: [{ id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }] }] }));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  expect(screen.queryByRole('button', { name: /^salvar$/i })).not.toBeInTheDocument();
  expect(screen.getByText(/aguardando validação/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test fiscalDia`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/routes/_app/execucao/escalas/$id.dias.$data.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { putExecucaoSchema } from '@escalas/shared-schemas';
import { execucaoApi } from '../../../../lib/api/execucao';
import { militaresApi } from '../../../../lib/api/militares';
import { ApiError } from '../../../../lib/api/client';
import { useExecucaoDraft } from '../../../../features/execucao/useExecucaoDraft';
import { ExecucaoDiaView } from '../../../../features/execucao/ExecucaoDiaView';

export const Route = createFileRoute('/_app/execucao/escalas/$id/dias/$data')({ component: FiscalDiaPage });

function FiscalDiaPage() {
  const { id, data } = Route.useParams();
  return <FiscalDiaScreen escalaId={Number(id)} data={data} />;
}

export function FiscalDiaScreen({ escalaId, data }: { escalaId: number; data: string }) {
  const { data: dia, isLoading } = useQuery({
    queryKey: ['execucao', 'dia', escalaId, data], queryFn: () => execucaoApi.getDia(escalaId, data),
  });
  const { data: militares = [] } = useQuery({
    queryKey: ['militares', escalaId], queryFn: () => militaresApi.listar(escalaId),
  });
  if (isLoading || !dia) return <Loader />;
  const map = new Map<number, string>(militares.map((m) => [m.id, [m.posto, m.nome_curto ?? m.nome].filter(Boolean).join(' ')]));
  const getMilitarNome = (mid: number) => map.get(mid) ?? String(mid);
  return <FiscalDiaForm escalaId={escalaId} data={data} dia={dia} getMilitarNome={getMilitarNome} />;
}

function FiscalDiaForm({ escalaId, data, dia, getMilitarNome }: {
  escalaId: number; data: string; dia: ExecucaoDiaDTO; getMilitarNome: (id: number) => string;
}) {
  const draft = useExecucaoDraft(dia);
  const editavel = dia.execucao_status === 'pendente' || dia.execucao_status === 'rejeitada';
  const [erro, setErro] = useState<string | null>(null);
  const [confirmOpen, confirm] = useDisclosure(false);
  const qc = useQueryClient();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['execucao', 'dia', escalaId, data] });
    qc.invalidateQueries({ queryKey: ['execucao', 'pendentes', 'fiscal'] });
  };
  const tratarErro = (e: unknown) => {
    const err = e as ApiError;
    if (err.status === 422) setErro(err.message);
    else if (err.status === 409) notifications.show({ color: 'red', message: 'Dia já fechado/validado. Recarregue.' });
    else notifications.show({ color: 'red', message: err.message });
  };

  const salvar = useMutation({
    mutationFn: () => {
      const input = draft.toPutInput();
      const r = putExecucaoSchema.safeParse(input);
      if (!r.success) return Promise.reject(new Error(r.error.issues.map((i) => i.message).join('; ')));
      return execucaoApi.salvar(escalaId, data, input);
    },
    onSuccess: () => { setErro(null); notifications.show({ message: 'Execução salva.' }); invalidar(); },
    onError: (e) => { if (e instanceof ApiError) tratarErro(e); else setErro((e as Error).message); },
  });

  const fechar = useMutation({
    mutationFn: () => execucaoApi.fechar(escalaId, data),
    onSuccess: () => { confirm.close(); setErro(null); notifications.show({ message: 'Execução fechada para validação.' }); invalidar(); },
    onError: (e) => { confirm.close(); tratarErro(e); },
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Execução — {data}</Title>
        {editavel && (
          <Group>
            <Button onClick={() => salvar.mutate()} loading={salvar.isPending}>Salvar</Button>
            <Button color="cbmrn" onClick={confirm.open}>Fechar para validação</Button>
          </Group>
        )}
      </Group>
      {!editavel && (
        <Alert color="blue">{dia.execucao_status === 'registrada' ? 'Aguardando validação do gestor.' : 'Dia validado.'}</Alert>
      )}
      {erro && <Alert color="red" title="Não foi possível salvar">{erro}</Alert>}
      <ExecucaoDiaView
        escalaId={escalaId}
        dia={dia}
        getMilitarNome={getMilitarNome}
        mode={editavel ? 'registrar' : 'validar'}
        getDraft={draft.getVaga}
        onChangeVaga={draft.setVaga}
      />
      <Modal opened={confirmOpen} onClose={confirm.close} title="Fechar para validação" centered>
        <Stack>
          <Text size="sm">Após fechar, o dia vai para o gestor e não poderá mais ser editado até ser validado/rejeitado. Confirmar?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>Cancelar</Button>
            <Button color="cbmrn" onClick={() => fechar.mutate()} loading={fechar.isPending}>Confirmar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test fiscalDia`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_app/execucao/escalas/
git commit -m "✨ feat(web): tela do fiscal — registrar/salvar/fechar execução do dia"
```

---

### Task 9: Worklist do Gestor (`/validacao`)

**Files:**
- Create: `apps/web/src/routes/_app/validacao/index.tsx`
- Test: `apps/web/src/routes/_app/validacao/worklist.test.tsx`

**Interfaces:**
- Produces: rota `/_app/validacao/`; componente exportado `GestorWorklist({ onAbrir })`.
- Consumes: `execucaoApi` (Task 1), `ExecucaoWorklistTable` (Task 7), `ExecucaoPendenteDTO`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/src/routes/_app/validacao/worklist.test.tsx
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { GestorWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista os dias aguardando validação', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/gestor`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { escala_id: 2, lotacao_id: 100, data: '2026-06-25', execucao_status: 'registrada', vagas_total: 5 },
    ] })));
  renderWithProviders(<GestorWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('2026-06-25')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /validar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/gestor`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<GestorWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhum dia aguardando validação/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test validacao/worklist`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/routes/_app/validacao/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Stack, Title } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { execucaoApi } from '../../../lib/api/execucao';
import { ExecucaoWorklistTable } from '../../../features/execucao/ExecucaoWorklistTable';

export const Route = createFileRoute('/_app/validacao/')({ component: GestorWorklistPage });

function GestorWorklistPage() {
  const navigate = useNavigate();
  return (
    <GestorWorklist
      onAbrir={(it) => navigate({ to: '/validacao/escalas/$id/dias/$data', params: { id: String(it.escala_id), data: it.data } })}
    />
  );
}

export function GestorWorklist({ onAbrir }: { onAbrir: (it: ExecucaoPendenteDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['execucao', 'pendentes', 'gestor'], queryFn: execucaoApi.pendentesGestor });
  if (isLoading) return <Loader />;
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Validação — dias aguardando</Title>
      <ExecucaoWorklistTable itens={data} actionLabel="Validar" emptyText="Nenhum dia aguardando validação." onAbrir={onAbrir} />
    </Stack>
  );
}
```

> O `navigate` referencia a rota da Task 10. Conclua a Task 10 antes do `pnpm typecheck` final (vizinhas).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test validacao/worklist`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_app/validacao/index.tsx apps/web/src/routes/_app/validacao/worklist.test.tsx
git commit -m "✨ feat(web): worklist do gestor (/validacao)"
```

---

### Task 10: Tela do dia — Gestor (`/validacao/escalas/$id/dias/$data`)

**Files:**
- Create: `apps/web/src/routes/_app/validacao/escalas/$id.dias.$data.tsx`
- Test: `apps/web/src/routes/_app/validacao/escalas/gestorDia.test.tsx`

**Interfaces:**
- Produces: rota `/_app/validacao/escalas/$id/dias/$data`; componente exportado `GestorDiaScreen({ escalaId, data })`.
- Consumes: `execucaoApi` (Task 1), `militaresApi`, `ExecucaoDiaView` (Task 5), `ValidarExecucaoInput` (shared), `ApiError`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// apps/web/src/routes/_app/validacao/escalas/gestorDia.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { GestorDiaScreen } from './$id.dias.$data';

const BASE = 'http://localhost:3000/api/v1';

function diaRegistrada(over: any = {}) {
  return {
    escala_id: 2, data: '2026-06-25', execucao_status: 'registrada', validado_em: null, justificativa: null,
    guarnicoes: [{
      id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }],
    }],
    ...over,
  };
}
function mockBase(dia: any) {
  server.use(
    http.get(`${BASE}/escalas/2/execucao/2026-06-25`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.get(`${BASE}/escalas/2/militares`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ id: 4, nome: 'Francisco Filho', nome_curto: 'FILHO', posto: 'SD', matricula: 'M1' }] })),
  );
}

it('gestor valida o dia e mostra notificação', async () => {
  mockBase(diaRegistrada());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/validar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaRegistrada({ execucao_status: 'validada', validado_em: '2026-06-25T12:00:00.000Z' }) })));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^validar$/i }));
  await waitFor(() => expect(screen.getByText(/execução validada/i)).toBeInTheDocument());
});

it('rejeitar exige justificativa (botão confirmar desabilitado sem texto)', async () => {
  mockBase(diaRegistrada());
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  expect(screen.getByRole('button', { name: /confirmar rejeição/i })).toBeDisabled();
});

it('rejeitar com justificativa envia e notifica', async () => {
  mockBase(diaRegistrada());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/validar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaRegistrada({ execucao_status: 'rejeitada', justificativa: 'refazer' }) })));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  await userEvent.type(screen.getByLabelText(/justificativa/i), 'refazer');
  await userEvent.click(screen.getByRole('button', { name: /confirmar rejeição/i }));
  await waitFor(() => expect(screen.getByText(/execução rejeitada/i)).toBeInTheDocument());
});

it('quando já validada, não mostra ações', async () => {
  mockBase(diaRegistrada({ execucao_status: 'validada', validado_em: '2026-06-25T12:00:00.000Z' }));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  expect(screen.queryByRole('button', { name: /^validar$/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test gestorDia`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/routes/_app/validacao/escalas/$id.dias.$data.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Loader, Modal, Stack, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import type { ValidarExecucaoInput } from '@escalas/shared-schemas';
import { execucaoApi } from '../../../../lib/api/execucao';
import { militaresApi } from '../../../../lib/api/militares';
import { ApiError } from '../../../../lib/api/client';
import { ExecucaoDiaView } from '../../../../features/execucao/ExecucaoDiaView';

export const Route = createFileRoute('/_app/validacao/escalas/$id/dias/$data')({ component: GestorDiaPage });

function GestorDiaPage() {
  const { id, data } = Route.useParams();
  return <GestorDiaScreen escalaId={Number(id)} data={data} />;
}

export function GestorDiaScreen({ escalaId, data }: { escalaId: number; data: string }) {
  const { data: dia, isLoading } = useQuery({
    queryKey: ['execucao', 'dia', escalaId, data], queryFn: () => execucaoApi.getDia(escalaId, data),
  });
  const { data: militares = [] } = useQuery({
    queryKey: ['militares', escalaId], queryFn: () => militaresApi.listar(escalaId),
  });
  if (isLoading || !dia) return <Loader />;
  const map = new Map<number, string>(militares.map((m) => [m.id, [m.posto, m.nome_curto ?? m.nome].filter(Boolean).join(' ')]));
  const getMilitarNome = (mid: number) => map.get(mid) ?? String(mid);
  return <GestorDiaView escalaId={escalaId} data={data} dia={dia} getMilitarNome={getMilitarNome} />;
}

function GestorDiaView({ escalaId, data, dia, getMilitarNome }: {
  escalaId: number; data: string; dia: ExecucaoDiaDTO; getMilitarNome: (id: number) => string;
}) {
  const podeValidar = dia.execucao_status === 'registrada';
  const [rejeitarOpen, rejeitar] = useDisclosure(false);
  const [justificativa, setJustificativa] = useState('');
  const qc = useQueryClient();

  const validar = useMutation({
    mutationFn: (input: ValidarExecucaoInput) => execucaoApi.validar(escalaId, data, input),
    onSuccess: (_res, input) => {
      rejeitar.close();
      notifications.show({ message: input.status === 'validada' ? 'Execução validada.' : 'Execução rejeitada.' });
      qc.invalidateQueries({ queryKey: ['execucao', 'dia', escalaId, data] });
      qc.invalidateQueries({ queryKey: ['execucao', 'pendentes', 'gestor'] });
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.status === 409) notifications.show({ color: 'red', message: 'O dia mudou de estado. Recarregue.' });
      else notifications.show({ color: 'red', message: err.message });
    },
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Validação — {data}</Title>
        {podeValidar && (
          <Group>
            <Button color="green" onClick={() => validar.mutate({ status: 'validada' })} loading={validar.isPending}>Validar</Button>
            <Button color="red" variant="light" onClick={rejeitar.open}>Rejeitar</Button>
          </Group>
        )}
      </Group>
      {dia.execucao_status === 'validada' && <Alert color="green">Dia validado{dia.validado_em ? ` em ${dia.validado_em.slice(0, 10)}` : ''}.</Alert>}
      {dia.execucao_status === 'pendente' && <Alert color="gray">Ainda não fechado pelo fiscal.</Alert>}
      <ExecucaoDiaView escalaId={escalaId} dia={dia} getMilitarNome={getMilitarNome} mode="validar" />
      <Modal opened={rejeitarOpen} onClose={rejeitar.close} title="Rejeitar execução" centered>
        <Stack>
          <Textarea
            label="Justificativa"
            placeholder="Descreva o que precisa ser corrigido"
            minRows={3}
            maxLength={500}
            value={justificativa}
            onChange={(e) => setJustificativa(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={rejeitar.close}>Cancelar</Button>
            <Button
              color="red"
              disabled={!justificativa.trim()}
              loading={validar.isPending}
              onClick={() => validar.mutate({ status: 'rejeitada', justificativa: justificativa.trim() })}
            >
              Confirmar rejeição
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test gestorDia`
Expected: PASS (4 testes).

- [ ] **Step 5: Verificação final do app**

Run (de `apps/web`): `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo verde. (O `routeTree.gen.ts` deve ter sido regenerado pelo dev server; se rodar build sem dev server, rode `pnpm dev` uma vez para regenerar antes do `typecheck`.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_app/validacao/escalas/
git commit -m "✨ feat(web): tela do gestor — validar/rejeitar execução do dia"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** API (T1), draft (T2), badge (T3), linha da vaga c/ DO e picker condicional (T4), card+view c/ banner e alerta de rejeição (T5), gating de menu por papel (T6), worklist fiscal + tabela (T7), tela fiscal salvar/fechar/read-only 422/409 (T8), worklist gestor (T9), tela gestor validar/rejeitar/terminal (T10). Tratamento de erros 422/409 coberto nas Tasks 8 e 10. Regras de situação (falta zera substituto; refinement antes do PUT) na T2/T8.
- **Sem placeholders:** todos os steps têm código/comandos concretos.
- **Consistência de tipos:** `getDraft`/`onChangeVaga` definidos na T5 e consumidos na T8; `ExecucaoVagaDraft` (T2) usado em T4/T5; `execucaoApi` (T1) em T7–T10; `ExecucaoWorklistTable` (T7) reusado em T9; `navFlags` (T6) consumido em `_app.tsx`.
- **Ordem de execução:** T1→T6 são independentes de rotas; T7 e T8 são vizinhas (o `navigate` da T7 referencia a rota da T8) — executar T8 logo após T7 e rodar o `typecheck` cruzado só ao fim; idem T9/T10.

## Execução

Após salvar o plano, escolher o modo de execução (subagent-driven recomendado — ver handoff).
