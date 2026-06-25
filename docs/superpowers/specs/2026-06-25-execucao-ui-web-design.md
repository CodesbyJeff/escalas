# Design — UI de Execução/Fiscalização (web admin)

**Data:** 2026-06-25
**Projeto:** Sistema de Escalas CBMRN — `apps/web` (@escalas/web)
**Status:** aprovado para planejamento

## Contexto

O backend da feature de **execução/fiscalização** já está completo e pushado
(`origin/main`, faixa `c522f77..d9b57cc`). Falta a UI web. Esta feature permite:

- O **FISCAL** registrar, por vaga de um dia de escala publicada, a situação
  executada (presente/falta/substituído/preenchido), o substituto quando houver,
  a flag de Diária Operacional (DO) e observações; e então **fechar o dia para
  validação**.
- O **GESTOR** validar ou rejeitar (com justificativa) um dia fechado.

Máquina de estados de `EscalaDia.execucao_status`:
`pendente → registrada → validada | rejeitada` (retrabalho: `rejeitada → edita → fecha`).

### Endpoints já existentes (consumidos por esta UI)

| Método | Rota | Papel | Retorno |
|---|---|---|---|
| GET | `/api/v1/execucoes/pendentes/fiscal` | FISCAL | `ExecucaoPendenteDTO[]` |
| GET | `/api/v1/execucoes/pendentes/gestor` | GESTOR | `ExecucaoPendenteDTO[]` |
| GET | `/api/v1/escalas/:id/execucao/:data` | FISCAL/GESTOR | `ExecucaoDiaDTO` |
| PUT | `/api/v1/escalas/:id/execucao/:data` | FISCAL | `ExecucaoDiaDTO` (salvar) |
| POST | `/api/v1/escalas/:id/execucao/:data/fechar` | FISCAL | `ExecucaoDiaDTO` |
| POST | `/api/v1/escalas/:id/execucao/:data/validar` | GESTOR | `ExecucaoDiaDTO` |

Erros relevantes: `salvar`/`fechar`/`validar` → 409 (estado errado), 422
(vaga prevista sem situação, vaga fora do dia, refinement Zod), 404 (dia inexistente),
403 (sem papel na lotação).

### DTOs / schemas (já em shared-types / shared-schemas)

- `ExecucaoPendenteDTO`: `{ escala_id, lotacao_id, data, execucao_status, vagas_total }`
- `ExecucaoDiaDTO`: `{ escala_id, data, execucao_status, validado_em, justificativa,
  guarnicoes: [{ id, sigla, atividade, turno_inicio, turno_fim, ordem,
  vagas: [{ id, funcao, militar_id, turno_inicio, turno_fim,
  execucao: { vaga_id, situacao, militar_executado_id, do, observacoes } | null }] }] }`
- `putExecucaoSchema` / `PutExecucaoInput`: `{ vagas: [{ vaga_id, situacao, militar_executado_id, do, observacoes? }] }`
  com refinements: `falta` ⇒ `militar_executado_id === null`; `substituido|preenchido` ⇒ `militar_executado_id !== null`.
- `validarExecucaoSchema` / `ValidarExecucaoInput`: `{ status: 'validada'|'rejeitada', justificativa? }`
  com refinement: `rejeitada` ⇒ `justificativa` obrigatória.
- `SituacaoExecucaoDTO`: `'presente' | 'falta' | 'substituido' | 'preenchido'`.

### Decisões fechadas no brainstorming

- **Escopo:** ciclo completo Fiscal + Gestor.
- **Navegação:** duas seções no menu — "Execução" (worklist do fiscal) e "Validação"
  (worklist do gestor, item já presente no AppShell, hoje desabilitado).
- **Campo `do`:** é **Diária Operacional (DO)** — flag por vaga; pode ser gerada pelo
  serviço executado (e futuramente pelas diárias operacionais dos militares que
  ocuparam a vaga). Rótulo na UI: "Diária Operacional (DO)".

## Padrões existentes do `apps/web` a seguir

- Rotas file-based TanStack Router sob `src/routes/_app/` (routeTree gerado
  automaticamente — **não editar `routeTree.gen.ts` à mão**).
- Dados via TanStack Query; mutations com `notifications` (Mantine) e
  `queryClient.invalidateQueries`.
- API: wrappers `apiGet/apiPost/apiPut/apiDelete` de `lib/api/client`; erros via
  `ApiError` com `.status`.
- Auth: `useAuth()` expõe `user` com `roles: Array<{role, lotacao_id}>` e `is_super_admin`.
- Tema cor `cbmrn`. Componentes densos Mantine.
- Editor do dia (`routes/_app/escalas/$id.dias.$data.tsx` + `useDiaDraft` +
  `GuarnicaoCard`/`VagaRow`) é o modelo direto a espelhar.
- Testes: Vitest + RTL + MSW (`src/test/msw.ts`, `src/test/render.tsx`).

## Arquitetura da solução

### 1. Camada de API — `src/lib/api/execucao.ts`

```ts
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

### 2. Navegação — gating por papel

- `AppShellNav` ganha props `canExecutar: boolean` e `canValidar: boolean` (além de
  manter `nome`/`papel`/`onLogout`). Renderiza o `NavLink` "Execução" (to `/execucao`)
  só se `canExecutar`; habilita/renderiza "Validação" (to `/validacao`) só se `canValidar`.
- `_app.tsx` calcula os flags a partir de `useAuth()`:
  `canExecutar = is_super_admin || roles.some(r => r.role === 'FISCAL')`;
  `canValidar = is_super_admin || roles.some(r => r.role === 'GESTOR')`.
- (Ajuste menor) `papel` exibido no header pode refletir o papel principal; não é
  requisito desta feature — manter comportamento atual aceitável.

### 3. Componentes compartilhados — `src/features/execucao/`

- **`StatusBadge`** (`StatusExecucaoBadge.tsx`): recebe `execucao_status`, retorna
  `Badge` Mantine com cor+rótulo:
  pendente=gray "Pendente", registrada=blue "Aguardando validação",
  validada=green "Validada", rejeitada=red "Rejeitada".
- **`ExecucaoVagaRow.tsx`**: renderiza a vaga prevista (`funcao`, militar previsto via
  `getMilitarNome` — ver nota abaixo, turno) e:
  - **modo `registrar`**: `Select` de situação (4 opções pt-BR);
    `MilitarPicker` (reuso, `escalaId`) para substituto, visível só quando
    `situacao ∈ {substituido, preenchido}`; `Switch` "Diária Operacional (DO)";
    `TextInput` observações (máx. 280). Vaga VAGO (militar_id null) é editável
    igualmente (pode ter sido preenchida → `preenchido`).
  - **modo `validar`**: badges read-only mostrando situação, substituto (se houver),
    DO (se true) e observações.
- **`ExecucaoGuarnicaoCard.tsx`**: cabeçalho da guarnição (sigla/atividade/turno) +
  lista de `ExecucaoVagaRow`.
- **`ExecucaoDiaView.tsx`**: recebe `dia: ExecucaoDiaDTO`, `mode`, e (em modo registrar)
  os handlers do draft; monta a grade de `ExecucaoGuarnicaoCard`. Banner de status no
  topo; se `rejeitada`, `Alert` vermelho com a justificativa.
- **`useExecucaoDraft.ts`**: hook que inicializa o estado editável a partir do
  `ExecucaoDiaDTO` (uma entrada por vaga, default `presente`/sem substituto/`do=false`
  quando `execucao` é null), expõe setters por vaga e `toPutInput(): PutExecucaoInput`.

**Nota sobre nome do militar:** `ExecucaoDiaDTO` traz `militar_id` (previsto) e
`militar_executado_id`, mas não os nomes. Para exibir nomes seguir o padrão do editor:
buscar a lista de militares da escala (`GET /escalas/:id/militares`, já existe — usar a
`militaresApi`) e mapear id→nome (`getMilitarNome`). O `MilitarPicker` já resolve o nome
do substituto selecionado internamente.

### 4. Tela do Fiscal

- Rota worklist: `src/routes/_app/execucao/index.tsx` (`/execucao`).
  - `useQuery(['execucao','pendentes','fiscal'], execucaoApi.pendentesFiscal)`.
  - `Table` Mantine: colunas Lotação (id), Data, Status (`StatusBadge`), Vagas
    (`vagas_total`), ação "Registrar" → navega para
    `/execucao/escalas/$id/dias/$data`. Estado vazio: "Nenhum dia pendente de registro."
- Rota do dia: `src/routes/_app/execucao/escalas/$id.dias.$data.tsx`.
  - `useQuery(['execucao','dia',id,data], () => execucaoApi.getDia(id,data))`.
  - `useExecucaoDraft(dia)`; `ExecucaoDiaView mode="registrar"`.
  - **Editável** quando `execucao_status ∈ {pendente, rejeitada}`; quando
    `registrada`/`validada`, renderiza em modo read-only com nota
    ("Aguardando validação." / "Validado.").
  - Ações (visíveis no modo editável):
    - **Salvar** → valida `toPutInput()` com `putExecucaoSchema.safeParse` (mostra
      `Alert` inline se inválido), depois `execucaoApi.salvar`. onSuccess: notifica +
      invalida `['execucao','dia',id,data]` e a worklist. onError: 422→Alert inline,
      409→notificação "dia já fechado/validado, recarregue", senão notificação do erro.
    - **Fechar para validação** → `Modal`/confirm → `execucaoApi.fechar`. onSuccess:
      notifica, invalida dia+worklist (o dia some da worklist do fiscal). onError:
      422→Alert ("há vagas previstas sem situação"), 409→notificação.

### 5. Tela do Gestor

- Rota worklist: `src/routes/_app/validacao/index.tsx` (`/validacao`).
  - `useQuery(['execucao','pendentes','gestor'], execucaoApi.pendentesGestor)`.
  - `Table` igual à do fiscal, ação "Validar" → `/validacao/escalas/$id/dias/$data`.
    Estado vazio: "Nenhum dia aguardando validação."
- Rota do dia: `src/routes/_app/validacao/escalas/$id.dias.$data.tsx`.
  - `getDia`; `ExecucaoDiaView mode="validar"` (read-only).
  - Ações habilitadas quando `execucao_status === 'registrada'`:
    - **Validar** → `execucaoApi.validar(id,data,{status:'validada'})`. onSuccess:
      notifica, invalida dia+worklist do gestor.
    - **Rejeitar** → `Modal` com `Textarea` justificativa (obrigatória, 1..500) →
      `execucaoApi.validar(id,data,{status:'rejeitada', justificativa})`. Validar
      client-side antes (botão desabilitado se vazio). onError 409→notificação.
  - Se já `validada`/`rejeitada`, mostra estado terminal (badge + justificativa se houver),
    sem ações.

## Tratamento de erros (resumo)

| Cenário | UI |
|---|---|
| 422 ao salvar (refinement/vaga inválida) | `Alert` inline vermelho com a mensagem |
| 422 ao fechar (prevista sem situação) | `Alert`/notificação com a mensagem |
| 409 (estado errado / concorrência) | notificação "recarregue" + invalida query |
| 403 | não deve ocorrer (nav gateada + RBAC) — notificação genérica de fallback |
| 404 dia | estado "dia não encontrado" |

## Testes (Vitest + RTL + MSW)

- `useExecucaoDraft`: init a partir de DTO com/sem `execucao`; `toPutInput` produz o
  shape correto; troca de situação ajusta substituto (falta zera substituto).
- `ExecucaoVagaRow`: situação `substituido/preenchido` mostra `MilitarPicker`;
  `presente/falta` esconde; switch DO; modo `validar` rende badges read-only.
- `StatusBadge`: cada status → cor/rótulo.
- Worklist fiscal/gestor: render da tabela a partir de MSW; estado vazio; navegação.
- Tela fiscal: salvar sucesso; 422 inline; 409 notificação; fechar sucesso/422;
  read-only quando registrada/validada.
- Tela gestor: validar sucesso; rejeitar exige justificativa; rejeitar sucesso;
  estado terminal sem ações.
- AppShell/`_app`: itens "Execução"/"Validação" aparecem conforme papel.

## Fora de escopo (YAGNI)

- Integração com mapa de força (passo 5, bloqueado por decisão de design).
- Mobile (RN+Expo).
- UI de AuditLog das ações de execução/validação.
- Ações em massa (substituição em período), relatório PDF.
- Edição da estrutura prevista do dia (isso é do editor do escalante, já existe).

## Estrutura de arquivos (novos)

```
apps/web/src/
  lib/api/execucao.ts
  features/execucao/
    StatusExecucaoBadge.tsx              (+ .test.tsx)
    ExecucaoVagaRow.tsx                  (+ .test.tsx)
    ExecucaoGuarnicaoCard.tsx
    ExecucaoDiaView.tsx
    useExecucaoDraft.ts                  (+ .test.ts)
  routes/_app/execucao/index.tsx
  routes/_app/execucao/escalas/$id.dias.$data.tsx
  routes/_app/validacao/index.tsx
  routes/_app/validacao/escalas/$id.dias.$data.tsx
  (alterações) components/AppShell.tsx, routes/_app.tsx
```

## Convenções

- Branch `main` (escalas commita direto na main). Push só sob ordem.
- Sem deploy. Não alterar backend/shared (só consumir).
- Não editar `routeTree.gen.ts` à mão (gerado pelo plugin do router).
