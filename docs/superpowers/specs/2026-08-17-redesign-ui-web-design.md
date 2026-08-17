# Redesign de UI/UX — apps/web (Escalas CBMRN)

**Data:** 2026-08-17
**Escopo:** sistema de design + reskin das 18 telas de `apps/web`. Fluxos e navegação preservados.
**Não é escopo:** `apps/mobile`, backend, mudança de biblioteca de UI, redesenho de fluxos.

---

## 1. Problema

`apps/web` foi construído tela a tela ao longo de 6 ciclos de feature. Cada tela resolveu sua
apresentação localmente, e nunca existiu uma camada de design compartilhada. O resultado é
mensurável, não subjetivo:

| Sintoma | Contagem | Onde |
|---|---|---|
| `<Loader />` cru como estado de carregando | 12 | todas as rotas com `useQuery` |
| Texto `c="dimmed"` fazendo papel de estado vazio | 17 | listas, tabelas, painel |
| Títulos de página ad-hoc (`order` 3/4/5/6 para a mesma hierarquia) | 18 | uma por tela |
| Cores hardcoded que quebram em tema escuro | 19 | `bg="gray.1"`, `bg="cbmrn.7"`, `c="white"` |
| Tokens de design | 0 | `theme.ts` tem 13 linhas |

Três consequências:

1. **Não há para onde apontar.** O próximo recurso vai inventar o 19º título e o 13º loader,
   porque não existe um `PageHeader` nem um `LoadingState` para reusar.
2. **Contraste no limite.** O vermelho primário `cbmrn.6` (`#de3535`) tem contraste **4,50:1**
   com texto branco. O mínimo WCAG AA é 4,5:1 — passa com margem zero. `cbmrn.7` (`#c52729`)
   dá **5,68:1**.
3. **A marca domina o cenário.** A navbar é um bloco vermelho sólido (`bg="cbmrn.7"`) ocupando
   260px de largura em toda sessão. Vermelho saturado é a cor de maior carga perceptual
   disponível, e aqui ela está aplicada ao cromo — o lugar onde o usuário nunca precisa olhar.
   O conteúdo (a escala) compete com a moldura e perde.

## 2. Direção

**Ferramenta operacional séria.** Base neutra fria, densidade alta, tipografia técnica.
Referência: ferramentas de trabalho de uso prolongado, não portal institucional.

O escalante fica horas nesta tela montando a escala do mês. A interface tem que sumir.

**Regra de cor que governa tudo:** superfícies e cromo são neutros; saturação é reservada
para significado. O vermelho CBMRN sai de ~30% da área de tela para menos de 2% —
identidade no cabeçalho, no indicador de item ativo e nos botões de ação primária.

## 3. Tokens

### 3.1 Cor

Três famílias, definidas como tuplas Mantine de 10 passos.

**`cbmrn` (marca / ação primária)** — a rampa atual é mantida em valores, mas o *shade* de
uso muda:

```
primaryColor: 'cbmrn'
primaryShade: { light: 7, dark: 5 }   // era o default 6 → resolve o contraste 4,50:1
autoContrast: true
```

**`gray` (neutro frio — superfícies do modo claro)** — sobrescreve o cinza neutro-quente
padrão do Mantine:

```
0 #F6F8FA   fundo da aplicação
1 #EDF1F5   superfície elevada / linha zebrada
2 #DDE3EA   borda sutil
3 #C6D0DA   borda
4 #A9B6C4   ícone desabilitado
5 #8B9AAB   texto placeholder
6 #6E7E90   texto secundário (dimmed)
7 #566475   texto terciário
8 #3E4A58   texto forte
9 #2A333E   título
```

**`dark` (neutro frio — superfícies do modo escuro)** — sobrescreve o escuro levemente
arroxeado do Mantine:

```
0 #C9D1D9   texto primário
1 #B0BAC5
2 #8B95A1   texto secundário
3 #6B7785
4 #4C5764   borda
5 #3A434F
6 #2C343E   superfície elevada
7 #1F262E   fundo do corpo
8 #171D24   fundo recuado
9 #10151A
```

### 3.2 Cor semântica de domínio

O valor real está aqui: hoje `SeletorDeDia.tsx:27-29` decide cobertura com
`var(--mantine-color-green-2)` inline. Isso vira token nomeado, e a tela passa a declarar
significado em vez de cor.

As famílias de apoio (`blue`, `teal`, `yellow`) são as **tuplas nativas do Mantine**, sem
sobrescrita — só `gray`, `dark` e `cbmrn` são customizadas. Menos superfície para errar.

| Token | Família | Shade claro / escuro | Significado |
|---|---|---|---|
| `status-rascunho` | `gray` | 6 / 4 | escala não publicada |
| `status-publicada` | `blue` | 7 / 4 | publicada, em execução |
| `status-em-validacao` | `yellow` | 8 / 5 | aguardando gestor |
| `status-aprovada` | `teal` | 7 / 4 | aprovada |
| `status-rejeitada` | `cbmrn` | 7 / 5 | rejeitada |
| `cobertura-completa` | `teal` | 7 / 4 | dia sem vaga aberta |
| `cobertura-parcial` | `yellow` | 8 / 5 | dia com vaga aberta / D.O. |
| `aviso-patente` | `yellow` | 8 / 5 | patente divergente (soft, nunca bloqueia) |
| `conflito-turno` | `cbmrn` | 7 / 5 | conflito de turno (hard) |

O `yellow` do Mantine só atinge 4,5:1 sobre branco a partir do shade 8 — daí o par 8/5 em
vez do 6 habitual. Amarelo é a cor que mais falha contraste em sistemas de design, e o
sistema usa âmbar em três significados distintos.

**Colisão vermelho-ação vs. vermelho-erro** — resolvida por *peso*, não por matiz:
vermelho preenchido (`filled`) aparece **só** em botão de ação primária e no badge de
conflito. Erro, rejeição e ação destrutiva usam `variant="light"` (superfície tingida) ou
`variant="outline"`. Nunca um bloco vermelho chapado para comunicar problema.

> **Alternativa registrada:** primária em grafite quase-preto — exigiria uma tupla nova `ink`
> com `primaryShade: { light: 8, dark: 3 }` — deixando o vermelho exclusivo para
> destrutivo/erro. Elimina a colisão de vez e é o padrão das ferramentas operacionais de
> referência. Custo de troca depois: a tupla nova mais duas linhas em `theme.ts`, sem tocar
> em nenhuma tela. Não é a recomendação porque enfraquece a presença CBMRN sem que ninguém
> tenha pedido isso.

### 3.3 Tipografia

**IBM Plex Sans** (UI) + **IBM Plex Mono** (dados tabulares). Empacotadas via `@fontsource`,
sem requisição de rede — a aplicação roda em intranet e não pode depender de CDN de fonte.

Plex tem herança de tipografia técnica, algarismos tabulares de verdade e uma companheira
mono da mesma família. Não é `Inter` nem `system-ui`.

```
fontFamily:          'IBM Plex Sans', sans-serif
fontFamilyMonospace: 'IBM Plex Mono', monospace
```

Escala compacta (razão ~1,2, base 14px para densidade):

```
fontSizes:  xs 12 | sm 13 | md 14 | lg 16 | xl 18
headings:   h1 28/700 | h2 22/700 | h3 18/600 | h4 16/600 | h5 14/600 | h6 13/600
lineHeights: corpo 1.45 | títulos 1.2
letterSpacing: -0.01em nos títulos
```

Pesos importados do `@fontsource`: **400, 500, 600, 700** (sans) e **400, 500** (mono).
Só esses — cada peso é um arquivo, e peso não usado é download desperdiçado. A escala acima
usa exclusivamente 600 e 700 em títulos; nada de peso intermediário que a fonte não tem.

`font-variant-numeric: tabular-nums` global em tabela, badge e qualquer horário — sem isso
a coluna `08:00 – 08:00` dança conforme o dígito.

### 3.4 Espaçamento, raio, sombra

Espaçamento base 4px, ~12% mais denso que o padrão Mantine:

```
spacing: xs 6 | sm 10 | md 14 | lg 20 | xl 28
radius:  xs 2 | sm 4 | md 6 | lg 8 | xl 12      defaultRadius: 'sm'
```

`defaultRadius` sai de `md` (6px) para `sm` (4px). Canto mais fechado lê como instrumento;
canto arredondado lê como aplicativo de consumo.

Sombra usada com parcimônia — **separação por borda, não por elevação**. Sombra fica para
o que de fato flutua (modal, popover, dropdown). Em modo escuro a sombra é quase invisível,
então a borda é a única separação confiável nas duas polaridades.

## 4. Camada de defaults de componente

É aqui que está a alavanca do redesign. Usando `Component.extend()` do Mantine, as 18 telas
herdam o acabamento **sem serem editadas**:

| Componente | Default |
|---|---|
| `Button` | `radius: 'sm'`, `fw: 600` |
| `Paper` / `Card` | `withBorder`, `shadow: 'none'`, `radius: 'sm'` |
| `Table` | `highlightOnHover`, `tabular-nums` |
| `Badge` | `variant: 'light'`, `radius: 'sm'`, **sem caixa-alta** |
| `TextInput` / `Select` / `NumberInput` | `size: 'sm'` |
| `Modal` | `centered`, `radius: 'md'` |
| `Title` | `textWrap: 'balance'` |

O `Badge` merece nota: o Mantine força caixa-alta por padrão. `EM VALIDAÇÃO` e
`AGUARDANDO REGISTRO` em caixa-alta são visivelmente mais difíceis de ler que em caixa
mista, e o sistema tem badge de status em quase toda tela.

`stickyHeader` **não** entra como default global: a prop exige que a tabela esteja dentro de
um `Table.ScrollContainer` com altura definida, e a maioria das tabelas do sistema não está.
Aplicada caso a caso na fase 5, onde a tabela é longa (Resumo de Serviços, Worklists).

## 5. Primitivos compartilhados

Seis componentes novos em `apps/web/src/components/ui/`. Cada um substitui um padrão
ad-hoc contado na seção 1.

| Primitivo | Substitui | API |
|---|---|---|
| `PageHeader` | 18 títulos ad-hoc | `title`, `subtitle?`, `actions?` |
| `EmptyState` | 17 textos `dimmed` | `icon`, `title`, `description?`, `action?` |
| `LoadingState` | 12 `<Loader/>` | `variant: 'table' \| 'cards' \| 'form'` (esqueleto) |
| `ErrorState` | nada (hoje não existe) | `message`, `onRetry?` |
| `StatusBadge` | `StatusExecucaoBadge` + badges soltos | `status` → token + rótulo |
| `ColorSchemeToggle` | nada | botão no cabeçalho |

`LoadingState` usa esqueleto com a forma do conteúdo real, não um giro centralizado.
O giro não informa nada; o esqueleto diz o que está por vir e elimina o salto de layout
quando os dados chegam.

`StatusBadge` centraliza o mapa estado→cor→rótulo que hoje está espalhado. Passa a ser o
único lugar que sabe que `em_validacao` se escreve "Em validação" e é âmbar.

## 6. AppShell

Três mudanças, todas de cromo:

1. **Navbar deixa de ser vermelha.** Superfície neutra (`gray.0` / `dark.7`), borda à direita.
   O vermelho vira uma barra de 3px à esquerda do item ativo.
2. **Indicador de rota ativa.** Hoje os `NavLink` não recebem `active` — o usuário navega sem
   saber onde está. Resolvido com `useRouterState` alimentando `active`.
3. **Cabeçalho ganha conteúdo à esquerda.** Hoje só tem o burger; o bloco de usuário está
   empurrado para a direita com `ml="auto"`. Passa a ter marca à esquerda, usuário +
   alternador de tema à direita.

## 7. Modo escuro

- `MantineProvider defaultColorScheme="auto"` + `<ColorSchemeScript />` no `index.html`
  (sem isso há flash de tema claro antes da hidratação).
- `ColorSchemeToggle` com `useMantineColorScheme` no cabeçalho; preferência persistida.
- **Os 19 hardcodes de cor têm que morrer.** `bg="gray.1"` no `LoginForm`, `bg="cbmrn.7"` e
  `c="white"` no `AppShell`, `c="cbmrn.7"` nos títulos. Cada um vira token que responde à
  polaridade, via `light-dark()` ou variável de tema.

Modo escuro é barato agora e caro depois: refazer 18 telas para caberem no escuro é outro
projeto.

## 8. Responsivo

Prioridade declarada: o fiscal registra execução no quartel, possivelmente no celular.

| Faixa | Alvo | Tratamento |
|---|---|---|
| 375px | telas de Execução e Validação | cartões empilhados, alvo de toque ≥44px, barra de ações fixa no rodapé |
| 768px | tudo | nada quebra; grades caem para 1–2 colunas |
| 1440px | Escala / Layouts / Aprovação | densidade máxima, é o alvo do escalante |

As demais telas (Layouts, Elegibilidade, Nova Escala) precisam apenas **não quebrar** em
375px — não recebem layout dedicado de celular.

## 9. Acessibilidade

Critérios de aceite, verificáveis:

- Contraste ≥4,5:1 para texto normal e ≥3:1 para texto grande, **nas duas polaridades**.
- Anel de foco visível em todo elemento interativo, com deslocamento (não só borda de cor).
- Alvo de toque ≥44×44px nas telas de celular.
- Cor nunca é o único indicador: cobertura parcial leva ícone/rótulo além do âmbar.
- Todo botão só-de-ícone tem `aria-label`.
- `prefers-reduced-motion` respeitado em qualquer transição introduzida.

## 10. Faseamento

| Fase | Entrega | Arquivos de tela tocados |
|---|---|---|
| 1 | Tokens + fontes + `theme.ts` | 0 |
| 2 | Defaults de componente + `ColorSchemeScript` + alternador | 0 |
| 3 | AppShell (navbar neutra, rota ativa, cabeçalho) | 0 (só `AppShell.tsx`) |
| 4 | Os seis primitivos + testes | 0 |
| 5 | Passada tela a tela: aplicar primitivos, matar os 19 hardcodes | 18 |
| 6 | Responsivo de Execução/Validação | 4 |
| 7 | QA: contraste, dark, 375/768/1440, suíte verde | 0 |

Fases 1–2 sozinhas já melhoram as 18 telas por herança. Fase 5 é a mais longa e a mais
mecânica — é onde a contagem da seção 1 vai a zero.

## 11. Riscos

**Os 33 arquivos de teste do web.** Testes que consultam por texto quebram quando a cópia se
move para dentro de um primitivo. Mitigação: os primitivos preservam as strings existentes
(`EmptyState title="Sem guarnições para hoje."`), e a suíte roda ao fim de cada fase, não só
no final.

**Densificar o espaçamento aperta tudo de uma vez.** `spacing` é global; reduzir `md` de 16
para 14px muda toda tela simultaneamente. Mitigação: a mudança é de ~12%, aplicada na fase 1,
onde ainda dá para calibrar antes de qualquer tela ser tocada.

**`SeletorDeDia` e `corCobertura` são função pura com teste.** Trocar cor inline por token
muda o valor retornado. O teste precisa acompanhar; a lógica de cobertura, não.

## 12. Critérios de aceite

- [ ] `<Loader />` cru: 12 → 0
- [ ] Textos `dimmed` como estado vazio: 17 → 0
- [ ] Títulos de página ad-hoc: 18 → 0 (todos via `PageHeader`)
- [ ] Cores hardcoded: 19 → 0
- [ ] Contraste do botão primário: 4,50:1 → 5,68:1
- [ ] Alternador de tema funcionando, sem flash no carregamento
- [ ] Execução e Validação usáveis em 375px
- [ ] `pnpm --filter @escalas/web test` verde (33 arquivos)
- [ ] `pnpm --filter @escalas/web build` limpo (inclui `tsc --noEmit`)
- [ ] `pnpm --filter @escalas/web lint` limpo

## 13. Dependências novas

```
@fontsource/ibm-plex-sans
@fontsource/ibm-plex-mono
```

Só isso. Nenhuma biblioteca de UI, nenhum runtime de CSS, nenhuma dependência de rede.
