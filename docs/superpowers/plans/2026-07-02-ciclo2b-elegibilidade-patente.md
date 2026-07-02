# Ciclo 2b.1 — Elegibilidade por Patente (aviso soft) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sinalizar (sem bloquear) quando a patente de um militar não condiz com a esperada para a função da vaga, resolvendo as patentes esperadas por uma cascata catálogo layout→lotação→global.

**Architecture:** Réplica local estática da tabela `Patente` do SISBOM (id = `_patente`); o sync passa a gravar `User.patente_id`. Uma tabela única `FuncaoPatente` guarda as três camadas da cascata (global/lotação/layout) via colunas `lotacao_id?`/`template_id?` — a existência da linha = "regra existe". Um service resolve as esperadas por função normalizada; os endpoints do dia e de militares expõem os campos; a web destaca no picker e avisa no editor. Nunca bloqueia salvar.

**Tech Stack:** Node 20 + TypeScript ESM, Express, Prisma + PostgreSQL 16, Zod, Vitest (integração com Postgres de teste); React 18 + Vite + TanStack + Mantine 7 + Vitest/RTL/MSW.

## Global Constraints

- **Spec (fonte da verdade):** `docs/superpowers/specs/2026-07-02-ciclo2b-elegibilidade-patente-design.md`.
- **Aviso é SEMPRE soft** — nunca vira erro; `putDia` salva mesmo com divergência. A validação de conflito de turno existente (bloqueante) permanece intacta.
- **Escopo deste plano = 2b.1.** A camada LAYOUT (`FuncaoPatente.template_id`) já é resolvida pelo service, mas **não há UI** para criá-la aqui (fica no 2b.2). O CRUD deste slice cobre só Global e Lotação (`template_id` sempre null).
- **Sem shadow DB:** migration = SQL à mão em `prisma/migrations/<timestamp>_0011_patente_elegibilidade/migration.sql`, aplicada com `npx prisma migrate deploy` em **dev E test** (`DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy`), depois `npx prisma generate`. Nunca `migrate dev`.
- **Prisma não suporta scalar list opcional** (`Int[]?` é inválido). `patente_ids Int[]` é não-nulo (default `[]`); `[]` numa regra = "silencia o aviso".
- **ESM:** imports com sufixo `.js`; 2 espaços; resposta `{success, message, data}`; rotas `/api/v1/` em pt-BR snake_case.
- **Normalização de função:** `normalizeFuncao` = UPPER + trim + colapso de espaços + remoção de acentos (NFD). Toda comparação por função usa isso.
- **Repo `escalas`:** sempre `main`, commit direto; push só sob ordem explícita.
- Ao fim de cada task: `npm run typecheck` e `npm run lint` no `apps/backend` (ou `apps/web`); `npm test` nas tasks com testes. Comandos rodam de `C:\Users\CTIC\Desktop\escalas\apps\backend` (ou `apps\web`).

---

### Task 1: Modelos `Patente` + `FuncaoPatente` + migration 0011 + seeder de Patente

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (models `Patente`, `FuncaoPatente`; campos em `User`, `Lotacao`, `TemplateLotacao`)
- Create: `apps/backend/prisma/migrations/<timestamp>_0011_patente_elegibilidade/migration.sql`
- Create: `apps/backend/src/seeders/data/patentes.json`
- Create: `apps/backend/src/seeders/patentes.seeder.ts`
- Modify: `apps/backend/package.json` (script `seed:patentes`)
- Test: `apps/backend/src/tests/integration/patente.seeder.test.ts`

**Interfaces:**
- Produces: model `Patente { id, forca_id, sigla, nome, ordem }`; `User.patente_id Int?` (+relation); model `FuncaoPatente { id, lotacao_id?, template_id?, funcao_norm, patente_ids Int[] }`; `pnpm --filter backend seed:patentes` idempotente.

- [ ] **Step 1: Editar o schema Prisma**

Em `apps/backend/prisma/schema.prisma`, adicionar os dois models novos (no fim do arquivo):

```prisma
model Patente {
  id        Int    @id
  forca_id  Int
  sigla     String
  nome      String
  ordem     Int
  militares User[]
}

model FuncaoPatente {
  id          Int              @id @default(autoincrement())
  lotacao_id  Int?
  template_id Int?
  funcao_norm String
  patente_ids Int[]
  lotacao     Lotacao?         @relation(fields: [lotacao_id], references: [id], onDelete: Cascade)
  template    TemplateLotacao? @relation(fields: [template_id], references: [id], onDelete: Cascade)
}
```

No model `User`, após `posto String?`, adicionar:
```prisma
  patente_id         Int?
  patente            Patente?          @relation(fields: [patente_id], references: [id])
```

No model `Lotacao`, adicionar (junto das outras relações):
```prisma
  funcao_patentes    FuncaoPatente[]
```

No model `TemplateLotacao`, adicionar (junto das outras relações):
```prisma
  funcao_patentes    FuncaoPatente[]
```

- [ ] **Step 2: Escrever a migration SQL**

Criar `apps/backend/prisma/migrations/<timestamp>_0011_patente_elegibilidade/migration.sql` (gerar `<timestamp>` com `date +%Y%m%d%H%M%S`):

```sql
-- Réplica local estática das patentes do SISBOM (id = _patente).
CREATE TABLE "Patente" (
  "id"       INTEGER NOT NULL,
  "forca_id" INTEGER NOT NULL,
  "sigla"    TEXT    NOT NULL,
  "nome"     TEXT    NOT NULL,
  "ordem"    INTEGER NOT NULL,
  CONSTRAINT "Patente_pkey" PRIMARY KEY ("id")
);

-- Patente do militar (vinda do sync SISBOM).
ALTER TABLE "User" ADD COLUMN "patente_id" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_patente_id_fkey"
  FOREIGN KEY ("patente_id") REFERENCES "Patente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cascata de elegibilidade (global/lotação/layout numa tabela só).
CREATE TABLE "FuncaoPatente" (
  "id"          SERIAL   NOT NULL,
  "lotacao_id"  INTEGER,
  "template_id" INTEGER,
  "funcao_norm" TEXT     NOT NULL,
  "patente_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  CONSTRAINT "FuncaoPatente_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "FuncaoPatente" ADD CONSTRAINT "FuncaoPatente_lotacao_id_fkey"
  FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuncaoPatente" ADD CONSTRAINT "FuncaoPatente_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "TemplateLotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unicidade por escopo via índices únicos parciais (NULL não deduplica em UNIQUE comum).
CREATE UNIQUE INDEX "FuncaoPatente_global_uq" ON "FuncaoPatente" ("funcao_norm")
  WHERE "lotacao_id" IS NULL AND "template_id" IS NULL;
CREATE UNIQUE INDEX "FuncaoPatente_lotacao_uq" ON "FuncaoPatente" ("lotacao_id", "funcao_norm")
  WHERE "lotacao_id" IS NOT NULL AND "template_id" IS NULL;
CREATE UNIQUE INDEX "FuncaoPatente_layout_uq" ON "FuncaoPatente" ("template_id", "funcao_norm")
  WHERE "template_id" IS NOT NULL;
```

- [ ] **Step 3: Aplicar em dev e test + gerar client**

```bash
npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
npx prisma generate
```
Esperado: "1 migration applied" em cada DB; generate OK. (Se o Prisma travar a DLL no Windows, pare o dev server antes do generate.)

- [ ] **Step 4: Criar o arquivo de dados das patentes**

Criar `apps/backend/src/seeders/data/patentes.json` (fonte: array `patentes()` de `sisbom-api/src/api_sisbom/graphql/_models/resources.js`; `ordem` = posição 1-based dentro da força):

```json
[
  {"id":1,"forca_id":0,"sigla":"CEL","nome":"Coronel","ordem":1},
  {"id":2,"forca_id":0,"sigla":"TC","nome":"Tenente Coronel","ordem":2},
  {"id":3,"forca_id":0,"sigla":"MAJ","nome":"Major","ordem":3},
  {"id":4,"forca_id":0,"sigla":"CAP","nome":"Capitão","ordem":4},
  {"id":5,"forca_id":0,"sigla":"1º TEN","nome":"1º Tenente","ordem":5},
  {"id":6,"forca_id":0,"sigla":"2º TEN","nome":"2º Tenente","ordem":6},
  {"id":7,"forca_id":0,"sigla":"ASP OF","nome":"Aspirante a Oficial","ordem":7},
  {"id":8,"forca_id":0,"sigla":"AL OF3","nome":"Aluno Oficial de 3º Ano","ordem":8},
  {"id":9,"forca_id":0,"sigla":"AL OF2","nome":"Aluno Oficial de 2º Ano","ordem":9},
  {"id":10,"forca_id":0,"sigla":"AL OF1","nome":"Aluno Oficial de 1º Ano","ordem":10},
  {"id":11,"forca_id":0,"sigla":"ST","nome":"Sub Tenente","ordem":11},
  {"id":12,"forca_id":0,"sigla":"1º SGT","nome":"1º Sargento","ordem":12},
  {"id":13,"forca_id":0,"sigla":"2º SGT","nome":"2º Sargento","ordem":13},
  {"id":14,"forca_id":0,"sigla":"3º SGT","nome":"3º Sargento","ordem":14},
  {"id":15,"forca_id":0,"sigla":"AL SGT","nome":"Aluno Sargento","ordem":15},
  {"id":16,"forca_id":0,"sigla":"CB","nome":"Cabo","ordem":16},
  {"id":17,"forca_id":0,"sigla":"SD","nome":"Soldado","ordem":17},
  {"id":18,"forca_id":0,"sigla":"AL CFP","nome":"Aluno CFP","ordem":18},
  {"id":19,"forca_id":1,"sigla":"CEL","nome":"Coronel","ordem":1},
  {"id":20,"forca_id":1,"sigla":"TC","nome":"Tenente Coronel","ordem":2},
  {"id":21,"forca_id":1,"sigla":"MAJ","nome":"Major","ordem":3},
  {"id":22,"forca_id":1,"sigla":"CAP","nome":"Capitão","ordem":4},
  {"id":23,"forca_id":1,"sigla":"1º TEN","nome":"1º Tenente","ordem":5},
  {"id":24,"forca_id":1,"sigla":"2º TEN","nome":"2º Tenente","ordem":6},
  {"id":25,"forca_id":1,"sigla":"ASP OF","nome":"Aspirante a Oficial","ordem":7},
  {"id":26,"forca_id":1,"sigla":"AL OF3","nome":"Aluno Oficial de 3º Ano","ordem":8},
  {"id":27,"forca_id":1,"sigla":"AL OF2","nome":"Aluno Oficial de 2º Ano","ordem":9},
  {"id":28,"forca_id":1,"sigla":"AL OF1","nome":"Aluno Oficial de 1º Ano","ordem":10},
  {"id":29,"forca_id":1,"sigla":"ST","nome":"Sub Tenente","ordem":11},
  {"id":30,"forca_id":1,"sigla":"1º SGT","nome":"1º Sargento","ordem":12},
  {"id":31,"forca_id":1,"sigla":"2º SGT","nome":"2º Sargento","ordem":13},
  {"id":32,"forca_id":1,"sigla":"3º SGT","nome":"3º Sargento","ordem":14},
  {"id":33,"forca_id":1,"sigla":"AL SGT","nome":"Aluno Sargento","ordem":15},
  {"id":34,"forca_id":1,"sigla":"CB","nome":"Cabo","ordem":16},
  {"id":35,"forca_id":1,"sigla":"SD","nome":"Soldado","ordem":17},
  {"id":36,"forca_id":1,"sigla":"AL SD","nome":"Aluno Soldado","ordem":18},
  {"id":37,"forca_id":2,"sigla":"CEL","nome":"Coronel","ordem":1},
  {"id":38,"forca_id":2,"sigla":"TC","nome":"Tenente Coronel","ordem":2},
  {"id":39,"forca_id":2,"sigla":"MAJ","nome":"Major","ordem":3},
  {"id":40,"forca_id":2,"sigla":"CAP","nome":"Capitão","ordem":4},
  {"id":41,"forca_id":2,"sigla":"1º TEN","nome":"1º Tenente","ordem":5},
  {"id":42,"forca_id":2,"sigla":"2º TEN","nome":"2º Tenente","ordem":6},
  {"id":43,"forca_id":2,"sigla":"ASP OF","nome":"Aspirante a Oficial","ordem":7},
  {"id":44,"forca_id":2,"sigla":"AL OF3","nome":"Aluno Oficial de 3º Ano","ordem":8},
  {"id":45,"forca_id":2,"sigla":"AL OF2","nome":"Aluno Oficial de 2º Ano","ordem":9},
  {"id":46,"forca_id":2,"sigla":"AL OF1","nome":"Aluno Oficial de 1º Ano","ordem":10},
  {"id":47,"forca_id":2,"sigla":"ST","nome":"Sub Tenente","ordem":11},
  {"id":48,"forca_id":2,"sigla":"1º SGT","nome":"1º Sargento","ordem":12},
  {"id":49,"forca_id":2,"sigla":"2º SGT","nome":"2º Sargento","ordem":13},
  {"id":50,"forca_id":2,"sigla":"3º SGT","nome":"3º Sargento","ordem":14},
  {"id":51,"forca_id":2,"sigla":"AL SGT","nome":"Aluno Sargento","ordem":15},
  {"id":52,"forca_id":2,"sigla":"CB","nome":"Cabo","ordem":16},
  {"id":53,"forca_id":2,"sigla":"SD","nome":"Soldado","ordem":17},
  {"id":54,"forca_id":2,"sigla":"AL SD","nome":"Aluno Soldado","ordem":18},
  {"id":55,"forca_id":3,"sigla":"CEL","nome":"Coronel","ordem":1},
  {"id":56,"forca_id":3,"sigla":"TC","nome":"Tenente Coronel","ordem":2},
  {"id":57,"forca_id":3,"sigla":"MAJ","nome":"Major","ordem":3},
  {"id":58,"forca_id":3,"sigla":"CAP","nome":"Capitão","ordem":4},
  {"id":59,"forca_id":3,"sigla":"1º TEN","nome":"1º Tenente","ordem":5},
  {"id":60,"forca_id":3,"sigla":"2º TEN","nome":"2º Tenente","ordem":6},
  {"id":61,"forca_id":3,"sigla":"ASP OF","nome":"Aspirante a Oficial","ordem":7},
  {"id":62,"forca_id":3,"sigla":"AL OF3","nome":"Aluno Oficial de 3º Ano","ordem":8},
  {"id":63,"forca_id":3,"sigla":"AL OF2","nome":"Aluno Oficial de 2º Ano","ordem":9},
  {"id":64,"forca_id":3,"sigla":"AL OF1","nome":"Aluno Oficial de 1º Ano","ordem":10},
  {"id":65,"forca_id":3,"sigla":"ST","nome":"Sub Tenente","ordem":11},
  {"id":66,"forca_id":3,"sigla":"1º SGT","nome":"1º Sargento","ordem":12},
  {"id":67,"forca_id":3,"sigla":"2º SGT","nome":"2º Sargento","ordem":13},
  {"id":68,"forca_id":3,"sigla":"3º SGT","nome":"3º Sargento","ordem":14},
  {"id":69,"forca_id":3,"sigla":"AL SGT","nome":"Aluno Sargento","ordem":15},
  {"id":70,"forca_id":3,"sigla":"CB","nome":"Cabo","ordem":16},
  {"id":71,"forca_id":3,"sigla":"SD","nome":"Soldado","ordem":17},
  {"id":72,"forca_id":3,"sigla":"AL CFP","nome":"Aluno CFP","ordem":18}
]
```

- [ ] **Step 5: Escrever o seeder** (segue o padrão de `lotacoes.seeder.ts`)

Criar `apps/backend/src/seeders/patentes.seeder.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

interface PatenteData {
  id: number;
  forca_id: number;
  sigla: string;
  nome: string;
  ordem: number;
}

async function run(): Promise<void> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(dir, 'data/patentes.json'), 'utf-8');
  const patentes: PatenteData[] = JSON.parse(raw);

  for (const p of patentes) {
    await prisma.patente.upsert({ where: { id: p.id }, update: p, create: p });
  }

  logger.info('seeder_patentes_done', { total: patentes.length });
}

run()
  .catch((e) => {
    logger.error('seeder_patentes_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Adicionar o script npm**

Em `apps/backend/package.json`, dentro de `"scripts"`, após `"seed:admin-local"`:
```json
    "seed:patentes": "tsx src/seeders/patentes.seeder.ts",
```

- [ ] **Step 7: Rodar o seeder em dev**

```bash
npm run seed:patentes
```
Esperado: log `seeder_patentes_done` com `total: 72`.

- [ ] **Step 8: Teste de idempotência do seed**

Criar `apps/backend/src/tests/integration/patente.seeder.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';

async function seed() {
  const patentes = [
    { id: 12, forca_id: 0, sigla: '1º SGT', nome: '1º Sargento', ordem: 12 },
    { id: 17, forca_id: 0, sigla: 'SD', nome: 'Soldado', ordem: 17 },
  ];
  for (const p of patentes) {
    await testPrisma.patente.upsert({ where: { id: p.id }, update: p, create: p });
  }
}

describe('seed de Patente', () => {
  beforeEach(async () => { await resetDb(); });

  it('é idempotente (rodar 2x mantém a contagem)', async () => {
    await seed();
    await seed();
    expect(await testPrisma.patente.count()).toBe(2);
    const sd = await testPrisma.patente.findUnique({ where: { id: 17 } });
    expect(sd!.sigla).toBe('SD');
  });
});
```

- [ ] **Step 9: Rodar + typecheck + lint + commit**

```bash
npm test -- patente.seeder && npm run typecheck && npm run lint
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/seeders/patentes.seeder.ts apps/backend/src/seeders/data/patentes.json apps/backend/package.json apps/backend/src/tests/integration/patente.seeder.test.ts
git commit -m "✨ feat(patente): tabela Patente + FuncaoPatente + migration 0011 + seeder"
```

---

### Task 2: Sync grava `patente_id`

**Files:**
- Modify: `apps/backend/src/services/user.service.ts` (`upsertFromSisbom`, ~linha 42-51)
- Test: `apps/backend/src/tests/integration/user.service.test.ts` (adicionar caso; criar se não existir)

**Interfaces:**
- Consumes: `Patente`, `User.patente_id` (Task 1).
- Produces: militar sincronizado com `patente_id = Number(data._patente)` (ou null).

- [ ] **Step 1: Escrever o teste (falhando)**

Em `apps/backend/src/tests/integration/user.service.test.ts`, adicionar (importe `resetDb, testPrisma` de `../helpers/db.js` e `userService` de `../../services/user.service.js` se o arquivo for novo):

```ts
it('upsertFromSisbom grava patente_id do _patente', async () => {
  await resetDb();
  await testPrisma.patente.create({ data: { id: 12, forca_id: 0, sigla: '1º SGT', nome: '1º Sargento', ordem: 12 } });
  await userService.upsertFromSisbom(
    { _id: 'sis-1', str_cpf: '11122233344', pessoa: { str_nome: 'Fulano' }, _patente: 12, _lotacao: '', ativo: true },
    new Date(),
    testPrisma,
  );
  const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'sis-1' } });
  expect(u!.patente_id).toBe(12);
});

it('upsertFromSisbom deixa patente_id null quando _patente ausente', async () => {
  await resetDb();
  await userService.upsertFromSisbom(
    { _id: 'sis-2', str_cpf: '55566677788', pessoa: { str_nome: 'Beltrano' }, _lotacao: '', ativo: true },
    new Date(),
    testPrisma,
  );
  const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'sis-2' } });
  expect(u!.patente_id).toBeNull();
});
```

- [ ] **Step 2: Rodar — verificar que falha**

```bash
npm test -- user.service
```
Esperado: FAIL (`patente_id` vem null no 1º caso).

- [ ] **Step 3: Implementar**

Em `apps/backend/src/services/user.service.ts`, dentro do objeto `payload` de `upsertFromSisbom` (após `sisbom_lotacao_ref: lotacaoRef || null,`), adicionar:

```ts
      patente_id: data._patente != null ? Number(data._patente) : null,
```

- [ ] **Step 4: Rodar — verificar que passa + typecheck + lint + commit**

```bash
npm test -- user.service && npm run typecheck && npm run lint
git add apps/backend/src/services/user.service.ts apps/backend/src/tests/integration/user.service.test.ts
git commit -m "✨ feat(sync): grava patente_id do militar vindo do SISBOM"
```

---

### Task 3: `normalizeFuncao` + `patenteService.esperadasPara` + `patenteDivergente`

**Files:**
- Create: `apps/backend/src/utils/funcao.ts`
- Create: `apps/backend/src/services/patente.service.ts`
- Test: `apps/backend/src/tests/unit/funcao.test.ts`
- Test: `apps/backend/src/tests/integration/patente.service.test.ts`

**Interfaces:**
- Consumes: `FuncaoPatente`, `TemplateLotacao` (Task 1).
- Produces:
  - `normalizeFuncao(s: string): string`
  - `patenteService.esperadasPara(funcao: string, lotacao_id: number, template_id: number | null, prisma): Promise<number[] | null>` (null = sem regra)
  - `patenteService.patenteDivergente(patente_id: number | null, esperadas: number[] | null): boolean`

- [ ] **Step 1: Escrever o util + teste do util**

Criar `apps/backend/src/utils/funcao.ts`:

```ts
// Normaliza uma função para comparação: caixa alta, sem acento, espaços colapsados.
export function normalizeFuncao(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}
```

Criar `apps/backend/src/tests/unit/funcao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeFuncao } from '../../utils/funcao.js';

describe('normalizeFuncao', () => {
  it('iguala caixa, acento e espaços', () => {
    expect(normalizeFuncao('Comandante')).toBe('COMANDANTE');
    expect(normalizeFuncao('  socorrista ')).toBe('SOCORRISTA');
    expect(normalizeFuncao('Auxílio  Médico')).toBe('AUXILIO MEDICO');
  });
});
```

- [ ] **Step 2: Rodar o teste do util**

```bash
npm test -- funcao
```
Esperado: PASS.

- [ ] **Step 3: Escrever o teste do service (falhando)**

Criar `apps/backend/src/tests/integration/patente.service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { patenteService } from '../../services/patente.service.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 900, sigla: 'L900', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM900', nome: 'Adm', last_sync_at: new Date() } });
  const tpl = await testPrisma.templateLotacao.create({ data: { lotacao_id: lot.id, nome: 'P', criado_por_id: admin.id } });
  return { lot, tpl };
}

describe('patenteService.esperadasPara (cascata)', () => {
  beforeEach(async () => { await resetDb(); });

  it('sem regra em nenhuma camada → null', async () => {
    const { lot, tpl } = await cenario();
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toBeNull();
  });

  it('global aplica quando não há lotação/layout', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12, 13] } });
    expect(await patenteService.esperadasPara('comandante', lot.id, tpl.id, testPrisma)).toEqual([12, 13]);
  });

  it('lotação vence global', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    await testPrisma.funcaoPatente.create({ data: { lotacao_id: lot.id, funcao_norm: 'COMANDANTE', patente_ids: [4, 5] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toEqual([4, 5]);
  });

  it('layout vence lotação e global', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    await testPrisma.funcaoPatente.create({ data: { lotacao_id: lot.id, funcao_norm: 'COMANDANTE', patente_ids: [4, 5] } });
    await testPrisma.funcaoPatente.create({ data: { template_id: tpl.id, funcao_norm: 'COMANDANTE', patente_ids: [4] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toEqual([4]);
  });

  it('template_id null ignora a camada layout', async () => {
    const { lot } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, null, testPrisma)).toEqual([12]);
  });

  it('divergente: null quando não há regra; false quando bate; true quando não bate ou sem patente', () => {
    expect(patenteService.patenteDivergente(12, null)).toBe(false);
    expect(patenteService.patenteDivergente(12, [])).toBe(false);
    expect(patenteService.patenteDivergente(12, [12, 13])).toBe(false);
    expect(patenteService.patenteDivergente(99, [12, 13])).toBe(true);
    expect(patenteService.patenteDivergente(null, [12, 13])).toBe(true);
  });
});
```

- [ ] **Step 4: Rodar — verificar que falha**

```bash
npm test -- patente.service
```
Esperado: FAIL (service não existe).

- [ ] **Step 5: Implementar o service**

Criar `apps/backend/src/services/patente.service.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import { normalizeFuncao } from '../utils/funcao.js';

export const patenteService = {
  // Resolve as patentes esperadas pela cascata layout → lotação → global. null = sem regra.
  async esperadasPara(
    funcao: string,
    lotacao_id: number,
    template_id: number | null,
    prisma: PrismaClient,
  ): Promise<number[] | null> {
    const funcao_norm = normalizeFuncao(funcao);

    if (template_id != null) {
      const layout = await prisma.funcaoPatente.findFirst({ where: { template_id, funcao_norm } });
      if (layout) return layout.patente_ids;
    }
    const daLotacao = await prisma.funcaoPatente.findFirst({
      where: { lotacao_id, template_id: null, funcao_norm },
    });
    if (daLotacao) return daLotacao.patente_ids;

    const global = await prisma.funcaoPatente.findFirst({
      where: { lotacao_id: null, template_id: null, funcao_norm },
    });
    if (global) return global.patente_ids;

    return null;
  },

  // Divergência = existe regra não-vazia e a patente do militar não está nela (ou é null).
  patenteDivergente(patente_id: number | null, esperadas: number[] | null): boolean {
    if (!esperadas || esperadas.length === 0) return false;
    return patente_id == null || !esperadas.includes(patente_id);
  },
};
```

- [ ] **Step 6: Rodar — verificar que passa + typecheck + lint + commit**

```bash
npm test -- patente.service funcao && npm run typecheck && npm run lint
git add apps/backend/src/utils/funcao.ts apps/backend/src/services/patente.service.ts apps/backend/src/tests/unit/funcao.test.ts apps/backend/src/tests/integration/patente.service.test.ts
git commit -m "✨ feat(patente): normalizeFuncao + esperadasPara (cascata) + patenteDivergente"
```

---

### Task 4: API de configuração — listar patentes + CRUD de `FuncaoPatente` + listar lotações

**Files:**
- Create: `packages/shared-types/src/patente.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-schemas/src/funcaoPatente.schemas.ts`
- Modify: `packages/shared-schemas/src/index.ts`
- Create: `apps/backend/src/services/funcaoPatente.service.ts`
- Modify: `apps/backend/src/services/patente.service.ts` (adicionar `listarTodas`)
- Create: `apps/backend/src/controllers/funcaoPatente.controller.ts`
- Create: `apps/backend/src/routes/funcaoPatente.routes.ts`
- Modify: `apps/backend/src/routes/index.ts` (montar rotas)
- Modify: `apps/backend/src/controllers/admin.controller.ts` (listar lotações)
- Modify: `apps/backend/src/routes/admin.routes.ts` (GET /lotacoes)
- Modify: `apps/backend/src/services/admin.service.ts` (listar lotações)
- Test: `apps/backend/src/tests/integration/funcaoPatente.routes.test.ts`

**Interfaces:**
- Consumes: `patenteService` (Task 3), `requireSuperAdmin`, `validate`, `ok`, `fail`.
- Produces:
  - `PatenteDTO { id, forca_id, sigla, nome, ordem }`, `FuncaoPatenteDTO { id, lotacao_id, template_id, funcao_norm, patente_ids }`
  - `GET /api/v1/patentes` (autenticado)
  - `GET /api/v1/admin/lotacoes` (super-admin) → `{ id, sigla, nome }[]`
  - `GET /api/v1/funcao-patentes?lotacao_id=` (autenticado; sem query = globais), `POST /funcao-patentes`, `PUT /funcao-patentes/:id`, `DELETE /funcao-patentes/:id` (escrita = super-admin)

- [ ] **Step 1: Tipos compartilhados**

Criar `packages/shared-types/src/patente.ts`:

```ts
export interface PatenteDTO {
  id: number;
  forca_id: number;
  sigla: string;
  nome: string;
  ordem: number;
}

export interface FuncaoPatenteDTO {
  id: number;
  lotacao_id: number | null;
  template_id: number | null;
  funcao_norm: string;
  patente_ids: number[];
}
```

Em `packages/shared-types/src/index.ts`, adicionar:
```ts
export * from './patente.js';
```

- [ ] **Step 2: Schemas Zod**

Criar `packages/shared-schemas/src/funcaoPatente.schemas.ts`:

```ts
import { z } from 'zod';

// Regra de escopo Global (sem lotacao_id) ou Lotação. A camada Layout é 2b.2 (não exposta aqui).
export const criarFuncaoPatenteSchema = z.object({
  lotacao_id: z.number().int().positive().nullable().optional(),
  funcao: z.string().min(1).max(100),
  patente_ids: z.array(z.number().int().positive()).max(72),
});

export const atualizarFuncaoPatenteSchema = z.object({
  patente_ids: z.array(z.number().int().positive()).max(72),
});

export type CriarFuncaoPatenteInput = z.infer<typeof criarFuncaoPatenteSchema>;
export type AtualizarFuncaoPatenteInput = z.infer<typeof atualizarFuncaoPatenteSchema>;
```

Em `packages/shared-schemas/src/index.ts`, adicionar:
```ts
export * from './funcaoPatente.schemas.js';
```

- [ ] **Step 3: `patenteService.listarTodas`**

Em `apps/backend/src/services/patente.service.ts`, adicionar ao objeto `patenteService`:

```ts
  async listarTodas(prisma: PrismaClient) {
    return prisma.patente.findMany({ orderBy: [{ forca_id: 'asc' }, { ordem: 'asc' }] });
  },
```

- [ ] **Step 4: `funcaoPatente.service`**

Criar `apps/backend/src/services/funcaoPatente.service.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import type { CriarFuncaoPatenteInput, AtualizarFuncaoPatenteInput } from '@escalas/shared-schemas';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { normalizeFuncao } from '../utils/funcao.js';

export const funcaoPatenteService = {
  // lotacao_id undefined → lista as globais; número → as daquela lotação. (Layout fica no 2b.2.)
  async listar(lotacao_id: number | undefined, prisma: PrismaClient) {
    return prisma.funcaoPatente.findMany({
      where: { template_id: null, lotacao_id: lotacao_id ?? null },
      orderBy: { funcao_norm: 'asc' },
    });
  },

  async criar(input: CriarFuncaoPatenteInput, prisma: PrismaClient) {
    const lotacao_id = input.lotacao_id ?? null;
    const funcao_norm = normalizeFuncao(input.funcao);
    const existe = await prisma.funcaoPatente.findFirst({ where: { lotacao_id, template_id: null, funcao_norm } });
    if (existe) throw new ConflictError('Já existe regra para essa função neste escopo.');
    return prisma.funcaoPatente.create({
      data: { lotacao_id, template_id: null, funcao_norm, patente_ids: input.patente_ids },
    });
  },

  async atualizar(id: number, input: AtualizarFuncaoPatenteInput, prisma: PrismaClient) {
    const existe = await prisma.funcaoPatente.findUnique({ where: { id } });
    if (!existe) throw new NotFoundError('Regra não encontrada.');
    return prisma.funcaoPatente.update({ where: { id }, data: { patente_ids: input.patente_ids } });
  },

  async remover(id: number, prisma: PrismaClient) {
    const existe = await prisma.funcaoPatente.findUnique({ where: { id } });
    if (!existe) throw new NotFoundError('Regra não encontrada.');
    await prisma.funcaoPatente.delete({ where: { id } });
  },
};
```

- [ ] **Step 5: Listar lotações (admin)**

Em `apps/backend/src/services/admin.service.ts`, adicionar ao objeto `adminService`:
```ts
  async listarLotacoes(prisma: PrismaClient) {
    return prisma.lotacao.findMany({ orderBy: { nome: 'asc' }, select: { id: true, sigla: true, nome: true } });
  },
```
Em `apps/backend/src/controllers/admin.controller.ts`, adicionar um handler seguindo o padrão dos existentes:
```ts
  async listarLotacoes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotacoes = await adminService.listarLotacoes(prisma);
      ok(res, 'Lotações listadas.', lotacoes);
    } catch (e) { next(e); }
  },
```
Em `apps/backend/src/routes/admin.routes.ts`, adicionar:
```ts
adminRoutes.get('/lotacoes', adminController.listarLotacoes);
```

- [ ] **Step 6: Controller de funções/patentes**

Criar `apps/backend/src/controllers/funcaoPatente.controller.ts` (padrão de `feriado.controller.ts`, com `handle` para `HttpError`):

```ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { funcaoPatenteService } from '../services/funcaoPatente.service.js';
import { patenteService } from '../services/patente.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

export const funcaoPatenteController = {
  async listarPatentes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Patentes listadas.', await patenteService.listarTodas(prisma)); }
    catch (e) { next(e); }
  },
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotacao_id = req.query.lotacao_id ? Number(req.query.lotacao_id) : undefined;
      ok(res, 'Regras listadas.', await funcaoPatenteService.listar(lotacao_id, prisma));
    } catch (e) { next(e); }
  },
  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Regra criada.', await funcaoPatenteService.criar(req.body, prisma), 201); }
    catch (e) { handle(res, next, e); }
  },
  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Regra atualizada.', await funcaoPatenteService.atualizar(Number(req.params.id), req.body, prisma)); }
    catch (e) { handle(res, next, e); }
  },
  async remover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { await funcaoPatenteService.remover(Number(req.params.id), prisma); ok(res, 'Regra removida.', null); }
    catch (e) { handle(res, next, e); }
  },
};
```

- [ ] **Step 7: Rotas + montagem**

Criar `apps/backend/src/routes/funcaoPatente.routes.ts`:

```ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { criarFuncaoPatenteSchema, atualizarFuncaoPatenteSchema } from '@escalas/shared-schemas';
import { funcaoPatenteController } from '../controllers/funcaoPatente.controller.js';

export const funcaoPatenteRoutes = Router();
funcaoPatenteRoutes.use(authMiddleware);

funcaoPatenteRoutes.get('/', funcaoPatenteController.listar);
funcaoPatenteRoutes.post('/', requireSuperAdmin, validate(criarFuncaoPatenteSchema), funcaoPatenteController.criar);
funcaoPatenteRoutes.put('/:id', requireSuperAdmin, validate(atualizarFuncaoPatenteSchema), funcaoPatenteController.atualizar);
funcaoPatenteRoutes.delete('/:id', requireSuperAdmin, funcaoPatenteController.remover);

export const patenteRoutes = Router();
patenteRoutes.use(authMiddleware);
patenteRoutes.get('/', funcaoPatenteController.listarPatentes);
```

Em `apps/backend/src/routes/index.ts`, importar e montar (após `feriadoRoutes`):
```ts
import { funcaoPatenteRoutes, patenteRoutes } from './funcaoPatente.routes.js';
// ...
router.use('/patentes', patenteRoutes);
router.use('/funcao-patentes', funcaoPatenteRoutes);
```

- [ ] **Step 8: Teste de rotas**

Criar `apps/backend/src/tests/integration/funcaoPatente.routes.test.ts` seguindo o padrão dos outros `*.routes.test.ts` (supertest + `app` + seed de um super-admin e login/token — copiar o helper de auth usado em `feriado.routes.test.ts` se existir). Cobrir:
- `GET /patentes` autenticado → 200 e array (seed de 1-2 patentes antes).
- `POST /funcao-patentes` como super-admin com `{ funcao: 'Comandante', patente_ids: [12] }` → 201; segundo POST igual → 409.
- `POST /funcao-patentes` sem super-admin → 403.
- `GET /funcao-patentes` (sem query) → lista as globais; `?lotacao_id=` → as da lotação.
- `PUT /funcao-patentes/:id` altera `patente_ids`; `DELETE` remove (→ 200) e não encontrada → 404.

Rodar:
```bash
npm test -- funcaoPatente.routes
```
Esperado: PASS.

- [ ] **Step 9: Suite + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
git add packages/shared-types/src/patente.ts packages/shared-types/src/index.ts packages/shared-schemas/src/funcaoPatente.schemas.ts packages/shared-schemas/src/index.ts apps/backend/src/services/funcaoPatente.service.ts apps/backend/src/services/patente.service.ts apps/backend/src/controllers/funcaoPatente.controller.ts apps/backend/src/routes/funcaoPatente.routes.ts apps/backend/src/routes/index.ts apps/backend/src/services/admin.service.ts apps/backend/src/controllers/admin.controller.ts apps/backend/src/routes/admin.routes.ts apps/backend/src/tests/integration/funcaoPatente.routes.test.ts
git commit -m "🌐 feat(patente): API de patentes + CRUD de FuncaoPatente (global/lotação) + listar lotações"
```

---

### Task 5: `MilitarDTO` + `listarMilitares` expõem a patente

**Files:**
- Modify: `packages/shared-types/src/militar.ts`
- Modify: `apps/backend/src/services/admin.service.ts` (`listarUsuarios` inclui patente)
- Modify: `apps/backend/src/controllers/escala.controller.ts` (`listarMilitares` mapeia patente)
- Test: `apps/backend/src/tests/integration/escala.routes.test.ts` (adicionar caso ao describe de militares) ou o arquivo de rotas de militares existente.

**Interfaces:**
- Consumes: `Patente`, `User.patente` (Task 1).
- Produces: `MilitarDTO` com `patente_id: number | null` e `patente_sigla: string | null`.

- [ ] **Step 1: Estender o DTO**

Em `packages/shared-types/src/militar.ts`, adicionar dois campos:
```ts
  patente_id: number | null;
  patente_sigla: string | null;
```

- [ ] **Step 2: Incluir patente na query**

Em `apps/backend/src/services/admin.service.ts`, na `listarUsuarios`, trocar `include: { roles: true },` por:
```ts
      include: { roles: true, patente: true },
```

- [ ] **Step 3: Mapear no controller**

Em `apps/backend/src/controllers/escala.controller.ts`, no `listarMilitares`, no `.map((u) => ({...}))` do `MilitarDTO`, adicionar:
```ts
        patente_id: u.patente_id,
        patente_sigla: u.patente?.sigla ?? null,
```

- [ ] **Step 4: Teste (falha → passa)**

No teste de rotas que cobre `GET /:id/militares` (ex.: `escala.routes.test.ts`), adicionar/estender um caso: seed de um militar com `patente_id` apontando para uma `Patente` (id 12, sigla '1º SGT') na lotação da escala; chamar o endpoint; esperar que o item retorne `patente_sigla: '1º SGT'`. Se não houver arquivo, criar `apps/backend/src/tests/integration/militares.routes.test.ts` no mesmo padrão dos outros.

Rodar:
```bash
npm test -- militares || npm test -- escala.routes
```
Esperado: PASS.

- [ ] **Step 5: Suite + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
git add packages/shared-types/src/militar.ts apps/backend/src/services/admin.service.ts apps/backend/src/controllers/escala.controller.ts apps/backend/src/tests
git commit -m "✨ feat(militar): expõe patente_id/patente_sigla em listarMilitares"
```

---

### Task 6: `getDia`/`putDia` enriquecem a vaga com `patentes_esperadas` + `aviso_patente`

**Files:**
- Modify: `packages/shared-types/src/escala.ts` (`VagaDTO`)
- Modify: `apps/backend/src/services/escala.service.ts` (`getDia`, `putDia` — enriquecer o retorno)
- Test: `apps/backend/src/tests/integration/escala.service.test.ts` (ou o de dia existente)

**Interfaces:**
- Consumes: `patenteService.esperadasPara`, `patenteDivergente` (Task 3).
- Produces: `VagaDTO` com `patentes_esperadas: number[] | null` e `aviso_patente: boolean`; `getDia`/`putDia` retornam o dia enriquecido.

- [ ] **Step 1: Estender o `VagaDTO`**

Em `packages/shared-types/src/escala.ts`, no `VagaDTO`, após `observacoes`:
```ts
  patentes_esperadas: number[] | null;
  aviso_patente: boolean;
```

- [ ] **Step 2: Escrever os testes (falhando)**

Em `apps/backend/src/tests/integration/escala.service.test.ts`, adicionar um describe (usa `escalaService`, `patenteService` não é necessário; cria dados direto). Cenário: lotação + template + escala rascunho (mês 9/2026) com uma guarnição/vaga função "Comandante"; regra global `COMANDANTE → [12]`; militar A com patente 12 (bate) e militar B com patente 99 (não bate).

```ts
it('getDia marca aviso_patente quando a patente diverge da regra', async () => {
  await resetDb();
  await testPrisma.patente.createMany({ data: [
    { id: 12, forca_id: 0, sigla: '1º SGT', nome: '1º Sargento', ordem: 12 },
    { id: 99, forca_id: 0, sigla: 'SD', nome: 'Soldado', ordem: 17 },
  ]});
  const lot = await testPrisma.lotacao.create({ data: { id: 910, sigla: 'L910', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM910', nome: 'Adm', last_sync_at: new Date() } });
  const milB = await testPrisma.user.create({ data: { cpf: 'MILB910', nome: 'B', last_sync_at: new Date(), patente_id: 99 } });
  const tpl = await testPrisma.templateLotacao.create({ data: { lotacao_id: lot.id, nome: 'P', criado_por_id: admin.id,
    guarnicoes: { create: [{ sigla: 'INC', atividade: 'INCENDIO', turno_padrao_inicio: '08:00', turno_padrao_fim: '08:00', ordem: 0, vagas_sugeridas: { create: [{ funcao: 'Comandante', quantidade_sugerida: 1 }] } }] } } });
  await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
  const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 9, ano: 2026, template_id: tpl.id }, admin.id, testPrisma);
  const d1 = await escalaService.getDia(escala.id, '2026-09-01', testPrisma);
  // atribui o militar B (patente 99, diverge) via putDia
  await escalaService.putDia(escala.id, '2026-09-01', {
    guarnicoes: d1!.guarnicoes.map((g) => ({ sigla: g.sigla, atividade: g.atividade, viatura_id: g.viatura_id, turno_inicio: g.turno_inicio, turno_fim: g.turno_fim, ordem: g.ordem,
      vagas: g.vagas.map((v) => ({ funcao: v.funcao, militar_id: milB.id, turno_inicio: v.turno_inicio, turno_fim: v.turno_fim })) })),
  }, admin.id, testPrisma);
  const dia = await escalaService.getDia(escala.id, '2026-09-01', testPrisma);
  const vaga = dia!.guarnicoes[0]!.vagas[0]! as unknown as { patentes_esperadas: number[] | null; aviso_patente: boolean };
  expect(vaga.patentes_esperadas).toEqual([12]);
  expect(vaga.aviso_patente).toBe(true);
});

it('putDia salva mesmo com patente divergente (aviso não bloqueia)', async () => {
  // reusa o cenário acima abreviado: o putDia acima já retornou sem lançar → asserção implícita.
  expect(true).toBe(true);
});
```

> Nota: o segundo teste é redundante com o `putDia` do primeiro (que não lança). O implementer pode fundi-los num só caso e remover o placeholder — o essencial é provar que `putDia` NÃO lança com divergência e que `getDia` traz `aviso_patente: true`.

- [ ] **Step 3: Rodar — verificar que falha**

```bash
npm test -- escala.service
```
Esperado: FAIL (campos não existem no retorno).

- [ ] **Step 4: Implementar o enriquecimento**

Em `apps/backend/src/services/escala.service.ts`, importar no topo:
```ts
import { patenteService } from './patente.service.js';
```

Adicionar um helper privado no mesmo arquivo (acima do objeto `escalaService`), que recebe um dia (com guarnições/vagas) + a escala e devolve o mesmo dia com os dois campos por vaga:

```ts
async function enriquecerComPatentes<T extends { guarnicoes: { vagas: { funcao: string; militar_id: number | null }[] }[] }>(
  dia: T,
  escala: { lotacao_id: number; template_id: number | null },
  prisma: PrismaClient,
): Promise<T> {
  const militarIds = dia.guarnicoes.flatMap((g) => g.vagas.map((v) => v.militar_id).filter((x): x is number => x != null));
  const militares = militarIds.length
    ? await prisma.user.findMany({ where: { id: { in: militarIds } }, select: { id: true, patente_id: true } })
    : [];
  const patenteDe = new Map(militares.map((m) => [m.id, m.patente_id] as const));
  for (const g of dia.guarnicoes) {
    for (const v of g.vagas as (typeof g.vagas[number] & { patentes_esperadas: number[] | null; aviso_patente: boolean })[]) {
      const esperadas = await patenteService.esperadasPara(v.funcao, escala.lotacao_id, escala.template_id, prisma);
      v.patentes_esperadas = esperadas;
      v.aviso_patente = v.militar_id != null && patenteService.patenteDivergente(patenteDe.get(v.militar_id) ?? null, esperadas);
    }
  }
  return dia;
}
```

Em `getDia`, após obter o dia, buscar a escala e enriquecer:
```ts
  async getDia(escala_id: number, dataStr: string, prisma: PrismaClient) {
    const dia = await prisma.escalaDia.findFirst({
      where: { escala_id, data: new Date(`${dataStr}T00:00:00.000Z`) },
      include: { guarnicoes: { orderBy: { ordem: 'asc' }, include: { vagas: { orderBy: { id: 'asc' } } } } },
    });
    if (!dia) return dia;
    const escala = await prisma.escala.findUniqueOrThrow({ where: { id: escala_id }, select: { lotacao_id: true, template_id: true } });
    return enriquecerComPatentes(dia, escala, prisma);
  },
```

Em `putDia`, antes de `return novo;`, enriquecer:
```ts
      const escalaInfo = await tx.escala.findUniqueOrThrow({ where: { id: escala_id }, select: { lotacao_id: true, template_id: true } });
      return enriquecerComPatentes(novo, escalaInfo, tx as unknown as PrismaClient);
```

> `aviso_patente` só é `true` para vaga preenchida (`militar_id != null`); vaga aberta (DO) nunca avisa.

- [ ] **Step 5: Rodar — verificar que passa + suite + typecheck + lint + commit**

```bash
npm test -- escala.service && npm test && npm run typecheck && npm run lint
git add packages/shared-types/src/escala.ts apps/backend/src/services/escala.service.ts apps/backend/src/tests/integration/escala.service.test.ts
git commit -m "✨ feat(dia): vaga expõe patentes_esperadas + aviso_patente (soft, não bloqueia)"
```

---

### Task 7: Web — MilitarPicker mostra a patente e destaca fora da regra

**Files:**
- Modify: `apps/web/src/components/MilitarPicker.tsx`
- Modify: `apps/web/src/components/VagaRow.tsx` (passar `patentesEsperadas` da vaga)
- Test: `apps/web/src/components/MilitarPicker.test.tsx`

**Interfaces:**
- Consumes: `MilitarDTO` com patente (Task 5); `VagaDTO.patentes_esperadas` (Task 6).
- Produces: `MilitarPicker` com prop opcional `patentesEsperadas?: number[] | null`.

- [ ] **Step 1: Ajustar o MilitarPicker**

Em `apps/web/src/components/MilitarPicker.tsx`:
- Adicionar `patentesEsperadas` às props: `{ escalaId, value, onChange, patentesEsperadas }: { escalaId: number; value: number | null; onChange: (militarId: number | null) => void; patentesEsperadas?: number[] | null }`.
- No `options`, incluir a sigla no label e marcar inelegíveis. Substituir o `.map` por:

```tsx
  const regra = patentesEsperadas ?? null;
  const inelegivel = (m: (typeof data)[number]) =>
    !!regra && regra.length > 0 && (m.patente_id == null || !regra.includes(m.patente_id));
  const options = [...data]
    .sort((a, b) => Number(inelegivel(a)) - Number(inelegivel(b)))
    .map((m) => ({
      value: String(m.id),
      label: `${inelegivel(m) ? '⚠ ' : ''}${m.patente_sigla ?? ''} ${m.nome}${m.matricula ? ` (${m.matricula})` : ''}`.trim(),
    }));
```
(remover o `posto` antigo do label.)

- [ ] **Step 2: Passar a regra pela VagaRow**

Em `apps/web/src/components/VagaRow.tsx`, onde `<MilitarPicker ... />` é renderizado, adicionar a prop:
```tsx
patentesEsperadas={vaga.patentes_esperadas}
```
(Se a `VagaRow` receber a vaga com outro nome, usar o campo `patentes_esperadas` do objeto da vaga. Se `ExecucaoVagaRow` também usa o picker mas não tem esse dado, deixar sem a prop — ela é opcional.)

- [ ] **Step 3: Teste do picker**

Em `apps/web/src/components/MilitarPicker.test.tsx`, adicionar um caso (MSW já mocka `/escalas/:id/militares`): retornar 2 militares, um com `patente_id: 12` e outro com `patente_id: 99`, `patente_sigla` correspondentes; renderizar `<MilitarPicker escalaId={1} value={null} onChange={()=>{}} patentesEsperadas={[12]} />`; abrir o dropdown; esperar que o militar com patente 99 apareça com `⚠` no rótulo e o de 12 sem. Ajustar o mock existente para incluir `patente_id`/`patente_sigla`.

Rodar:
```bash
npm test -- MilitarPicker
```
Esperado: PASS.

- [ ] **Step 4: Suite web + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/components/MilitarPicker.tsx apps/web/src/components/MilitarPicker.test.tsx apps/web/src/components/VagaRow.tsx
git commit -m "✨ feat(web): MilitarPicker mostra patente e destaca militar fora da regra"
```

---

### Task 8: Web — catálogo de funções (CRUD de regras) + menu super-admin

**Files:**
- Create: `apps/web/src/lib/api/funcaoPatentes.ts`
- Create: `apps/web/src/lib/api/patentes.ts`
- Create: `apps/web/src/lib/api/lotacoes.ts`
- Create: `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx`
- Create: `apps/web/src/routes/_app/funcao-patentes.index.tsx`
- Modify: `apps/web/src/components/AppShell.tsx` (item de menu, super-admin)
- Test: `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.test.tsx`

**Interfaces:**
- Consumes: endpoints da Task 4 (`/patentes`, `/funcao-patentes`, `/admin/lotacoes`); `PatenteDTO`, `FuncaoPatenteDTO`.
- Produces: tela `/funcao-patentes`.

- [ ] **Step 1: Clientes de API**

Criar `apps/web/src/lib/api/patentes.ts`:
```ts
import type { PatenteDTO } from '@escalas/shared-types';
import { apiGet } from './client';
export const patentesApi = { listar: () => apiGet<PatenteDTO[]>('/patentes') };
```
Criar `apps/web/src/lib/api/lotacoes.ts`:
```ts
import { apiGet } from './client';
export interface LotacaoResumo { id: number; sigla: string; nome: string }
export const lotacoesApi = { listar: () => apiGet<LotacaoResumo[]>('/admin/lotacoes') };
```
Criar `apps/web/src/lib/api/funcaoPatentes.ts`:
```ts
import type { FuncaoPatenteDTO } from '@escalas/shared-types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';
export const funcaoPatentesApi = {
  listar: (lotacaoId?: number) => apiGet<FuncaoPatenteDTO[]>(`/funcao-patentes${lotacaoId ? `?lotacao_id=${lotacaoId}` : ''}`),
  criar: (body: { lotacao_id: number | null; funcao: string; patente_ids: number[] }) => apiPost<FuncaoPatenteDTO>('/funcao-patentes', body),
  atualizar: (id: number, body: { patente_ids: number[] }) => apiPut<FuncaoPatenteDTO>(`/funcao-patentes/${id}`, body),
  excluir: (id: number) => apiDelete<null>(`/funcao-patentes/${id}`),
};
```

- [ ] **Step 2: Tela do catálogo**

Criar `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx`: um `Stack` com
- um seletor de escopo: `SegmentedControl` Global / Lotação; se Lotação, um `Select` de lotações (de `lotacoesApi.listar`).
- listagem das regras do escopo (`funcaoPatentesApi.listar(lotacaoId?)`) numa `Table` (função + siglas das patentes + ações editar/excluir).
- um formulário (função `TextInput` + `MultiSelect` de patentes, `data` de `patentesApi.listar` com `value=String(id)`, `label='SIGLA — Nome'`, agrupado por força via `group`) que cria a regra; ao editar, só o `MultiSelect` muda.
- invalida a query `['funcao-patentes', escopo]` após criar/editar/excluir; erros mostram `ApiError.message` (ex.: 409 duplicado).

Usar `useQuery`/`useMutation`/`useQueryClient` (padrão das outras telas, ex.: `features/layouts`).

- [ ] **Step 3: Rota**

Criar `apps/web/src/routes/_app/funcao-patentes.index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { CatalogoFuncoes } from '../../features/funcaoPatentes/CatalogoFuncoes';
export const Route = createFileRoute('/_app/funcao-patentes/')({ component: CatalogoFuncoes });
```
(o routeTree é gerado automaticamente — não editar à mão.)

- [ ] **Step 4: Item de menu (super-admin)**

Em `apps/web/src/components/AppShell.tsx`, dentro do grupo de administração/where `sa` é usado, adicionar (só quando `sa`):
```tsx
{sa && <NavLink component={Link} to="/funcao-patentes" label="Elegibilidade (Funções)" c="white" leftSection={<IconUserCheck size={18} />} />}
```
(importar `IconUserCheck` de `@tabler/icons-react`.)

- [ ] **Step 5: Teste da tela (MSW)**

Criar `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.test.tsx`: mock de `/patentes`, `/admin/lotacoes`, `/funcao-patentes` (GET vazio; POST retorna 201). Renderizar via `renderWithProviders`; preencher função "Comandante", selecionar uma patente, submeter; verificar que o POST foi disparado com `{ funcao: 'Comandante', patente_ids: [...] }` e a lista invalida/atualiza. Rodar:
```bash
npm test -- CatalogoFuncoes
```
Esperado: PASS.

- [ ] **Step 6: Suite web + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/lib/api/funcaoPatentes.ts apps/web/src/lib/api/patentes.ts apps/web/src/lib/api/lotacoes.ts apps/web/src/features/funcaoPatentes apps/web/src/routes/_app/funcao-patentes.index.tsx apps/web/src/components/AppShell.tsx apps/web/src/routeTree.gen.ts
git commit -m "✨ feat(web): catálogo de elegibilidade por função (CRUD global/lotação)"
```

---

### Task 9: Web — badge de aviso no editor do dia + notificação ao salvar

**Files:**
- Modify: `apps/web/src/components/VagaRow.tsx` (badge quando `aviso_patente`)
- Modify: `apps/web/src/routes/_app/escalas/$id.dias.$data.tsx` (notificação ao salvar)
- Test: `apps/web/src/components/VagaRow.test.tsx` (criar se não existir)

**Interfaces:**
- Consumes: `VagaDTO.aviso_patente` (Task 6).
- Produces: sinalização visual + notificação resumo (não bloqueante).

- [ ] **Step 1: Badge na VagaRow**

Em `apps/web/src/components/VagaRow.tsx`, quando a vaga tiver `aviso_patente === true`, renderizar um `Badge color="yellow"` ou `Tooltip`+ícone ao lado do MilitarPicker, com texto "Patente divergente". Ex.:
```tsx
{vaga.aviso_patente && <Badge color="yellow" variant="light" title="Patente fora da regra da função">Patente divergente</Badge>}
```
(importar `Badge` de `@mantine/core`.)

- [ ] **Step 2: Notificação ao salvar**

Em `apps/web/src/routes/_app/escalas/$id.dias.$data.tsx`, no `onSuccess` do salvar (mutation do `putDia`), após a notificação de sucesso já existente, se o dia retornado tiver alguma vaga com `aviso_patente`, mostrar um `notifications.show({ color: 'yellow', message: 'N vaga(s) com patente divergente — salvo mesmo assim.' })` (contar as vagas divergentes de `data.guarnicoes.flatMap(g => g.vagas).filter(v => v.aviso_patente)`).

- [ ] **Step 3: Teste da VagaRow**

Em `apps/web/src/components/VagaRow.test.tsx` (criar se não existir, via `renderWithProviders`), renderizar uma `VagaRow` com uma vaga `{ ..., aviso_patente: true, patentes_esperadas: [12] }` e verificar que o texto "Patente divergente" aparece; e com `aviso_patente: false` que não aparece. Ajustar as props mínimas exigidas pela `VagaRow` conforme o componente.

Rodar:
```bash
npm test -- VagaRow
```
Esperado: PASS.

- [ ] **Step 4: Suite web + typecheck + lint + commit**

```bash
npm test && npm run typecheck && npm run lint
cd ../.. && git add apps/web/src/components/VagaRow.tsx apps/web/src/components/VagaRow.test.tsx apps/web/src/routes/_app/escalas/$id.dias.$data.tsx
git commit -m "✨ feat(web): aviso visual de patente divergente no editor do dia (soft)"
```

---

## Self-Review (preenchido)

- **Cobertura do spec (2b.1):** `Patente`+seed (T1); sync `patente_id` (T2); `normalizeFuncao`+`esperadasPara`+cascata (T3); `FuncaoPatente` CRUD global/lotação + `/patentes` + `/admin/lotacoes` (T4); `MilitarDTO`+patente (T5); `VagaDTO`+`patentes_esperadas`/`aviso_patente` no getDia/putDia soft (T6); MilitarPicker destaque (T7); catálogo admin (T8); badge+notificação (T9). Camada LAYOUT e lista na aprovação = 2b.2, fora deste plano (declarado em Global Constraints). ✔
- **Sem placeholders:** SQL/JSON/código/comandos concretos. Exceção anotada: T6 Step 2 tem um segundo teste redundante que o implementer pode fundir (nota explícita); os testes de rota (T4/T5) referenciam "o padrão dos outros `*.routes.test.ts`" por dependerem do helper de auth existente — o passo aponta o arquivo-modelo (`feriado.routes.test.ts`) e os casos exatos a cobrir. ✔
- **Consistência de tipos:** `esperadasPara(funcao, lotacao_id, template_id, prisma): number[] | null` e `patenteDivergente(patente_id, esperadas): boolean` idênticos entre service, testes e o enriquecedor de T6. `MilitarDTO.patente_id/patente_sigla` (T5) consumidos no MilitarPicker (T7). `VagaDTO.patentes_esperadas/aviso_patente` (T6) consumidos em T7/T9. `FuncaoPatenteDTO`/`PatenteDTO` (T4) consumidos em T8. `patente_ids Int[]` não-nulo; `[]` = silencia. ✔
- **Riscos anotados:** (a) `enriquecerComPatentes` roda `esperadasPara` por vaga (N queries por dia) — aceitável no volume de um dia; se virar gargalo, cachear por `funcao_norm` no 2c. (b) `putDia` enriquece dentro da transação passando `tx` como `PrismaClient` — o service só faz `findFirst`, compatível. (c) `ExecucaoVagaRow` também usa o MilitarPicker; a prop `patentesEsperadas` é opcional, então não quebra (T7 Step 2).

## Validação final (controlador, pós-T9)

Backend no ar em `:3000`. Rodar `npm run seed:patentes`; num ambiente com militares sincronizados (têm `patente_id`), criar via `/funcao-patentes` uma regra global (ex.: `Comandante → [1º SGT...]`), atribuir na escala #5 (rascunho) um militar de patente divergente numa vaga "Comandante", e conferir: `GET /escalas/5/dias/:data` traz `aviso_patente: true` na vaga; `PUT` salva sem erro; na web o MilitarPicker destaca inelegíveis (⚠) e o editor mostra o badge + notificação. Depois, verificação visual da tela de catálogo.
