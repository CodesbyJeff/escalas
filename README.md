# Sistema de Escalas CBMRN

Monorepo do sistema de escalas do CBMRN. Stack: TS + Express + Prisma + Postgres + (futuro) React/Vite + RN/Expo.

## Setup local

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm --filter @escalas/backend prisma:migrate
pnpm --filter @escalas/backend seed:lotacoes
pnpm --filter @escalas/backend seed:super-admins
pnpm --filter @escalas/backend dev
```

API em `http://localhost:3000/api/v1/`.

## Comandos úteis

- `pnpm --filter @escalas/backend test` — testes
- `pnpm --filter @escalas/backend typecheck`
- `pnpm --filter @escalas/backend bulk-sync` — carga inicial do SISBOM
- `pnpm --filter @escalas/backend prisma:studio` — UI do banco

## Roles

- **MILITAR** — padrão, todos os usuários sincronizados
- **ESCALANTE** — cria/edita escalas da sua lotação (atribuído via admin)
- **GESTOR** — valida escalas da sua jurisdição (atribuído via admin)
- **Super-admin** — flag `is_super_admin` no User, atribuída via seeder por matrícula

## Conta admin local

Para administração operacional sem depender da senha pessoal de oficial via SISBOM AD, existe uma conta admin LOCAL:

- Configurada via env vars `ADMIN_LOCAL_CPF`, `ADMIN_LOCAL_NOME`, `ADMIN_LOCAL_PASSWORD` (esta última obrigatória pro seeder rodar)
- Criada/atualizada via `pnpm --filter @escalas/backend seed:admin-local`
- CPF placeholder fora do espaço real (default `99999999900`) — sync do SISBOM NÃO sobrescreve
- Autentica via bcrypt local (não bate no `POST /login-ad` do SISBOM)
- Tem `is_super_admin: true`

Em produção: trocar `ADMIN_LOCAL_PASSWORD` por valor forte e único. Considerar mover para secrets manager.

## Integração SISBOM

- **Login:** `POST {SISBOM_AUTH_URL}` (delegado AD)
- **Sync de usuários:** cron a cada 5 min, lê `{SISBOM_EXTERNAL_BASE_URL}/mirror-ref` e `/events?since=&entities=`
- **Bulk inicial:** `pnpm --filter @escalas/backend bulk-sync`

## Estrutura

```
escalas/
├── apps/backend/      (Express + Prisma + TS)
├── packages/
│   ├── shared-types/  (types TS)
│   └── shared-schemas/(Zod)
├── docker-compose.yml
└── turbo.json
```
