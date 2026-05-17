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
