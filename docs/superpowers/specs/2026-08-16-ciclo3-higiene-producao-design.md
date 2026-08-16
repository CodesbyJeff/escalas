# Ciclo 3 — Higiene de Produção — Design

**Data:** 2026-08-16
**Contexto:** O Ciclo 2 fechou em 11/08 com a Política de Localidade validada ao vivo. O domínio está fundo, coberto e exercitado; o que separa o sistema do usuário, não. A avaliação geral de 06/08 (`2026-08-06 - ESCALAS - AVALIACAO GERAL POS-FERIAS`) mediu o desequilíbrio: 237 commits, 373 testes verdes, **zero usuários em produção** — e três defeitos aparecendo em vinte minutos de uso real, todos na costura, nenhum no domínio.

Este ciclo é o passo 2 daquela sequência recomendada: **higiene de produção**. Não entrega funcionalidade nenhuma para o usuário final. Entrega a capacidade de chegar até ele.

**Fonte:** código lido em 16/08 sobre `main` = `origin/main` = `3eadbf4`, árvore limpa.

## O que já caiu desde a avaliação

O passo 1 (fechar a costura) foi quase todo feito em 06/08 e não precisa ser refeito:

- **Boot anônimo** — token expirado passava pelo guarda da rota; corrigido em `d2d6c08`, com teste que primeiro falhou.
- **401 do login traduzido como "Sessão expirada"** — corrigido em `0c28bcb`. Rotas de autenticação saíram do ramo de sessão expirada e sobem a mensagem do servidor.
- **429 sem corpo virando "Erro de comunicação"** — corrigido no mesmo commit; resposta sem corpo agora tem mensagem por status.

Sobra do passo 1 apenas **distinguir estado vazio de estado de falha nas telas**, que é o ciclo seguinte, não este.

## O que este ciclo ataca (verificado no disco, não na memória)

| Item | Onde | Estado em 16/08 |
|---|---|---|
| CORS aberto para qualquer origem | `apps/backend/src/app.ts:10-11`, com o `TODO` ainda no lugar | Bloqueador de produção |
| Sem CI | `.github/workflows` não existe | Bloqueador de produção |
| E2E escrito e nunca rodado | `apps/web/e2e/escalante.spec.ts`, desde maio | Aberto |
| Tag congelada | `v0.4.0-escalas`, de 22/05, ~150 commits atrás | Aberto |

## Decisões trancadas (aprovadas com o usuário)

- **CORS falha fechado.** Com `NODE_ENV=production` e `ALLOWED_ORIGINS` ausente, o backend **recusa subir**. O erro aparece no deploy, não no navegador do usuário, e é impossível subir produção acidentalmente aberta. As alternativas foram descartadas: subir bloqueando tudo faz a falha aparecer tarde e disfarçada de bug do front; subir aberto com warning é o buraco de hoje com verniz.
- **O E2E roda local neste ciclo, não no CI.** Um teste que nunca rodou vai quase certamente ficar vermelho antes de ficar verde; montar infraestrutura de CI em volta de um teste vermelho é trabalho jogado fora. Primeiro fica verde na máquina, depois é promovido — a promoção é tarefa do go-live.
- **Quando o spec do E2E e o app divergirem, o app manda.** Só se mexe no spec se o comportamento atual estiver correto. Se o comportamento estiver errado, é bug: conserta-se o app, com teste. Reescrever um teste até ele passar é exatamente como se perde o único E2E do projeto.
- **Tag anotada `v0.5.0-escalas` no fim do ciclo,** com resumo por trilha no corpo. CHANGELOG completo fica para a `v1.0.0` do go-live.
- **Sem deploy neste ciclo.** Docker nunca validado, `ESCALAS_API_KEY` e o deploy do `/external` seguem com o TEN PETER — dependências externas não entram no escopo de um ciclo que precisa fechar.

## Arquitetura

### Fatia 1 — CORS por env

**`apps/backend/src/config/env.ts`**

O arquivo hoje faz `export const env = envSchema.parse(process.env)` no topo. Testar a regra de produção contra isso significaria manipular `process.env` e reimportar o módulo. Em vez disso, extrai-se a função:

```ts
export function parseEnv(raw: NodeJS.ProcessEnv): Env { ... }
export const env = parseEnv(process.env);
```

O `export const env` continua existindo com o mesmo nome e o mesmo tipo, então **nenhum call site muda**. A chave nova:

```ts
ALLOWED_ORIGINS: z.string().optional(),
```

e a regra, num `superRefine` do schema:

- `NODE_ENV === 'production'` e `ALLOWED_ORIGINS` ausente ou vazia após trim ⇒ erro de validação com mensagem explícita (`ALLOWED_ORIGINS é obrigatória em produção`).
- Fora de produção, ausente ⇒ default `http://localhost:5173,http://localhost:4173` (dev do Vite e preview).

A lista é exposta **já quebrada e limpa**, para o `app.ts` não repetir parsing. O schema guarda a string crua; `parseEnv` deriva o array e o devolve junto:

```ts
export type Env = z.infer<typeof envSchema> & { origins: string[] };
```

`origins` = split por vírgula, `trim`, descarte de vazios — sobre o valor efetivo (a env, ou o default de dev). Em produção o array nunca é vazio, porque o `superRefine` já barrou esse caso antes.

**`apps/backend/src/app.ts`**

```ts
app.use(cors({ origin: env.origins }));
```

e o `TODO` sai. Requisição **sem** header `Origin` continua passando: o pacote `cors` não bloqueia essas. Isso é deliberado e importante — o app mobile (React Native) não envia `Origin`, e o `/health` chamado por orquestrador também não. Restringir origem protege o navegador de terceiros; não é autenticação, e a autenticação (JWT) continua sendo quem protege a API.

**Testes**

- Unidade sobre `parseEnv`: produção sem a env falha; produção com a env passa e quebra a lista certo; dev sem a env cai no default.
- Integração sobre o app montado: requisição com `Origin` permitida recebe `access-control-allow-origin`; com origem estranha, não recebe; sem `Origin`, responde normal.

**`.env.example`** ganha a chave com comentário dizendo que é obrigatória em produção.

### Fatia 2 — CI no GitHub Actions

**`.github/workflows/ci.yml`**, disparo em `push` na `main` e em `pull_request`. Um único job — a suíte inteira leva minutos, dividir em três jobs só multiplicaria o custo de setup.

- `ubuntu-latest`, Node 20, pnpm 9 com cache de store.
- Serviço `postgres:16-alpine` com healthcheck `pg_isready`, usuário/senha/base iguais aos do `docker-compose.yml` para o `.env.example` continuar valendo como documentação.
- Envs do job: as mínimas para o `envSchema` passar — `JWT_SECRET`/`JWT_REFRESH_SECRET` de teste com 16+ caracteres, `SISBOM_AUTH_URL`/`SISBOM_EXTERNAL_BASE_URL` fictícias mas URLs válidas, `SISBOM_API_KEY` qualquer, `DATABASE_URL` e `DATABASE_URL_TEST` apontando para o serviço.
- Passos: `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`.

Não há passo de migração: `src/tests/setup.ts` já roda `prisma migrate deploy` no `beforeAll` com `DATABASE_URL_TEST`. E não há risco de corrida entre arquivos — `vitest.config.ts` já fixa `fileParallelism: false` por causa do schema compartilhado.

**O que o turbo cobre de fato.** `apps/mobile` só declara o script `test` (jest com preset `jest-expo/node`) — não tem `lint`, `typecheck` nem `build`. Então `pnpm typecheck`, `pnpm lint` e `pnpm build` alcançam backend, web e os dois pacotes compartilhados; `pnpm test` alcança os três apps. Isso é o comportamento desejado e não se cria script nenhum no mobile só para preencher a matriz do CI — o mobile roda em Expo, cujo build é EAS e não pertence a este job.

Sem job de E2E, por decisão do ciclo.

### Fatia 3 — E2E rodando de verdade

**O bloqueio real.** O `escalante.spec.ts` declara no cabeçalho que precisa de "seed idempotente com um escalante, uma lotação operacional e papel ESCALANTE nessa lotação" — e esse seed nunca existiu. Os seeders atuais não bastam: `adminLocal.seeder.ts` cria um super admin sem `UserRole` de lotação, e `lotacoes.seeder.ts` é fallback offline de lotações mas não cria usuário nem layout. O fluxo do spec ainda passa por "nova escala", que precisa de um `TemplateLotacao` com guarnição para ter o que gerar.

**Novo seeder `seed:e2e`** (`apps/backend/src/seeders/e2e.seeder.ts`), determinístico e idempotente, sem tocar no SISBOM:

- **Lotação própria, por chave natural.** `upsert` em `Lotacao` com `where: { sisbom_ref: 'e2e:lotacao' }`, `operacional: true`. Não se reusa o `lotacoes.seeder.ts`: ele fabrica ids fixos e o próprio cabeçalho dele adverte que colide com os ids reais depois de um bulk do SISBOM. Como `Lotacao.sigla` não é única, `sisbom_ref` (que é `@unique`) é a única chave natural disponível — e o prefixo `e2e:` mantém o registro distinguível de qualquer coisa vinda do SISBOM. O id fica a cargo do autoincremento, então não há colisão possível com dados reais no banco de dev.
- Cria/atualiza o usuário de teste por `cpf` (`E2E_CPF`), com `senha_hash` de `E2E_SENHA` via bcrypt, `ativo: true`.
- `UserLotacao` + `UserRole { role: ESCALANTE, lotacao_id }` — é o `UserRole` com lotação que dá acesso à tela, não o `is_super_admin`.
- Um `TemplateLotacao` mínimo para a lotação, com pelo menos uma `TemplateGuarnicao` e uma `TemplateVagaSugerida`, para "gerar escala" produzir estrutura.
- Idempotência por `upsert` em chave natural (`User.cpf`, `TemplateLotacao.@@unique([lotacao_id, nome])`, `UserRole.@@unique([user_id, role, lotacao_id])`), de modo que rodar duas vezes não duplique nada.

**`apps/web/playwright.config.ts`** passa a subir backend **e** web: o campo `webServer` do Playwright aceita lista. Assim o comando único de E2E deixa apenas o Postgres como pré-requisito externo, em vez de exigir dois terminais e uma ordem correta que ninguém lembra em dois meses.

**`.env.example`** ganha `E2E_CPF` e `E2E_SENHA` documentados; o spec já lê essas envs com default.

**Execução e correção.** Roda-se o spec e conserta-se o que quebrar, sob a regra trancada acima (o app manda). Orçamento: **uma onda de correção**. Se o que aparecer for maior que isso, para-se e reporta-se como achado, em vez de expandir o ciclo em silêncio.

O entregável honesto desta fatia é: **o spec verde na máquina, com o comando documentado no README** — não "E2E resolvido para sempre".

### Fatia 4 — Tag

Com as três fatias verdes: tag anotada `v0.5.0-escalas`, corpo agrupando por trilha o que entrou desde a `v0.4.0` (execução/fiscalização, mobile militar, aprovação do gestor, feriados, sync SISBOM, layouts múltiplos e DO, Ciclo 2 inteiro, higiene deste ciclo).

## Riscos

- **O E2E nunca rodou.** A primeira execução pode revelar seletor morto — `getByText('15')` para escolher dia no calendário é frágil — ou fluxo que mudou desde maio. Mitigação: orçamento de uma onda e a regra de que o app manda.
- **O CI pode expor lentidão.** 291 testes de backend em série, cada arquivo com `resetDb()` no `beforeEach`, mais o `migrate deploy`. Se o job passar de ~10 minutos, isso vira achado registrado, não otimização improvisada dentro deste ciclo.
- **Os testes do mobile nunca rodaram fora desta máquina.** `jest-expo/node` no CI arrasta a árvore do Expo/React Native na instalação e pode precisar de ajuste de preset. Se travar o job, a saída é rodar `test` só onde ele é significativo hoje, com o motivo registrado — não desligar o mobile em silêncio.
- **`pnpm install --frozen-lockfile` pode falhar** se o lockfile estiver dessincronizado do que existe na máquina. É exatamente o tipo de coisa que o CI existe para pegar; se pegar, conserta-se o lockfile.

## Fora de escopo

- Deploy real e validação do Docker (Docker Desktop ausente na máquina).
- `ESCALAS_API_KEY` e deploy do `/external` no `sisbom-api` — dependem do TEN PETER.
- Promover o E2E ao CI — tarefa do go-live.
- "Vazio ≠ falha" nas telas — próximo ciclo.
- CHANGELOG retroativo — fica na `v1.0.0`.
- Os ~39 militares fora por CPF duplicado, `getMapaForca` órfão, AuditLog de execução/validação — dívida conhecida, sem relação com higiene de produção.

## Critérios de aceite

1. `NODE_ENV=production` sem `ALLOWED_ORIGINS` impede o boot, com mensagem nomeando a variável; com a variável, o backend responde e o header de CORS reflete a lista.
2. `.github/workflows/ci.yml` existe e passa verde na `main` rodando typecheck, lint, testes e build dos workspaces.
3. `escalante.spec.ts` roda e passa localmente, com um comando documentado, partindo de banco limpo mais `seed:e2e`.
4. Tag `v0.5.0-escalas` criada e empurrada.
5. Nenhuma regressão: suítes backend e web verdes, typecheck e lint limpos.

## Relacionados

- [[2026-08-06 - ESCALAS - AVALIACAO GERAL POS-FERIAS]]
- `docs/superpowers/specs/2026-08-10-ciclo2d-rodizio-localidade-design.md`
