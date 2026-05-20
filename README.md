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

## Exemplos de uso da API

### Login (SISBOM AD)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"<CPF 11 dígitos>","senha":"<senha do AD>"}'
```

Resposta sucesso:

```json
{
  "success": true,
  "message": "Login realizado.",
  "data": {
    "token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": { "id": 1, "cpf": "...", "nome": "...", "is_super_admin": false, "roles": [] }
  }
}
```

### Login (conta admin local)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"99999999900","senha":"<ADMIN_LOCAL_PASSWORD do .env>"}'
```

### Endpoint autenticado

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <token retornado pelo login>"
```

### Templates de lotação

Configuração padrão das guarnições de uma lotação. `GET` exige role `ESCALANTE`
ou `GESTOR` na lotação (super-admin passa direto); `PUT` exige `ESCALANTE` na
lotação. `PUT` é replace-all (substitui todas as guarnições).

```bash
# Ler o template (404 se ainda não configurado)
curl http://localhost:3000/api/v1/templates/lotacao/100 \
  -H "Authorization: Bearer <token>"

# Criar/substituir o template da lotação
curl -X PUT http://localhost:3000/api/v1/templates/lotacao/100 \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{
    "guarnicoes": [{
      "sigla": "ABT-01",
      "atividade": "incendio",
      "turno_padrao_inicio": "07:00",
      "turno_padrao_fim": "19:00",
      "ordem": 0,
      "vagas_sugeridas": [{ "funcao": "comandante", "quantidade_sugerida": 1 }]
    }]
  }'
```

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
