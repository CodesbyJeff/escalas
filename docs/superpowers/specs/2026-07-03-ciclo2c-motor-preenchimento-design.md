# Ciclo 2c — Motor de Preenchimento por Equidade + Descanso — Design

**Data:** 2026-07-03
**Contexto:** Com a Fundação de Dados Reais fechada (layouts reais do mapa de força + patentes populadas), o motor de preenchimento auto-sugere quem preenche cada vaga aberta, equilibrando **equidade** (contagem de serviços) e **descanso** (janela pós-turno), respeitando **elegibilidade soft** por patente e **sem conflito de turno** no dia. É o análogo do `setupSchedule` do CFAP, mas manual-first: o motor **sugere**, o escalante decide.

## Decisões trancadas (aprovadas com o usuário)
- **Equidade = contagem local: escala atual + escalas anteriores publicadas/aprovadas da mesma lotação.** Sem SISBOM.
- **Descanso:** "após um turno que termina em T, o militar fica indisponível até T + `descanso_horas`". Default **72** (24×72). Parâmetro por execução.
- **Aviso SEMPRE soft:** patente divergente e descanso violado **nunca bloqueiam** — o motor preenche mesmo assim e marca o aviso (coerente com 2b). Só o **conflito de turno no mesmo dia** é barreira dura (nunca duplo-escala).
- **Só preenche vaga ABERTA** (`militar_id null`) — nunca sobrescreve escolha manual. **Rascunho-only.**
- **Determinístico:** sem `Date.now`/random; desempate por `militar_id`. (Testável.)
- **Fluxo preview → aplicar:** `sugerir` é puro (não grava); `aplicar` grava só nas vagas ainda abertas, em transação, auditado.

## Arquitetura

### Núcleo puro — `apps/backend/src/utils/preenchimento.ts`
`planejarPreenchimento(input): ResultadoVaga[]` — recebe tudo pré-computado (nada de I/O) e roda o greedy determinístico.

- **Intervalos absolutos:** cada vaga/atribuição vira `[inicio, fim]` em minutos desde uma época comum, aplicando a **convenção 24h** (`turno_fim ≤ turno_inicio ⇒ fim no dia seguinte`) — reusa a lógica de `utils/turnos.ts`.
- **Estado por militar:** intervalos já atribuídos (das vagas preenchidas pré-existentes + das que o motor atribui na rodada) e contagem acumulada de serviços.
- **Por vaga aberta** (ordem cronológica: data, guarnição.ordem, vaga.id):
  1. **candidatos** = pool de militares da lotação.
  2. **conflito de turno (HARD):** rejeita candidato cujo intervalo já atribuído sobrepõe o da vaga.
  3. **descanso (SOFT):** marca `viola_descanso` se existe atribuição terminando em `E ≤ inicio` com `inicio − E < descanso_horas`.
  4. **ranqueia:** (a) descansado antes de quem viola descanso; (b) patente compatível antes de divergente; (c) **menos serviços acumulados**; (d) desempate `militar_id` asc.
  5. **atribui** o melhor; se o pool inteiro conflita (hard) → vaga fica **sem sugestão**. Incrementa a contagem e registra o intervalo do escolhido.
- **Saída por vaga:** `{ vaga_id, data, guarnicao_sigla, funcao, militar_id|null, militar_nome|null, motivo, aviso_patente, aviso_descanso }`. `motivo` explica a escolha ("menos serviços (3) · descansado · patente ok" / "sem candidato sem conflito").

### Serviço — `apps/backend/src/services/preenchimento.service.ts`
- `sugerir(escala_id, { data_ini, data_fim, descanso_horas }, prisma): Promise<PreenchimentoSugestaoDTO[]>` — **preview puro (não grava):**
  - guard rascunho (senão 409) + intervalo no mês (senão 422).
  - **pool** = `adminService.listarUsuarios({ lotacao_id })` (militares da lotação, com patente).
  - **equidade inicial** = contagem por militar das vagas preenchidas nesta escala **+** nas escalas `publicada`/`aprovada` anteriores da mesma lotação.
  - **intervalos pré-existentes** = vagas preenchidas nos dias do intervalo (para conflito/descanso).
  - **esperadas por função** = `patenteService.esperadasPara(funcao, lotacao_id, template_id)` **memoizado por `funcao_norm`**.
  - chama `planejarPreenchimento` e mapeia para o DTO (nome/patente do militar).
- `aplicar(escala_id, params, user_id, prisma): Promise<{ vagas_preenchidas, avisos_patente, avisos_descanso }>` — recomputa e, numa `$transaction`, grava `militar_id` **apenas nas vagas ainda abertas** (releitura defensiva), audita (`auditService`, ação `preencher_auto`).

### API
- `POST /escalas/:id/sugerir-preenchimento` (body `{ data_ini, data_fim, descanso_horas? }`) → DTO[] (preview).
- `POST /escalas/:id/aplicar-preenchimento` (mesmo body) → resumo.
- Ambos `requireEscalaAccess(['ESCALANTE'])`, `validate` com Zod.

### DTO / schema (shared)
- `PreenchimentoSugestaoDTO` (shared-types); `preenchimentoInputSchema` (`data_ini`, `data_fim` YYYY-MM-DD; `descanso_horas` int 0–336 opcional, default 72) em shared-schemas.

### Web — `apps/web`
- Na tela de detalhe da escala, cartão **"Preenchimento automático"** (intervalo + `descanso_horas`) → botão **Pré-visualizar** (tabela por vaga: dia, guarnição, função, militar sugerido, motivo, badges de aviso) → botão **Aplicar** (invalida `['escala-mes', id]`). Reusa o padrão do `AcoesBloco`.

## Escopo / não-escopo
- **Em escopo:** motor backend (núcleo puro + serviço + endpoints) e a UI de preview/aplicar.
- **Fora:** bloqueio rígido (tudo soft, exceto conflito de turno); otimização global (é greedy explicável, não solver); permuta/atestado; DO individual.

## Testes
- **Núcleo puro (Vitest):** equidade espalha (menor contagem vence); conflito de turno no mesmo dia nunca ocorre (hard); descanso exclui-preferindo e relaxa com `aviso_descanso` quando o pool esgota; patente prioriza mas não bloqueia; determinismo (desempate por id); vaga sem candidato → `militar_id null`; turno 24h tratado pela convenção.
- **Serviço/rota (integração):** `sugerir` não grava e respeita rascunho/intervalo; `aplicar` grava só em vaga aberta (não sobrescreve manual) e é idempotente-seguro; equidade considera escala anterior publicada.
- **Web:** preview renderiza motivos/avisos; aplicar chama a rota e invalida a query.

## Riscos
- **Época/fuso dos intervalos:** usar UTC consistente (como `resumoServico`), casando com a convenção 24h de `turnos.ts`.
- **Custo:** greedy O(vagas × militares) — ok para uma lotação/mês; memoizar `esperadasPara` por função.
- **`aplicar` vs concorrência:** releitura das vagas abertas dentro da tx evita sobrescrever uma atribuição manual feita entre o preview e o aplicar.
