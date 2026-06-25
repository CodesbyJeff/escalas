# Design — Mobile Militar (1º corte: API militar + app RN/Expo, sem push)

**Data:** 2026-06-25
**Projeto:** Sistema de Escalas CBMRN — novo `apps/mobile` + endpoints militar no `apps/backend`
**Status:** aprovado para planejamento

## Contexto

O militar ainda não tem como ver a própria escala. O backend só expõe rotas do
escalante/gestor/fiscal (todas gateadas por `requireEscalaAccess`); o enum tem o papel
`MILITAR` mas nenhuma rota o serve. Não existe app mobile (só menção no README).

Este é o **1º corte** do mobile militar: uma **API voltada ao militar** (pré-requisito) +
um **app RN/Expo de visualização** (login + home + calendário). **Push fica para um corte
futuro** (registro de device token + gatilho + envio Expo).

### Decisões fechadas no brainstorming (2026-06-25)
- **Escopo:** API militar + app, **sem push**.
- **"Meus serviços" =** vagas onde sou o **militar previsto** (`Vaga.militar_id = eu`) em
  escalas com status ∈ {`publicada`, `em_validacao`, `aprovada`}. **Sem dados de execução**
  (nada de falta/substituído/validado nesta versão).
- **Reuso de tipos:** reusar `@escalas/shared-types` no mobile via `metro.config.js` de
  monorepo; **fallback** = declarar os tipos localmente se o Metro brigar com os symlinks
  do pnpm.
- **Navegação:** Expo Router.
- **Verificação visual** do app é manual (Expo Go / device) — fora do alcance de teste
  automatizado desta sessão.

### Stack (da arquitetura travada — [[project_escalas_arquitetura]])
RN + Expo + Context API + `react-native-calendars`; Expo Push (corte futuro). Auth: JWT
delegado ao AD do SISBOM via `POST /api/login-ad` (o mesmo `POST /api/v1/auth/login` já
usado pelo web atende login local com `senha_hash` e, em prod, AD).

## Parte A — API militar (backend)

### Endpoint
`GET /api/v1/me/servicos?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Auth: só `authMiddleware` (qualquer usuário autenticado vê os **próprios** serviços;
  filtro por `req.user.id`). Sem `requireRole`/`requireEscalaAccess`.
- Query (Zod): `from` e `to` opcionais, formato `YYYY-MM-DD`. Defaults: `from` = hoje
  (UTC, meia-noite), `to` = `from` + 60 dias. Se `to < from` → 422.
- Resposta padrão `{success,message,data}` com `data: MeuServicoDTO[]`, ordenado por
  `data` asc, depois `turno_inicio` asc.

### Consulta (Prisma)
`prisma.vaga.findMany` onde:
- `militar_id = req.user.id`
- `guarnicao.dia.data` entre `from` e `to` (inclusive; datas em UTC meia-noite, padrão do
  `EscalaDia.data`)
- `guarnicao.dia.escala.status IN ['publicada','em_validacao','aprovada']`
`include`: `guarnicao` → `dia` (data) e `guarnicao` (sigla/atividade/turno) → `dia.escala`
→ `lotacao` (id/sigla/nome). Ordenação aplicada no map (Prisma não ordena por relação
aninhada direto; ordenar em memória por `data`+`turno_inicio`).

### DTO (novo em `packages/shared-types/src/me.ts`, re-exportado no index)
```ts
export interface MeuServicoDTO {
  vaga_id: number;
  data: string;              // YYYY-MM-DD
  funcao: string;
  turno_inicio: string;      // HH:MM (da vaga)
  turno_fim: string;
  guarnicao: { sigla: string; atividade: string; turno_inicio: string; turno_fim: string };
  lotacao: { id: number; sigla: string; nome: string };
}
```

### Camadas (padrão existente do backend)
- `apps/backend/src/services/me.service.ts` → `meService.listarMeusServicos(userId, from, to, prisma): Promise<MeuServicoDTO[]>` (datas como `Date`).
- `apps/backend/src/controllers/me.controller.ts` → `meController.servicos` (lê `req.user.id`, parseia query defaults, chama service, `ok(...)`; `handle(res,next,e)` para HttpError).
- `apps/backend/src/routes/me.routes.ts` → `meRoutes` com `meRoutes.use(authMiddleware)` + `GET /servicos` (com `validate` da query). Registrar em `routes/index.ts`: `router.use('/me', meRoutes)`.
- Zod da query em `packages/shared-schemas/src/me.schemas.ts` (`meServicosQuerySchema`), re-exportado no index. Como `validate` valida `req.body`, e aqui é query, o controller faz o parse da query com o schema (ou um `validateQuery` simples) — **decisão:** parsear no controller com `meServicosQuerySchema.safeParse(req.query)` e retornar 422 na falha (evita novo middleware; segue o estilo de `validate`).
- App de teste: `me.service.test.ts` (cobre filtro por militar, faixa de datas, exclusão de rascunho/rejeitada, ordenação) + `me.routes.test.ts` (200 com token; 401 sem token; respeita `from/to`; 422 em `to<from`).

## Parte B — App RN/Expo (`apps/mobile`)

### Setup
- Pacote `@escalas/mobile` no workspace pnpm. Expo (SDK atual) + TypeScript + Expo Router.
- `metro.config.js` de monorepo: `watchFolders = [workspaceRoot]`, `nodeModulesPaths`
  resolvendo raiz + app, `disableHierarchicalLookup` conforme necessário, para resolver
  `@escalas/shared-types`. **Fallback** documentado: se o Metro não resolver os symlinks do
  pnpm, criar `apps/mobile/src/types.ts` com `MeuServicoDTO`/`AuthUser`/login locais e não
  importar o pacote shared. (O plano deve tratar a config do Metro como uma task de risco,
  com o fallback explícito.)
- `app.json`/`app.config` mínimo; `expo-secure-store`, `react-native-calendars` como deps.

### Estrutura
```
apps/mobile/
  app.json
  metro.config.js
  package.json
  tsconfig.json
  app/                         # Expo Router
    _layout.tsx                # provider de auth + stack
    login.tsx
    (tabs)/_layout.tsx         # ou stack simples: home + calendario
    (tabs)/index.tsx           # Home
    (tabs)/calendario.tsx      # Calendário
  src/
    api/client.ts              # fetch + refresh 401 + SecureStore
    api/auth.ts                # login, me
    api/servicos.ts            # GET /me/servicos
    auth/AuthContext.tsx       # Context API
    auth/storage.ts            # expo-secure-store (get/set/clear token)
    features/
      ProximoServicoCard.tsx
      ListaServicos.tsx        # próximos 7 dias
      CalendarioServicos.tsx   # react-native-calendars + detalhe do dia
    lib/datas.ts               # helpers de data (agrupar por dia, próximo, etc.)
```

### Telas / fluxo
- **Login** (`app/login.tsx`): CPF + senha → `POST /auth/login` → guarda `token`/`refresh`
  no SecureStore, seta user no Context → redireciona para Home. Erro → mensagem inline.
- **Home** (`(tabs)/index.tsx`): busca `GET /me/servicos` (hoje → +7d para a lista;
  intervalo maior opcional). **Card "próximo serviço"** = primeiro serviço futuro
  (data/lotação/guarnição/função/turno). **Lista "próximos 7 dias"** abaixo. Estado vazio:
  "Nenhum serviço nos próximos dias." Pull-to-refresh.
- **Calendário** (`(tabs)/calendario.tsx`): `react-native-calendars` com dias que têm
  serviço marcados (`markedDates`); ao tocar num dia, mostra os serviços daquele dia. Busca
  o mês visível via `from/to`.
- **Logout**: limpa SecureStore + Context → volta ao login.

### Cliente de API (RN)
Espelha `apps/web/src/lib/api/client.ts`: base `EXPO_PUBLIC_API_URL` (fallback para o IP de
dev), `Authorization: Bearer <token>` do SecureStore, em `401` tenta `POST /auth/refresh`
uma vez; falhou → limpa tokens e sinaliza "sessão expirada". Desembrulha `{success,message,data}`,
lança `ApiError` com `.status`.

### Auth Context
`AuthProvider` com `{ user, loading, login, logout }`. Ao montar: se há token no SecureStore,
chama `GET /auth/me`; sucesso → seta user; falha → limpa. Igual em espírito ao web, adaptado
a async storage (SecureStore é assíncrono).

## Testes

- **Backend:** `me.service.test.ts` (filtro por militar; faixa de datas; exclui rascunho/rejeitada; inclui publicada/em_validacao/aprovada; ordenação data+turno) e `me.routes.test.ts` (200 autenticado; 401 sem token; `from/to`; 422 `to<from`). Padrão Vitest+supertest existente.
- **Mobile:** testes de **lógica pura** com Jest (`jest-expo` ou ts-jest): `lib/datas.ts`
  (próximo serviço, agrupar por dia, `markedDates`) e o mapeamento do cliente de API
  (desembrulho/erro) com fetch mockado. Testes de componente RN só se baratos; o foco é a
  lógica testável. **Sem** E2E nativo nesta sessão.
- **Cenário de teste (dev):** dar `senha_hash` local a um militar que já tem vagas (ex.: o
  SD Filho do cenário existente) para permitir login no app em dev; a escala `#2` 06/2026 já
  tem vagas previstas para ele. (Setup operacional, não código do app.)

## Fora de escopo (YAGNI / cortes futuros)
- **Push** (Expo Push Service, device token, gatilho "escala publicada/alterada").
- Permuta, atestado, diárias (fases futuras do projeto).
- Dados de execução na visão do militar (falta/substituído/validado).
- Tela de perfil/configurações além de logout.
- E2E nativo automatizado.

## Convenções
- Branch `main` (escalas commita direto na main). Push só sob ordem.
- Sem deploy. Backend segue padrão `{success,message,data}`, rotas `/api/v1` pt-BR.
- Não introduzir libs fora da stack travada sem justificativa.
- Spec relacionada: execução já entregue ([[project_escalas_reuso_cfap]]).

## Sequenciamento da implementação
1. Backend militar API (DTO + schema + service + controller + rota + testes). Entrega
   testável e validável por API antes de tocar no app.
2. Scaffold do `apps/mobile` (Expo + Router + Metro monorepo) — task de risco isolada, com
   fallback de tipos locais.
3. Cliente de API + Auth Context + storage.
4. Login.
5. Home (card + lista) + `lib/datas` (com testes).
6. Calendário.
