# Ciclo 3 — Higiene de Produção — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao sistema a capacidade de chegar a um usuário real — CORS fechado por env, CI rodando os testes a cada push, o E2E que nunca rodou passando de verdade, e a lacuna de ~150 commits de versionamento fechada.

**Architecture:** Quatro fatias independentes sobre a `main`. A Fatia 1 mexe só em `config/env.ts` + `app.ts` (extrai `parseEnv` para a regra de produção virar testável). A Fatia 2 acrescenta um único job de CI que reusa a infraestrutura de teste que já existe (o `setup.ts` já roda `prisma migrate deploy` sozinho). As Fatias 3 e 4 destravam o `escalante.spec.ts`: uma função de fixture determinística no backend, e o Playwright passando a subir backend + web num comando só. A Fatia 5 fecha com a tag.

**Tech Stack:** TypeScript ESM, Node 20, pnpm 9 + turbo, Express 4 + zod + Prisma 5 (Postgres), Vitest + supertest no backend, Vitest + Testing Library no web, Playwright para E2E, GitHub Actions.

## Global Constraints

- **Spec de origem:** `docs/superpowers/specs/2026-08-16-ciclo3-higiene-producao-design.md`. Decisões trancadas lá valem aqui; divergir exige voltar à spec, não improvisar no código.
- **ESM com extensão explícita:** todo import relativo termina em `.js`, inclusive apontando para arquivos `.ts` (`import { env } from './config/env.js'`). Omitir a extensão quebra em runtime.
- **TDD obrigatório:** o teste é escrito primeiro, roda-se para vê-lo **falhar**, e só então vem a implementação. Um teste que passa na primeira execução não provou nada e precisa ser endurecido.
- **Commits em português, com emoji no padrão do repo** (`✨ feat`, `🐛 fix`, `🔧 fix`, `📝 spec`, `📋 plan`, `🔨 chore`). Rodapé `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Branch:** trabalha-se direto na `main` (estratégia do projeto). Nunca criar branch nova sem pedir.
- **Convenção de nomes:** `snake_case` no banco e no JSON de API; `camelCase` no código TypeScript. Os models Prisma já usam `snake_case` nos campos — respeitar como estão.
- **Nada de `!!`** para forçar não-nulo em TypeScript; usar `?.`, `??` ou checagem explícita. (Exceção: os testes existentes usam `!` em asserções pós-`expect`; seguir o arquivo em que se está.)
- **Comandos rodam da raiz do monorepo** (`C:\Users\CTIC\Desktop\escalas`), com filtros pnpm: `pnpm --filter @escalas/backend test`.
- **Nenhuma tarefa deste plano faz deploy**, valida Docker, ou toca no `sisbom-api`.

---

### Task 1: CORS por env, falhando fechado em produção

**Files:**
- Modify: `apps/backend/src/config/env.ts` (arquivo inteiro reescrito, 34 linhas)
- Modify: `apps/backend/src/app.ts:10-11`
- Modify: `.env.example`
- Test: `apps/backend/src/tests/unit/env.test.ts` (criar)
- Test: `apps/backend/src/tests/integration/cors.test.ts` (criar)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `parseEnv(raw: NodeJS.ProcessEnv): Env` e `env: Env`, onde `type Env = z.infer<typeof envSchema> & { origins: string[] }`. O `export const env` mantém nome e forma atuais, então **nenhum call site existente muda**. Nenhuma task posterior depende disto.

- [ ] **Step 1: Escrever o teste de unidade que falha**

Criar `apps/backend/src/tests/unit/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../config/env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_SECRET: 'segredo-de-teste-16-chars',
  JWT_REFRESH_SECRET: 'outro-segredo-de-teste-16',
  SISBOM_AUTH_URL: 'https://sisbom.invalid/api/login-ad',
  SISBOM_EXTERNAL_BASE_URL: 'https://sisbom.invalid/external',
  SISBOM_API_KEY: 'chave-de-teste',
};

describe('parseEnv — ALLOWED_ORIGINS', () => {
  it('produção sem ALLOWED_ORIGINS não sobe, e o erro nomeia a variável', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('produção com ALLOWED_ORIGINS vazia também não sobe', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: '  ,  ' })).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it('produção com a lista preenchida sobe e quebra a lista', () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://escalas.cbm.rn.gov.br, https://admin.cbm.rn.gov.br ',
    });
    expect(env.origins).toEqual(['https://escalas.cbm.rn.gov.br', 'https://admin.cbm.rn.gov.br']);
  });

  it('fora de produção, sem a env, usa o default de dev', () => {
    const env = parseEnv({ ...base, NODE_ENV: 'development' });
    expect(env.origins).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('fora de produção, a env explícita vence o default', () => {
    const env = parseEnv({ ...base, NODE_ENV: 'test', ALLOWED_ORIGINS: 'http://outro:1234' });
    expect(env.origins).toEqual(['http://outro:1234']);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @escalas/backend test -- env.test`
Expected: FAIL — `parseEnv` não é exportado por `config/env.ts` (erro de import/undefined).

- [ ] **Step 3: Reescrever `apps/backend/src/config/env.ts`**

Substituir o arquivo inteiro por:

```ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** Dev do Vite (5173) e preview do build (4173). */
const DEV_ORIGINS = 'http://localhost:5173,http://localhost:4173';

function splitOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    DATABASE_URL_TEST: z.string().url().optional(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'Formato inválido (use 30s, 15m, 8h, 7d)')
      .default('8h'),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'Formato inválido (use 30s, 15m, 8h, 7d)')
      .default('7d'),
    // Lista separada por vírgula. Obrigatória em produção (ver superRefine).
    ALLOWED_ORIGINS: z.string().optional(),
    SISBOM_AUTH_URL: z.string().url(),
    SISBOM_EXTERNAL_BASE_URL: z.string().url(),
    SISBOM_API_KEY: z.string().min(1),
    SYNC_INTERVAL_CRON: z.string().default('*/5 * * * *'),
    ADMIN_LOCAL_CPF: z.string().default('99999999900'),
    ADMIN_LOCAL_NOME: z.string().default('Admin Operacional Escalas'),
    ADMIN_LOCAL_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;
    if (splitOrigins(val.ALLOWED_ORIGINS ?? '').length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOWED_ORIGINS'],
        message:
          'ALLOWED_ORIGINS é obrigatória em produção (lista de origens separada por vírgula)',
      });
    }
  });

export type Env = z.infer<typeof envSchema> & { origins: string[] };

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(raw);
  // Em produção o superRefine já garantiu lista não-vazia; o default de dev
  // nunca vale lá, para não reabrir o buraco por acidente.
  const efetivo =
    parsed.ALLOWED_ORIGINS ?? (parsed.NODE_ENV === 'production' ? '' : DEV_ORIGINS);
  return { ...parsed, origins: splitOrigins(efetivo) };
}

export const env = parseEnv(process.env);
```

- [ ] **Step 4: Rodar o teste de unidade**

Run: `pnpm --filter @escalas/backend test -- env.test`
Expected: PASS, 5 testes.

- [ ] **Step 5: Escrever o teste de integração que falha**

Criar `apps/backend/src/tests/integration/cors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';

describe('CORS', () => {
  it('origem permitida recebe o header', async () => {
    const r = await request(buildApp()).get('/health').set('Origin', 'http://localhost:5173');
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('origem estranha não recebe o header', async () => {
    const r = await request(buildApp()).get('/health').set('Origin', 'http://invasor.invalid');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requisição sem Origin continua atendida (mobile, curl, healthcheck)', async () => {
    const r = await request(buildApp()).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `pnpm --filter @escalas/backend test -- cors.test`
Expected: FAIL no segundo teste — hoje `cors()` sem opções ecoa **qualquer** origem, então `access-control-allow-origin` vem preenchido para `invasor.invalid`.

> Se o segundo teste passar antes da mudança, pare: o teste não está discriminando e precisa ser corrigido antes de seguir.

- [ ] **Step 7: Fechar o CORS em `apps/backend/src/app.ts`**

Trocar as duas linhas:

```ts
  // TODO: restringir origin via env (ALLOWED_ORIGINS) antes de produção
  app.use(cors());
```

por:

```ts
  app.use(cors({ origin: env.origins }));
```

e acrescentar o import no topo do arquivo:

```ts
import { env } from './config/env.js';
```

- [ ] **Step 8: Rodar o teste de integração**

Run: `pnpm --filter @escalas/backend test -- cors.test`
Expected: PASS, 3 testes.

- [ ] **Step 9: Documentar a chave em `.env.example`**

Acrescentar, logo abaixo do bloco `JWT_*`:

```
# Origens permitidas pelo navegador, separadas por vírgula.
# OBRIGATÓRIA em produção: sem ela o backend recusa subir.
# Em dev, o default é http://localhost:5173,http://localhost:4173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

- [ ] **Step 10: Rodar a suíte inteira do backend**

Run: `pnpm --filter @escalas/backend test`
Expected: PASS. Baseline antes desta task: 291 testes. Depois: 299.

- [ ] **Step 11: Typecheck e lint**

Run: `pnpm typecheck && pnpm lint`
Expected: limpos, sem warning novo.

- [ ] **Step 12: Commit**

```bash
git add apps/backend/src/config/env.ts apps/backend/src/app.ts .env.example apps/backend/src/tests/unit/env.test.ts apps/backend/src/tests/integration/cors.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(backend): CORS por env, falhando fechado em produção

app.use(cors()) aceitava qualquer origem, com o TODO no lugar desde maio.
Agora a lista vem de ALLOWED_ORIGINS e, em produção, sua ausência impede o
boot — o erro aparece no deploy, não no navegador do usuário.

Requisição sem header Origin continua atendida: o app mobile (React Native)
não envia Origin, e restringir origem protege o navegador de terceiros, não
substitui a autenticação.

parseEnv extraída para a regra ser testável sem mexer em process.env.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CI no GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: a env `ALLOWED_ORIGINS` da Task 1 é **opcional** fora de produção, então o job não precisa declará-la. Nada mais.
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Criar `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: typecheck · lint · test · build
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: escalas
          POSTGRES_PASSWORD: escalas
          POSTGRES_DB: escalas_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U escalas -d escalas_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://escalas:escalas@localhost:5432/escalas_test?schema=public
      DATABASE_URL_TEST: postgresql://escalas:escalas@localhost:5432/escalas_test?schema=public
      JWT_SECRET: ci-jwt-secret-com-16-mais
      JWT_REFRESH_SECRET: ci-refresh-secret-com-16
      SISBOM_AUTH_URL: https://sisbom.invalid/api/login-ad
      SISBOM_EXTERNAL_BASE_URL: https://sisbom.invalid/external
      SISBOM_API_KEY: ci-chave-falsa

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Num monorepo pnpm o postinstall do @prisma/client não acha o schema,
      # e sem o client gerado o typecheck do backend não compila.
      - run: pnpm --filter @escalas/backend exec prisma generate

      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

Notas para quem executa:
- **Não** existe passo de migração: `apps/backend/src/tests/setup.ts` roda `prisma migrate deploy` no `beforeAll` usando `DATABASE_URL_TEST`.
- **Não** criar scripts `lint`/`typecheck`/`build` no `apps/mobile` só para preencher a matriz. O mobile declara apenas `test`; seu build é EAS e não pertence a este job.

- [ ] **Step 2: Reproduzir a sequência do CI na máquina**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: tudo verde. Se `pnpm build` falhar aqui, conserte **antes** de empurrar — não descubra pelo CI o que a máquina já sabia.

- [ ] **Step 3: Commit e push**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
🔨 chore(ci): pipeline no GitHub Actions

Job único em push na main e em pull request: typecheck, lint, testes e build
dos workspaces, com serviço postgres:16 para os testes de integração. O
setup.ts já roda prisma migrate deploy sozinho, então não há passo de migração.

prisma generate é explícito porque num monorepo pnpm o postinstall do
@prisma/client não encontra o schema.

Primeiro CI do projeto — até hoje nada rodava fora da máquina do dev.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 4: Verificar o job de verdade**

Run: `gh run watch` (ou `gh run list --limit 1`)
Expected: conclusão `success`.

> **Se ficar vermelho:** conserte a causa e faça commits novos até ficar verde. Um CI vermelho que se aceita como normal é pior do que não ter CI. Se a falha for nos testes do mobile (`jest-expo` fora desta máquina pela primeira vez), registre o erro exato e **pare para reportar** em vez de desligar o mobile em silêncio.

- [ ] **Step 5: Anotar o tempo do job**

Registre a duração do job verde no relatório da task. Se passar de ~10 minutos, isso é um achado a reportar — não otimize a suíte dentro deste ciclo.

---

### Task 3: Fixture determinística do E2E

**Files:**
- Create: `apps/backend/src/seeders/e2eFixture.ts` (função pura, sem efeito ao importar)
- Create: `apps/backend/src/seeders/e2e.seeder.ts` (runner de linha de comando)
- Modify: `apps/backend/package.json` (script `seed:e2e`)
- Modify: `.env.example`
- Test: `apps/backend/src/tests/integration/e2eFixture.test.ts` (criar)

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  ```ts
  export interface SeedE2EOpts { cpf: string; senha: string }
  export interface SeedE2EResult { userId: number; lotacaoId: number; templateId: number }
  export async function seedE2E(db: PrismaClient, opts: SeedE2EOpts): Promise<SeedE2EResult>
  ```
  A Task 4 depende do script `pnpm --filter @escalas/backend seed:e2e` existir e do usuário criado poder logar com `E2E_CPF` / `E2E_SENHA`.

**Por que dois arquivos:** os seeders atuais se auto-executam no import, então não dá para importá-los num teste sem escrever no banco de dev. Por isso a lógica mora numa função pura que recebe o `PrismaClient`, e o runner é uma casca. Isso também evita o vício do `patente.seeder.test.ts`, que **reimplementa** o seed dentro do teste e por isso testa o Prisma, não o seeder.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/tests/integration/e2eFixture.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { resetDb, testPrisma } from '../helpers/db.js';
import { seedE2E } from '../../seeders/e2eFixture.js';

const OPTS = { cpf: '00000000000', senha: 'escalante123' };

describe('fixture do E2E', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('cria escalante com senha local, lotação operacional e layout com vaga', async () => {
    const r = await seedE2E(testPrisma, OPTS);

    const user = await testPrisma.user.findUnique({ where: { cpf: OPTS.cpf } });
    expect(user?.ativo).toBe(true);
    expect(await bcrypt.compare(OPTS.senha, user!.senha_hash ?? '')).toBe(true);

    const lotacao = await testPrisma.lotacao.findUnique({ where: { id: r.lotacaoId } });
    expect(lotacao?.operacional).toBe(true);
    expect(lotacao?.sisbom_ref).toBe('e2e:lotacao');

    const papel = await testPrisma.userRole.findFirst({
      where: { user_id: r.userId, role: 'ESCALANTE', lotacao_id: r.lotacaoId },
    });
    expect(papel).not.toBeNull();

    const vagas = await testPrisma.templateVagaSugerida.count({
      where: { guarnicao: { template_lotacao_id: r.templateId } },
    });
    expect(vagas).toBeGreaterThan(0);
  });

  it('é idempotente: rodar duas vezes não duplica nada', async () => {
    const primeira = await seedE2E(testPrisma, OPTS);
    const segunda = await seedE2E(testPrisma, OPTS);

    expect(segunda).toEqual(primeira);
    expect(await testPrisma.user.count()).toBe(1);
    expect(await testPrisma.lotacao.count()).toBe(1);
    expect(await testPrisma.userRole.count()).toBe(1);
    expect(await testPrisma.templateLotacao.count()).toBe(1);
    expect(await testPrisma.templateGuarnicao.count()).toBe(1);
    expect(await testPrisma.templateVagaSugerida.count()).toBe(1);
  });

  it('troca a senha quando roda de novo com senha diferente', async () => {
    await seedE2E(testPrisma, OPTS);
    await seedE2E(testPrisma, { ...OPTS, senha: 'outra-senha-456' });

    const user = await testPrisma.user.findUnique({ where: { cpf: OPTS.cpf } });
    expect(await bcrypt.compare('outra-senha-456', user!.senha_hash ?? '')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @escalas/backend test -- e2eFixture`
Expected: FAIL — `../../seeders/e2eFixture.js` não existe.

- [ ] **Step 3: Escrever `apps/backend/src/seeders/e2eFixture.ts`**

```ts
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';

/**
 * Fixture determinística para o E2E. Não toca no SISBOM e não reusa
 * lotacoes.seeder.ts: aquele fabrica ids fixos que colidem com os ids reais
 * depois de um bulk do SISBOM. A chave natural aqui é sisbom_ref (@unique),
 * com o id ficando a cargo do autoincremento.
 */
export const E2E_LOTACAO_REF = 'e2e:lotacao';
export const E2E_TEMPLATE_NOME = 'Layout E2E';
export const E2E_GUARNICAO_SIGLA = 'GU-E2E';

export interface SeedE2EOpts {
  cpf: string;
  senha: string;
}

export interface SeedE2EResult {
  userId: number;
  lotacaoId: number;
  templateId: number;
}

export async function seedE2E(db: PrismaClient, opts: SeedE2EOpts): Promise<SeedE2EResult> {
  const dadosLotacao = {
    sigla: 'E2E',
    nome: 'Lotação de Teste E2E',
    nivel: 2,
    operacional: true,
    externo: false,
  };
  const lotacao = await db.lotacao.upsert({
    where: { sisbom_ref: E2E_LOTACAO_REF },
    update: dadosLotacao,
    create: { sisbom_ref: E2E_LOTACAO_REF, ...dadosLotacao },
  });

  const hash = await bcrypt.hash(opts.senha, 10);
  const dadosUser = {
    nome: 'Escalante E2E',
    senha_hash: hash,
    ativo: true,
    last_sync_at: new Date(),
  };
  const user = await db.user.upsert({
    where: { cpf: opts.cpf },
    update: dadosUser,
    create: { cpf: opts.cpf, ...dadosUser },
  });

  await db.userLotacao.upsert({
    where: { user_id_lotacao_id: { user_id: user.id, lotacao_id: lotacao.id } },
    update: { nivel: lotacao.nivel },
    create: { user_id: user.id, lotacao_id: lotacao.id, nivel: lotacao.nivel },
  });

  // É o UserRole com lotação que abre as telas do escalante — não is_super_admin.
  await db.userRole.upsert({
    where: {
      user_id_role_lotacao_id: { user_id: user.id, role: 'ESCALANTE', lotacao_id: lotacao.id },
    },
    update: {},
    create: { user_id: user.id, role: 'ESCALANTE', lotacao_id: lotacao.id, created_by: user.id },
  });

  const template = await db.templateLotacao.upsert({
    where: { lotacao_id_nome: { lotacao_id: lotacao.id, nome: E2E_TEMPLATE_NOME } },
    update: {},
    create: { lotacao_id: lotacao.id, nome: E2E_TEMPLATE_NOME, criado_por_id: user.id },
  });

  // TemplateGuarnicao e TemplateVagaSugerida não têm chave natural única no
  // schema, então a idempotência aqui é findFirst + create.
  const guarnicao =
    (await db.templateGuarnicao.findFirst({
      where: { template_lotacao_id: template.id, sigla: E2E_GUARNICAO_SIGLA },
    })) ??
    (await db.templateGuarnicao.create({
      data: {
        template_lotacao_id: template.id,
        sigla: E2E_GUARNICAO_SIGLA,
        atividade: 'PLANTAO',
        turno_padrao_inicio: '08:00',
        turno_padrao_fim: '08:00',
        ordem: 1,
      },
    }));

  const vaga = await db.templateVagaSugerida.findFirst({
    where: { template_guarnicao_id: guarnicao.id, funcao: 'COMANDANTE' },
  });
  if (!vaga) {
    await db.templateVagaSugerida.create({
      data: { template_guarnicao_id: guarnicao.id, funcao: 'COMANDANTE', quantidade_sugerida: 1 },
    });
  }

  return { userId: user.id, lotacaoId: lotacao.id, templateId: template.id };
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm --filter @escalas/backend test -- e2eFixture`
Expected: PASS, 3 testes.

- [ ] **Step 5: Escrever o runner `apps/backend/src/seeders/e2e.seeder.ts`**

```ts
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { seedE2E } from './e2eFixture.js';

async function run(): Promise<void> {
  const cpf = process.env.E2E_CPF ?? '00000000000';
  const senha = process.env.E2E_SENHA ?? 'escalante123';
  const r = await seedE2E(prisma, { cpf, senha });
  logger.info('seeder_e2e_done', { cpf, ...r });
}

run()
  .catch((e) => {
    logger.error('seeder_e2e_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Registrar o script em `apps/backend/package.json`**

Na seção `scripts`, logo depois de `"seed:patentes"`:

```json
    "seed:e2e": "tsx src/seeders/e2e.seeder.ts",
```

- [ ] **Step 7: Documentar as envs em `.env.example`**

Acrescentar ao fim do arquivo:

```
# Credenciais da fixture do E2E (pnpm --filter @escalas/backend seed:e2e).
# O mesmo par é lido pelo apps/web/e2e/escalante.spec.ts.
E2E_CPF=00000000000
E2E_SENHA=escalante123
```

- [ ] **Step 8: Rodar o seeder de verdade contra o banco de dev**

Run: `pnpm --filter @escalas/backend seed:e2e && pnpm --filter @escalas/backend seed:e2e`
Expected: `seeder_e2e_done` duas vezes, com **os mesmos ids** nas duas execuções. Isso prova a idempotência fora do ambiente de teste.

- [ ] **Step 9: Suíte, typecheck e lint**

Run: `pnpm --filter @escalas/backend test && pnpm typecheck && pnpm lint`
Expected: PASS (299 + 3 = 302 testes de backend), limpos.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/seeders/e2eFixture.ts apps/backend/src/seeders/e2e.seeder.ts apps/backend/src/tests/integration/e2eFixture.test.ts apps/backend/package.json .env.example
git commit -m "$(cat <<'EOF'
✨ feat(seed): fixture determinística para o E2E

O escalante.spec.ts declara desde maio que precisa de "seed idempotente com um
escalante, uma lotação operacional e papel ESCALANTE" — e esse seed nunca
existiu, que é o motivo real de o E2E nunca ter rodado.

A lógica mora numa função pura que recebe o PrismaClient, com o runner como
casca: os seeders atuais se auto-executam no import e por isso não podem ser
testados sem escrever no banco de dev.

Lotação por sisbom_ref 'e2e:lotacao' em vez de reusar lotacoes.seeder.ts, cujos
ids fixos colidem com os reais depois de um bulk do SISBOM.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: O E2E rodando de verdade

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Modify: `README.md`
- Possivelmente modify: `apps/web/e2e/escalante.spec.ts` e/ou arquivos de `apps/web/src` (ver regra de triagem)

**Interfaces:**
- Consumes: da Task 3, o script `pnpm --filter @escalas/backend seed:e2e` e o par `E2E_CPF` / `E2E_SENHA`.
- Produces: nada consumido depois.

**Regra de triagem (trancada na spec — leia antes do Step 3):**

| O que o spec espera | O que o app faz | Decisão |
|---|---|---|
| Comportamento correto | Diverge | **É bug do app.** Conserta o app, com teste que primeiro falha. |
| Comportamento obsoleto (fluxo mudou de propósito) | Diverge | Atualiza o spec, e **explica no commit** por que o comportamento novo é o certo. |
| Seletor frágil (ex.: `getByText('15')`) achando outro elemento | Igual | Endurece o seletor, sem afrouxar a asserção. |

Nunca relaxar uma asserção (`toBeVisible` → `toBeAttached`, remover um passo) para o teste passar.

- [ ] **Step 1: Subir backend e web no config do Playwright**

Em `apps/web/playwright.config.ts`, trocar o `webServer` objeto por lista:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: 'pnpm --filter @escalas/backend dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 60_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
```

- [ ] **Step 2: Preparar o ambiente**

Run:
```bash
docker compose up -d postgres || echo "Postgres já rodando fora do compose — siga"
pnpm --filter @escalas/backend prisma:migrate
pnpm --filter @escalas/backend seed:e2e
```
Expected: migrations aplicadas e `seeder_e2e_done`.

> Se o Docker não estiver disponível nesta máquina (é o caso conhecido), use o Postgres local já usado no dev — o `DATABASE_URL` do `.env` aponta para ele.

- [ ] **Step 3: Rodar o E2E pela primeira vez na história do projeto**

Run: `pnpm --filter @escalas/web e2e`
Expected: **desconhecido.** Registre a saída completa — passos que passaram, o passo que falhou, e a mensagem exata. Este é o dado que a task existe para produzir.

- [ ] **Step 4: Triar cada falha pela tabela acima**

Para cada falha, escreva uma linha no relatório: sintoma → classificação (bug do app / spec obsoleto / seletor frágil) → correção escolhida. Só então conserte.

- [ ] **Step 5: Se a classificação for "bug do app", escrever o teste primeiro**

Um bug encontrado pelo E2E ganha um teste unitário ou de integração no nível certo (`apps/web/src/**/*.test.tsx` ou `apps/backend/src/tests/**`), que falha antes da correção. O E2E prova o fluxo; o teste rápido é quem impede a regressão voltar.

- [ ] **Step 6: Rodar de novo até verde**

Run: `pnpm --filter @escalas/web e2e`
Expected: PASS, 1 teste.

> **Orçamento: uma onda de correção.** Se depois de uma rodada de correções o spec ainda estiver vermelho por motivo novo e diferente, **pare** e reporte o estado com a lista de achados. Não entre em ciclo de tentativa e erro contra o app.

- [ ] **Step 7: Documentar o comando no `README.md`**

Acrescentar uma seção:

```markdown
## E2E (Playwright)

Pré-requisito: Postgres no ar (o `DATABASE_URL` do `.env`).

```bash
pnpm --filter @escalas/backend prisma:migrate   # uma vez
pnpm --filter @escalas/backend seed:e2e         # fixture idempotente do escalante
pnpm --filter @escalas/web e2e                  # sobe backend + web e roda o spec
```

As credenciais vêm de `E2E_CPF` / `E2E_SENHA` (ver `.env.example`).
O E2E ainda **não** roda no CI — promovê-lo é tarefa do go-live.
```

- [ ] **Step 8: Suítes, typecheck e lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add apps/web/playwright.config.ts README.md
git add -u
git commit -m "$(cat <<'EOF'
✅ test(e2e): o escalante.spec.ts passa a rodar de verdade

Escrito em maio, nunca executado. O Playwright agora sobe backend e web num
comando só (webServer aceita lista), deixando o Postgres como único
pré-requisito externo.

[substituir por: o que a primeira execução revelou e como foi classificado]

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Tag v0.5.0-escalas

**Files:** nenhum arquivo alterado.

**Interfaces:**
- Consumes: as Tasks 1 a 4 completas, na `main`, com tudo verde.
- Produces: a tag `v0.5.0-escalas` em `origin`.

- [ ] **Step 1: Confirmar que a árvore está limpa e sincronizada**

Run: `git status --short --branch`
Expected: `## main...origin/main` sem divergência e sem arquivo modificado. Se houver commit local não empurrado, `git push origin main` antes de seguir.

- [ ] **Step 2: Rodar a verificação final**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tudo verde. **Não taggear com suíte vermelha.**

- [ ] **Step 3: Levantar o que entrou desde a v0.4.0**

Run: `git log --oneline v0.4.0-escalas..HEAD | wc -l && git log --pretty='%s' v0.4.0-escalas..HEAD`
Expected: a contagem (~150) e a lista, para o corpo da tag ser escrito da fonte e não de memória.

- [ ] **Step 4: Criar a tag anotada**

```bash
git tag -a v0.5.0-escalas -m "$(cat <<'EOF'
v0.5.0-escalas

Primeira tag desde 22/05. Fecha a lacuna em que todo o sistema que existe hoje
foi construído sem versionar.

Entrou desde a v0.4.0:
- Execução e fiscalização (papel FISCAL, máquina de estados por dia)
- Mobile militar (próximo serviço, 7 dias, calendário)
- Aprovação do gestor e validação de escala
- Feriados (modelo, util e CRUD)
- Sync de lotações e militares do SISBOM
- Layouts múltiplos nomeados e diária operacional
- Ciclo 2: geração em bloco 24x72, elegibilidade por patente, motor de
  preenchimento por equidade, política de localidade (rodizia/fixa)
- Ciclo 3: CORS por env falhando fechado, CI no GitHub Actions, E2E rodando

Ainda sem usuários em produção.
EOF
)"
```

- [ ] **Step 5: Empurrar a tag**

Run: `git push origin v0.5.0-escalas`
Expected: `* [new tag] v0.5.0-escalas -> v0.5.0-escalas`

- [ ] **Step 6: Conferir**

Run: `git tag --sort=-creatordate | head -3 && git ls-remote --tags origin | grep v0.5.0`
Expected: a tag no topo da lista local e presente no remoto.

---

## Verificação final do plano

Antes de declarar o ciclo fechado, confirmar contra os critérios de aceite da spec:

1. `NODE_ENV=production` sem `ALLOWED_ORIGINS` impede o boot, com mensagem nomeando a variável — Task 1, Steps 1-4.
2. `.github/workflows/ci.yml` verde na `main` — Task 2, Step 4.
3. `escalante.spec.ts` passando localmente, com comando documentado — Task 4, Steps 6-7.
4. Tag `v0.5.0-escalas` criada e empurrada — Task 5.
5. Sem regressão: `pnpm test && pnpm typecheck && pnpm lint` verdes — Task 5, Step 2.

Achados que **não** couberem no ciclo (duração do CI, defeitos revelados pelo E2E além do orçamento de uma onda) vão para o relatório final, não para dentro do escopo.
