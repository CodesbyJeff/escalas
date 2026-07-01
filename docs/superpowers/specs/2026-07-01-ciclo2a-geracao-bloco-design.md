# Ciclo 2a — Padrão de turno/descanso + Geração em bloco — Design

**Data:** 2026-07-01
**Autor:** SD Filho
**Status:** aprovado (design validado pelo usuário no brainstorm)
**Base de domínio:** `vault/Projetos/2026-07-01 - ANALISE ESCALAS - MAPA DE FORCA SISBOM = ESCALA EXECUTADA (dominio Ciclo 2).md`

## Objetivo

Matar o "editar dia a dia" na montagem da escala de guarnição, com **duas ferramentas de
bloco** no editor, e preparar o layout com um **padrão** explícito. Fora de escopo aqui: o
motor de preenchimento por equidade (2c) e a elegibilidade por função (2b).

## Contexto

O `escalaService.criar` já gera **todos os dias do mês** com o layout inteiro (guarnições +
vagas abertas). A estrutura existe; a dor é o **preenchimento repetitivo** e o fato de
turnos de 24h (prontidão `08:00→08:00`) não serem tratados corretamente hoje.

O mapa de força do SISBOM (escala executada) mostra os padrões reais: prontidão 24h
(`08→08`), guarda-vidas diurno 10h (`07→17`), posto noturno 12h (`19→07`), mergulho 24h.

## Decisões (aprovadas)

1. **Turno que cruza a meia-noite: por convenção, sem campo novo.** Se
   `turno_fim ≤ turno_inicio`, o turno termina **no dia seguinte**. Resolve todos os casos
   reais: `08→08`=24h, `19→07`=12h, `07→17`=10h. **JÁ IMPLEMENTADO** em `utils/turnos.ts`
   (`intervalo()` faz `if (f <= ini) f += 1440`; `turnosSobrepoem` compara em 0–48h) — a
   detecção de conflito **por dia** já trata prontidão 24h. (O gap de descanso **entre dias**
   — 24h→72h — é regra do 2c, não do 2a.) Nada a fazer aqui além de um teste que fixe o comportamento.
2. **Escala segue mensal.** As ações de bloco operam **dentro do mês** da escala; período
   arbitrário fica fora de escopo agora.
3. **Padrão mínimo no layout:** `TemplateGuarnicao.ciclo_dias Int?` (período do rodízio:
   24×72→4; 12×60→3/6; null = diário). Documenta a intenção, pré-preenche o "repetir ciclo"
   e serve de base pro 2c. Descanso em horas fica pro 2c.
4. **Duas ações de bloco:** carimbar estrutura num intervalo **e** repetir um ciclo preenchido.
5. **Guards:** ações de bloco só em escala **rascunho**; intervalo válido e dentro do mês.

## Arquitetura

### Modelo de dados (migration 0010)

```prisma
model TemplateGuarnicao {
  // ...campos atuais...
  ciclo_dias Int?   // NOVO: período do rodízio do padrão (24x72→4; null = diário)
}
```

Sem outros campos: o cruza-meia-noite é convenção; `EscalaGuarnicao` não muda.

### Convenção cruza-meia-noite (`utils/turnos.ts`)

`encontrarConflitos` passa a comparar **intervalos absolutos**: um turno com
`fim ≤ inicio` é expandido para `[inicio(dia D), fim(dia D+1)]`. Assim dois turnos de
prontidão 24h no mesmo dia para o mesmo militar colidem corretamente, e um `07→17` +
`19→07` do mesmo militar **também** colidem (o segundo entra na madrugada seguinte). Função
auxiliar pura `duracaoMinutos(inicio, fim)` (trata o rollover) para reuso.

### `geracaoBloco.service.ts` (novo)

Responsabilidade única: aplicar estrutura/conteúdo a um intervalo de dias de uma escala.

- **`carimbarEstrutura(escala_id, data_ini, data_fim, template_id, user_id, prisma)`**
  Reaplica a estrutura do layout `template_id` (guarnições + vagas **abertas**, sem militar)
  aos `EscalaDia` do intervalo `[data_ini, data_fim]`. Sobrescreve o conteúdo desses dias
  (deleteMany guarnições + recria a partir do template — mesma lógica do `criar`). Valida:
  escala rascunho; `template_id` pertence à lotação da escala; intervalo dentro do mês.
  Audita (`acao:'carimbar_bloco'`).

- **`repetirCiclo(escala_id, ciclo_ini, ciclo_fim, ate, user_id, prisma)`**
  Lê o conteúdo **preenchido** dos dias `[ciclo_ini..ciclo_fim]` (o ciclo-fonte, tamanho
  `K = dias no intervalo`). Para cada dia-alvo de `ciclo_fim+1` até `ate`, copia o dia-fonte
  correspondente pelo **offset circular** `fonte = ciclo_ini + ((alvo - (ciclo_fim+1)) mod K)`
  — guarnições + vagas + `militar_id`. Reusa `escalaService.putDia` por dia-alvo, o que
  **roda a detecção de conflito** (turnos sobrepostos, já com a convenção cruza-meia-noite).
  Se algum dia-alvo conflita, aborta com 422 listando o dia e os conflitos. Valida: rascunho;
  `ciclo_ini ≤ ciclo_fim < ate`; tudo dentro do mês. Audita (`acao:'repetir_ciclo'`).

### Rotas (backend)

- `POST /escalas/:id/gerar-bloco` → `carimbarEstrutura`. `requireEscalaAccess(['ESCALANTE'])`.
- `POST /escalas/:id/repetir-ciclo` → `repetirCiclo`. `requireEscalaAccess(['ESCALANTE'])`.
- Zod: `gerarBlocoSchema { data_ini, data_fim, template_id }`,
  `repetirCicloSchema { ciclo_ini, ciclo_fim, ate }` (datas ISO `YYYY-MM-DD`).

### Web

- **Editor de layout** (`/layouts`): campo `ciclo_dias` por guarnição (número, opcional,
  com dica "24×72 = 4").
- **Visão de mês da escala** (`$id.index.tsx`): dois botões/ações —
  - "Gerar estrutura no intervalo" → escolhe intervalo + layout → preview (N dias afetados)
    → confirma (sobrescreve) → chama `gerar-bloco`.
  - "Repetir ciclo" → escolhe intervalo-fonte (ciclo) + "até" → preview → chama
    `repetir-ciclo`; erro 422 mostra os dias em conflito inline.
- `lib/api/escalas.ts`: `gerarBloco(...)`, `repetirCiclo(...)`.

## Fluxo de dados

```
criar escala → estrutura vem do layout (todo dia, vagas abertas)
  ↳ [opcional] carimbar outro layout num intervalo (ex.: semana de Carnaval)
  ↳ preencher 1 ciclo (ex.: dias 1–4, com as guarnições/equipes já rotacionadas)
  ↳ repetir ciclo (dias 5 → fim do mês)  → offset circular, conflito por dia
  ↳ ajustar exceções manualmente
```

## Tratamento de erros

- Escala não-rascunho → 409.
- Intervalo inválido (`fim < ini`, fora do mês, dias inexistentes na escala) → 422.
- `template_id` de outra lotação → 409.
- Conflito de turno em algum dia-alvo do repetir → 422 com `{ dia, conflitos }`.

## Testes

- **`turnos`:** convenção cruza-meia-noite — `08→08` vs `08→08` mesmo dia colidem (24h);
  `07→17` + `19→07` do mesmo militar colidem; `07→17` + `18→22` não colidem; `duracaoMinutos`
  para 24h/12h/10h.
- **`geracaoBloco` (integração):** carimbar cria a estrutura do layout no range (vagas
  abertas, dias fora do range intactos); repetir aplica offset circular correto (dia 5 = dia 1);
  repetir detecta conflito e aborta 422; guards (status rascunho, range no mês, template da lotação).
- **Rotas:** RBAC ESCALANTE; shapes de resposta; 409/422.

## Fora de escopo (próximas fatias)

- **2b:** elegibilidade por função (qualificação do militar).
- **2c:** motor de preenchimento por equidade + descanso (insumo = histórico do mapa de força).
- Período de escala arbitrário (não-mensal).
- DO como flag `bo_diaria` / oferta de diária → Sprint 24.
