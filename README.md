# Sistema de Escalas CBMRN

Monorepo do sistema de escalas. Stack: TS + Express + Prisma + Postgres + (futuro) React/Vite + RN/Expo.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @escalas/backend prisma:migrate
pnpm dev
```
