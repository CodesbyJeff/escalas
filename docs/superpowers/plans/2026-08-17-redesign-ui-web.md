# Redesign de UI/UX do apps/web — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao `apps/web` um sistema de design (tokens, defaults de componente, primitivos compartilhados, modo escuro) e reaplicá-lo nas 18 telas, sem alterar nenhum fluxo.

**Architecture:** Duas alavancas em sequência. Primeiro o tema Mantine vira a fonte de verdade dos tokens e ganha defaults por componente — isso melhora as 18 telas **por herança**, sem editar nenhuma. Depois, seis primitivos compartilhados substituem os padrões ad-hoc que a herança não alcança (12 loaders crus, 17 estados vazios como texto solto, 18 títulos ad-hoc, 19 cores hardcoded).

**Tech Stack:** React 18, Vite 5, Mantine **7.17.8**, TanStack Router 1.170.16 / Query 5, Vitest 2 + Testing Library, TypeScript 5.4.

**Spec:** `docs/superpowers/specs/2026-08-17-redesign-ui-web-design.md`

## Global Constraints

- **Nenhum fluxo muda.** Nenhuma rota nova, nenhuma rota removida, nenhuma mudança de navegação além do indicador de rota ativa. Se uma tarefa parecer exigir mudança de fluxo, pare e reporte.
- **Nenhuma dependência de rede em runtime.** Roda em intranet. Fontes empacotadas via `@fontsource`; nada de CDN, nada de `<link>` para Google Fonts.
- **Preservar as strings de cópia existentes.** 33 arquivos de teste consultam por texto. Ao mover cópia para dentro de um primitivo, o texto visível tem que continuar idêntico (ex.: `EmptyState` recebe `title="Sem guarnições para hoje."`).
- **Só três tuplas de cor customizadas:** `cbmrn`, `gray`, `dark`. `blue`, `teal`, `yellow` ficam nativas do Mantine.
- **`primaryShade: { light: 7, dark: 5 }`** — não o default 6. O shade 6 (`#de3535`) dá contraste 4,50:1 com branco, exatamente no limite AA.
- **Pesos de fonte importados:** IBM Plex Sans 400/500/600/700; IBM Plex Mono 400/500. Nenhum outro.
- **Comando de verificação ao fim de toda tarefa:**
  `pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint`
  (`build` roda `tsc --noEmit` antes do Vite — é o typecheck.)
- **`noUnusedLocals` e `noUnusedParameters` estão LIGADOS** no `apps/web/tsconfig.json`. Ao
  remover JSX, remova também o import, o `useState`, o handler e os tipos que só ele usava —
  senão `tsc --noEmit` falha com `TS6133`. Isto morde principalmente as Tasks 11, 12 e 13, que
  retiram `Title`, `Loader` e `Text` de muitos arquivos.
- **`moduleResolution` é `Bundler`** — `import ... from './theme'` resolve `./theme/index.ts`.
  Verificado no `tsconfig.json`; nenhum import precisa mudar quando `theme.ts` vira diretório.
- **Commits em português**, prefixo emoji, seguindo o histórico do repositório (`✨ feat(web):`, `💄 style(web):`, `♻️ refactor(web):`).
- Trabalhar na branch **`main`** (estratégia do projeto). **Não fazer push** — o push é decisão do usuário.

---

## Mapa de arquivos

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/postcss.config.cjs` | Habilita `postcss-preset-mantine` (mixins `light-dark`, breakpoints) |
| `apps/web/src/theme/palette.ts` | As três tuplas de cor customizadas |
| `apps/web/src/theme/contrast.ts` | Cálculo de razão de contraste WCAG (usado por teste e QA) |
| `apps/web/src/theme/semantic.ts` | Mapa estado-de-domínio → cor + rótulo |
| `apps/web/src/theme/components.ts` | Defaults por componente Mantine |
| `apps/web/src/theme/index.ts` | Monta e exporta `theme` (substitui `src/theme.ts`) |
| `apps/web/src/styles/global.css` | Algarismos tabulares, letter-spacing, foco, reduced-motion |
| `apps/web/src/components/ui/PageHeader.tsx` | Cabeçalho de página padrão |
| `apps/web/src/components/ui/EmptyState.tsx` | Estado vazio |
| `apps/web/src/components/ui/ErrorState.tsx` | Estado de erro com retentar |
| `apps/web/src/components/ui/LoadingState.tsx` | Esqueletos de carregamento |
| `apps/web/src/components/ui/StatusBadge.tsx` | Badge de estado de domínio |
| `apps/web/src/components/ui/ColorSchemeToggle.tsx` | Alternador claro/escuro |
| `apps/web/src/components/ui/index.ts` | Reexporta os primitivos |

**Removidos:** `apps/web/src/theme.ts` (vira `src/theme/index.ts`; os importadores usam `'./theme'` / `'../theme'`, que passam a resolver o diretório — nenhum import muda).

**Modificados:** `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/components/AppShell.tsx`, e as 18 telas listadas nas Tarefas 11–14.

---

### Task 1: Dependências, PostCSS e paleta com trava de contraste

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/postcss.config.cjs`
- Create: `apps/web/src/theme/contrast.ts`
- Create: `apps/web/src/theme/palette.ts`
- Test: `apps/web/src/theme/palette.test.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces:
  - `contrastRatio(hexA: string, hexB: string): number` — de `src/theme/contrast.ts`
  - `cbmrn: MantineColorsTuple`, `gray: MantineColorsTuple`, `dark: MantineColorsTuple` — de `src/theme/palette.ts`

- [ ] **Step 1: Instalar dependências**

```bash
cd /c/Users/CTIC/Desktop/escalas
pnpm --filter @escalas/web add @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
pnpm --filter @escalas/web add -D postcss postcss-preset-mantine postcss-simple-vars
```

- [ ] **Step 2: Criar `apps/web/postcss.config.cjs`**

Sem isto os mixins `light-dark()` e de breakpoint do Mantine não funcionam em CSS Modules. O projeto nunca teve este arquivo — ele faz parte do setup Vite oficial do Mantine.

```js
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
```

- [ ] **Step 3: Escrever o teste que falha**

Este teste trava o achado de acessibilidade do spec: o shade primário tem que passar AA com folga, não no limite.

Criar `apps/web/src/theme/palette.test.ts`:

```ts
import { contrastRatio } from './contrast';
import { cbmrn, gray, dark } from './palette';

describe('contrastRatio', () => {
  it('branco contra preto é 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
  it('é simétrico', () => {
    expect(contrastRatio('#c52729', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#c52729'), 5);
  });
});

describe('paleta cbmrn', () => {
  it('tem 10 passos', () => {
    expect(cbmrn).toHaveLength(10);
  });

  // Trava do spec: o shade 6 (default do Mantine) fica em 4,50:1 — no limite exato do AA.
  // Por isso o tema usa primaryShade 7 no modo claro.
  it('shade 6 fica no limite do AA, por isso não é o primário', () => {
    expect(contrastRatio(cbmrn[6], '#ffffff')).toBeLessThan(4.6);
  });

  it('shade 7 passa AA com folga para texto branco', () => {
    expect(contrastRatio(cbmrn[7], '#ffffff')).toBeGreaterThanOrEqual(5);
  });
});

describe('neutros frios', () => {
  it('gray.6 (texto secundário) passa AA sobre o fundo da aplicação gray.0', () => {
    expect(contrastRatio(gray[6], gray[0])).toBeGreaterThanOrEqual(4.5);
  });
  it('dark.2 (texto secundário no escuro) passa AA sobre o corpo dark.7', () => {
    expect(contrastRatio(dark[2], dark[7])).toBeGreaterThanOrEqual(4.5);
  });
  it('as tuplas neutras têm 10 passos', () => {
    expect(gray).toHaveLength(10);
    expect(dark).toHaveLength(10);
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/theme/palette.test.ts`
Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 5: Implementar `apps/web/src/theme/contrast.ts`**

```ts
/** Luminância relativa de uma cor sRGB, conforme WCAG 2.1. */
function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace('#', '');
  const canais = [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razão de contraste WCAG entre duas cores hex (`#rrggbb`).
 * Retorna de 1 (idênticas) a 21 (preto contra branco).
 * AA exige 4.5 para texto normal e 3 para texto grande.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminanciaRelativa(hexA);
  const b = luminanciaRelativa(hexB);
  const claro = Math.max(a, b);
  const escuro = Math.min(a, b);
  return (claro + 0.05) / (escuro + 0.05);
}
```

- [ ] **Step 6: Implementar `apps/web/src/theme/palette.ts`**

```ts
import type { MantineColorsTuple } from '@mantine/core';

/**
 * Vermelho CBMRN — identidade e ação primária.
 * O tema usa primaryShade 7 (não o default 6): o 6 fica em 4,50:1 sobre branco,
 * exatamente no mínimo AA, sem margem alguma.
 */
export const cbmrn: MantineColorsTuple = [
  '#ffeaea', '#fdd5d5', '#f3acac', '#ea7f7f', '#e35a5a',
  '#df4242', '#de3535', '#c52729', '#b01f24', '#9a141d',
];

/** Neutro frio — superfícies e texto do modo claro. */
export const gray: MantineColorsTuple = [
  '#f6f8fa', '#edf1f5', '#dde3ea', '#c6d0da', '#a9b6c4',
  '#8b9aab', '#6e7e90', '#566475', '#3e4a58', '#2a333e',
];

/** Neutro frio — superfícies e texto do modo escuro. Índice 7 é o fundo do corpo. */
export const dark: MantineColorsTuple = [
  '#c9d1d9', '#b0bac5', '#8b95a1', '#6b7785', '#4c5764',
  '#3a434f', '#2c343e', '#1f262e', '#171d24', '#10151a',
];
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/theme/palette.test.ts`
Expected: PASS, 7 testes.

Se `gray[6]` contra `gray[0]` falhar, escureça `gray[6]` um passo (ex.: `#66768a`) e rode de novo. **Não relaxe a asserção** — ela existe justamente para impedir texto secundário ilegível.

- [ ] **Step 8: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/package.json apps/web/postcss.config.cjs apps/web/src/theme pnpm-lock.yaml
git commit -m "✨ feat(web): paleta neutra fria + trava de contraste WCAG

Três tuplas customizadas (cbmrn, gray, dark) e util de razão de contraste.
Teste trava o shade primário em >=5:1 — o shade 6 atual fica em 4,50:1,
exatamente no limite AA."
```

---

### Task 2: Tema base — tipografia, espaçamento, raio, sombra

**Files:**
- Create: `apps/web/src/theme/index.ts`
- Create: `apps/web/src/styles/global.css`
- Delete: `apps/web/src/theme.ts`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: `cbmrn`, `gray`, `dark` de `./palette`.
- Produces: `theme: MantineThemeOverride` — de `src/theme/index.ts`. Os importadores existentes (`main.tsx` com `'./theme'`, `src/test/render.tsx` com `'../theme'`) resolvem para o diretório automaticamente. **Nenhum import muda.**

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/theme/theme.test.ts`:

```ts
import { theme } from './index';

describe('theme', () => {
  it('usa cbmrn como cor primária no shade 7 (claro) e 5 (escuro)', () => {
    expect(theme.primaryColor).toBe('cbmrn');
    expect(theme.primaryShade).toEqual({ light: 7, dark: 5 });
  });

  it('liga autoContrast para o texto de superfícies coloridas', () => {
    expect(theme.autoContrast).toBe(true);
  });

  it('usa IBM Plex, não system-ui', () => {
    expect(theme.fontFamily).toContain('IBM Plex Sans');
    expect(theme.fontFamilyMonospace).toContain('IBM Plex Mono');
  });

  it('customiza exatamente três tuplas de cor', () => {
    expect(Object.keys(theme.colors ?? {}).sort()).toEqual(['cbmrn', 'dark', 'gray']);
  });

  it('adota raio pequeno por padrão', () => {
    expect(theme.defaultRadius).toBe('sm');
  });

  it('densifica o espaçamento abaixo do padrão Mantine (md era 16px)', () => {
    expect(theme.spacing?.md).toBe('0.875rem'); // 14px
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/theme/theme.test.ts`
Expected: FAIL — o diretório `src/theme/index.ts` ainda não existe.

- [ ] **Step 3: Criar `apps/web/src/theme/index.ts`**

```ts
import { createTheme, rem } from '@mantine/core';
import { cbmrn, gray, dark } from './palette';

export { contrastRatio } from './contrast';

export const theme = createTheme({
  primaryColor: 'cbmrn',
  // Shade 7, não o default 6: o 6 dá 4,50:1 sobre branco — no limite exato do AA.
  primaryShade: { light: 7, dark: 5 },
  autoContrast: true,
  colors: { cbmrn, gray, dark },

  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, monospace",

  fontSizes: {
    xs: rem(12), sm: rem(13), md: rem(14), lg: rem(16), xl: rem(18),
  },
  lineHeights: {
    xs: '1.4', sm: '1.45', md: '1.45', lg: '1.5', xl: '1.5',
  },
  headings: {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.2', fontWeight: '700' },
      h2: { fontSize: rem(22), lineHeight: '1.2', fontWeight: '700' },
      h3: { fontSize: rem(18), lineHeight: '1.25', fontWeight: '600' },
      h4: { fontSize: rem(16), lineHeight: '1.3', fontWeight: '600' },
      h5: { fontSize: rem(14), lineHeight: '1.35', fontWeight: '600' },
      h6: { fontSize: rem(13), lineHeight: '1.4', fontWeight: '600' },
    },
  },

  // ~12% mais denso que o padrão Mantine (10/12/16/20/32).
  spacing: {
    xs: rem(6), sm: rem(10), md: rem(14), lg: rem(20), xl: rem(28),
  },
  radius: {
    xs: rem(2), sm: rem(4), md: rem(6), lg: rem(8), xl: rem(12),
  },
  defaultRadius: 'sm',

  // Separação por borda, não por elevação. Sombra só para o que de fato flutua.
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 32, 0.06)',
    sm: '0 1px 3px rgba(15, 23, 32, 0.08), 0 1px 2px rgba(15, 23, 32, 0.06)',
    md: '0 4px 12px rgba(15, 23, 32, 0.10)',
    lg: '0 8px 24px rgba(15, 23, 32, 0.12)',
    xl: '0 16px 40px rgba(15, 23, 32, 0.16)',
  },
});
```

> O reexport de `./semantic` **não** aparece aqui de propósito — esse módulo só nasce na Task 3,
> e a linha quebraria o build agora. A Task 3 a adiciona.

- [ ] **Step 4: Criar `apps/web/src/styles/global.css`**

O tema Mantine não tem token de `letter-spacing` nem de `font-variant-numeric`; isso vive em CSS global.

```css
/* Algarismos tabulares: sem isto a coluna "08:00 – 08:00" dança conforme o dígito. */
table,
.mantine-Badge-root,
[data-tabular] {
  font-variant-numeric: tabular-nums;
}

/* Títulos ligeiramente mais apertados — leitura técnica, não editorial. */
h1, h2, h3, h4, h5, h6,
.mantine-Title-root {
  letter-spacing: -0.01em;
}

/* Foco sempre visível e destacado da borda do elemento. */
:focus-visible {
  outline: 2px solid var(--mantine-primary-color-filled);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Apagar o tema antigo e ligar fontes + CSS global**

```bash
rm apps/web/src/theme.ts
```

Em `apps/web/src/main.tsx`, adicionar aos imports de CSS já existentes (depois de `@mantine/core/styles.css`, antes de `./theme`):

```ts
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
```

A linha `import { theme } from './theme';` **não muda** — passa a resolver `./theme/index.ts`.

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/theme/theme.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `pnpm --filter @escalas/web test`
Expected: os 33 arquivos verdes. Densificar `spacing` não muda texto nem papel acessível, então nenhum teste existente deve quebrar. Se algum quebrar, **leia o teste antes de mudar qualquer coisa** — pode ser um acoplamento real a valor de espaçamento, que merece ser reportado, não silenciado.

- [ ] **Step 8: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "💄 style(web): tema base — IBM Plex, escala densa, raio pequeno

theme.ts vira src/theme/index.ts (imports inalterados). Fontes empacotadas
via @fontsource, sem CDN — a aplicação roda em intranet."
```

---

### Task 3: Tokens semânticos de domínio

**Files:**
- Create: `apps/web/src/theme/semantic.ts`
- Modify: `apps/web/src/theme/index.ts` (adicionar `export * from './semantic'`)
- Test: `apps/web/src/theme/semantic.test.ts`

**Interfaces:**
- Consumes: nada além dos tipos do Mantine.
- Produces:
  - `type StatusEscala = 'rascunho' | 'publicada' | 'em_validacao' | 'aprovada' | 'rejeitada'`
  - `type TokenSemantico = { color: string; light: number; dark: number; label: string }`
  - `STATUS_ESCALA: Record<StatusEscala, TokenSemantico>`
  - `COBERTURA: Record<'completa' | 'parcial', TokenSemantico>`
  - `AVISO: Record<'patente' | 'conflito', TokenSemantico>`
  - `tokenCor(t: TokenSemantico, esquema: 'light' | 'dark'): string` → string de cor Mantine tipo `'teal.7'`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/theme/semantic.test.ts`:

```ts
import { STATUS_ESCALA, COBERTURA, AVISO, tokenCor } from './semantic';

describe('tokens semânticos', () => {
  it('cobre os cinco estados de escala', () => {
    expect(Object.keys(STATUS_ESCALA).sort()).toEqual(
      ['aprovada', 'em_validacao', 'publicada', 'rascunho', 'rejeitada'],
    );
  });

  it('usa rótulo em caixa mista, não caixa-alta', () => {
    expect(STATUS_ESCALA.em_validacao.label).toBe('Em validação');
    expect(STATUS_ESCALA.rascunho.label).toBe('Rascunho');
  });

  it('só usa famílias nativas do Mantine ou a marca', () => {
    const familias = [
      ...Object.values(STATUS_ESCALA),
      ...Object.values(COBERTURA),
      ...Object.values(AVISO),
    ].map((t) => t.color);
    for (const f of familias) {
      expect(['gray', 'blue', 'teal', 'yellow', 'cbmrn']).toContain(f);
    }
  });

  // O amarelo do Mantine só passa 4,5:1 sobre branco a partir do shade 8.
  it('âmbar usa shade 8 no claro', () => {
    expect(COBERTURA.parcial.color).toBe('yellow');
    expect(COBERTURA.parcial.light).toBe(8);
    expect(AVISO.patente.light).toBe(8);
    expect(STATUS_ESCALA.em_validacao.light).toBe(8);
  });

  it('conflito de turno é vermelho da marca (barreira dura)', () => {
    expect(AVISO.conflito.color).toBe('cbmrn');
  });

  it('tokenCor monta a string de cor Mantine por polaridade', () => {
    expect(tokenCor(COBERTURA.completa, 'light')).toBe('teal.7');
    expect(tokenCor(COBERTURA.completa, 'dark')).toBe('teal.4');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/theme/semantic.test.ts`
Expected: FAIL — `Failed to resolve import "./semantic"`.

- [ ] **Step 3: Implementar `apps/web/src/theme/semantic.ts`**

```ts
/**
 * Tokens semânticos de domínio.
 *
 * Regra: a tela declara SIGNIFICADO, não cor. Antes desta camada,
 * SeletorDeDia.tsx escolhia cobertura com `var(--mantine-color-green-2)` inline.
 *
 * `light`/`dark` são os shades por polaridade. O amarelo do Mantine só passa
 * 4,5:1 sobre branco a partir do shade 8 — por isso âmbar é 8, não o 6 habitual.
 */
export type TokenSemantico = {
  color: 'gray' | 'blue' | 'teal' | 'yellow' | 'cbmrn';
  light: number;
  dark: number;
  label: string;
};

export type StatusEscala =
  | 'rascunho' | 'publicada' | 'em_validacao' | 'aprovada' | 'rejeitada';

export const STATUS_ESCALA: Record<StatusEscala, TokenSemantico> = {
  rascunho:     { color: 'gray',   light: 6, dark: 4, label: 'Rascunho' },
  publicada:    { color: 'blue',   light: 7, dark: 4, label: 'Publicada' },
  em_validacao: { color: 'yellow', light: 8, dark: 5, label: 'Em validação' },
  aprovada:     { color: 'teal',   light: 7, dark: 4, label: 'Aprovada' },
  rejeitada:    { color: 'cbmrn',  light: 7, dark: 5, label: 'Rejeitada' },
};

export const COBERTURA: Record<'completa' | 'parcial', TokenSemantico> = {
  completa: { color: 'teal',   light: 7, dark: 4, label: 'Completo' },
  parcial:  { color: 'yellow', light: 8, dark: 5, label: 'Vaga aberta' },
};

export const AVISO: Record<'patente' | 'conflito', TokenSemantico> = {
  patente:   { color: 'yellow', light: 8, dark: 5, label: 'Patente divergente' },
  conflito:  { color: 'cbmrn',  light: 7, dark: 5, label: 'Conflito de turno' },
};

/** Monta a string de cor Mantine (`'teal.7'`) para a polaridade dada. */
export function tokenCor(t: TokenSemantico, esquema: 'light' | 'dark'): string {
  return `${t.color}.${esquema === 'dark' ? t.dark : t.light}`;
}
```

- [ ] **Step 4: Reexportar do tema**

Em `apps/web/src/theme/index.ts`, adicionar após o import de `palette`:

```ts
export * from './semantic';
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/theme/semantic.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/theme
git commit -m "✨ feat(web): tokens semânticos de domínio

Estado de escala, cobertura e avisos viram token nomeado com shade por
polaridade. Âmbar em shade 8 — o yellow do Mantine só passa AA a partir dele."
```

---

### Task 4: Defaults por componente

Esta é a alavanca do redesign: as 18 telas herdam o acabamento sem serem editadas.

**Files:**
- Create: `apps/web/src/theme/components.ts`
- Modify: `apps/web/src/theme/index.ts`
- Test: `apps/web/src/theme/components.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `componentes` — objeto pronto para a chave `components` de `createTheme`. Consumido só por `src/theme/index.ts`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/theme/components.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { Badge, Card } from '@mantine/core';
import { renderWithProviders } from '../test/render';

describe('defaults de componente', () => {
  // O Mantine força caixa-alta no label do Badge. "EM VALIDAÇÃO" é
  // mensuravelmente mais difícil de ler que "Em validação", e há badge de
  // status em quase toda tela do sistema.
  it('Badge não usa caixa-alta', () => {
    renderWithProviders(<Badge>Em validação</Badge>);
    const label = screen.getByText('Em validação');
    expect(getComputedStyle(label).textTransform).toBe('none');
  });

  it('Card nasce com borda', () => {
    const { container } = renderWithProviders(<Card>conteúdo</Card>);
    expect(container.querySelector('[data-with-border]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/theme/components.test.tsx`
Expected: FAIL — `textTransform` vem `uppercase`, e o `Card` não tem `data-with-border`.

- [ ] **Step 3: Implementar `apps/web/src/theme/components.ts`**

```ts
import {
  Badge, Button, Card, Modal, NumberInput, Select, Table, TextInput, Title,
} from '@mantine/core';

/**
 * Defaults por componente — a alavanca do redesign.
 *
 * NÃO estender `Paper`: Modal.Content, Popover.Dropdown e Menu.Dropdown são
 * construídos sobre Paper internamente, e um `withBorder` global colocaria
 * borda em toda sobreposição do sistema. Card é seguro; Paper não é.
 */
export const componentes = {
  Button: Button.extend({
    defaultProps: { radius: 'sm' },
    styles: { root: { fontWeight: 600 } },
  }),

  Card: Card.extend({
    defaultProps: { withBorder: true, radius: 'sm', shadow: undefined, padding: 'md' },
  }),

  Badge: Badge.extend({
    defaultProps: { variant: 'light', radius: 'sm' },
    styles: { label: { textTransform: 'none', fontWeight: 600 } },
  }),

  Table: Table.extend({
    defaultProps: { highlightOnHover: true, verticalSpacing: 'xs', horizontalSpacing: 'sm' },
  }),

  TextInput: TextInput.extend({ defaultProps: { size: 'sm' } }),
  Select: Select.extend({ defaultProps: { size: 'sm' } }),
  NumberInput: NumberInput.extend({ defaultProps: { size: 'sm' } }),

  Modal: Modal.extend({ defaultProps: { centered: true, radius: 'md' } }),

  Title: Title.extend({ defaultProps: { textWrap: 'balance' } }),
};
```

- [ ] **Step 4: Ligar ao tema**

Em `apps/web/src/theme/index.ts`, importar e adicionar a chave:

```ts
import { componentes } from './components';
// ...dentro de createTheme({ ... }):
  components: componentes,
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/theme/components.test.tsx`
Expected: PASS, 2 testes.

Se o assert de `textTransform` falhar por o jsdom não computar estilo de classe Mantine, troque a asserção para checar a prop aplicada:
`expect(label.className).toContain('mantine-Badge-label')` e valide `textTransform` manualmente na Task 15 (QA visual). **Registre a troca no commit** — não a esconda.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `pnpm --filter @escalas/web test`
Expected: 33 arquivos verdes. Atenção especial a testes que consultam badge por texto em caixa-alta.

- [ ] **Step 7: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/theme
git commit -m "💄 style(web): defaults por componente

As 18 telas herdam acabamento sem serem editadas. Badge perde a caixa-alta.
Paper deliberadamente não estendido — Modal/Popover/Menu são construídos
sobre ele."
```

---

### Task 5: Modo escuro — script anti-flash, provider e alternador

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/components/ui/ColorSchemeToggle.tsx`
- Create: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/ColorSchemeToggle.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `ColorSchemeToggle` (sem props) — consumido pelo `AppShell` na Task 10. Exportado também por `src/components/ui/index.ts`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/components/ui/ColorSchemeToggle.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { ColorSchemeToggle } from './ColorSchemeToggle';

it('tem rótulo acessível e alterna ao clicar', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ColorSchemeToggle />);
  const botao = screen.getByRole('button', { name: /tema/i });
  expect(botao).toBeInTheDocument();
  await user.click(botao);
  // A alternância é efeito no documento; aqui garantimos que o clique não quebra.
  expect(botao).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/components/ui/ColorSchemeToggle.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `apps/web/src/components/ui/ColorSchemeToggle.tsx`**

```tsx
import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const atual = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const proximo = atual === 'dark' ? 'light' : 'dark';

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={`Mudar para tema ${proximo === 'dark' ? 'escuro' : 'claro'}`}
      onClick={() => setColorScheme(proximo)}
    >
      {atual === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}
```

- [ ] **Step 4: Criar o barril `apps/web/src/components/ui/index.ts`**

```ts
export { ColorSchemeToggle } from './ColorSchemeToggle';
```

(As Tasks 6–9 acrescentam linhas a este arquivo.)

- [ ] **Step 5: Ligar o provider em `apps/web/src/main.tsx`**

Trocar a linha do provider por:

```tsx
<MantineProvider theme={theme} defaultColorScheme="auto">
```

- [ ] **Step 6: Adicionar o script anti-flash em `apps/web/index.html`**

Numa SPA Vite o `MantineProvider` só aplica a polaridade depois que o JS carrega — o usuário de tema escuro vê um lampejo branco a cada carregamento. Este script roda antes da primeira pintura. A chave `mantine-color-scheme-value` e o atributo `data-mantine-color-scheme` foram lidos do pacote `@mantine/core` instalado (7.17.8), não presumidos.

Dentro de `<head>`, logo antes de `</head>`:

```html
<script>
  (function () {
    try {
      var v = localStorage.getItem('mantine-color-scheme-value');
      var escuro = v === 'dark' || ((!v || v === 'auto') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute(
        'data-mantine-color-scheme', escuro ? 'dark' : 'light');
    } catch (e) { /* localStorage bloqueado: cai no default do provider */ }
  })();
</script>
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/components/ui/ColorSchemeToggle.test.tsx`
Expected: PASS, 1 teste.

- [ ] **Step 8: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/index.html apps/web/src
git commit -m "✨ feat(web): modo escuro com alternador e script anti-flash

Chave de armazenamento lida do @mantine/core 7.17.8. Numa SPA Vite o
provider só aplica a polaridade após o JS — sem o script há lampejo branco."
```

---

### Task 6: Primitivo `PageHeader`

Substitui os 18 títulos ad-hoc, onde `order` varia entre 3, 4, 5 e 6 para a mesma hierarquia.

**Files:**
- Create: `apps/web/src/components/ui/PageHeader.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/PageHeader.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `PageHeader` com props
  `{ title: string; subtitle?: string; actions?: ReactNode }`.
  Consumido pelas Tasks 11, 12 e 13.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/components/ui/PageHeader.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { Button } from '@mantine/core';
import { renderWithProviders } from '../../test/render';
import { PageHeader } from './PageHeader';

it('renderiza o título como heading de nível 1 da página', () => {
  renderWithProviders(<PageHeader title="Lista de Escalas" />);
  expect(screen.getByRole('heading', { name: 'Lista de Escalas', level: 1 })).toBeInTheDocument();
});

it('mostra o subtítulo quando fornecido', () => {
  renderWithProviders(<PageHeader title="Escalas" subtitle="1º BBM — agosto de 2026" />);
  expect(screen.getByText('1º BBM — agosto de 2026')).toBeInTheDocument();
});

it('não renderiza subtítulo quando ausente', () => {
  const { container } = renderWithProviders(<PageHeader title="Escalas" />);
  expect(container.querySelectorAll('p')).toHaveLength(0);
});

it('posiciona as ações', () => {
  renderWithProviders(<PageHeader title="Escalas" actions={<Button>Nova</Button>} />);
  expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/components/ui/PageHeader.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `apps/web/src/components/ui/PageHeader.tsx`**

```tsx
import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Cabeçalho de página padrão.
 *
 * Um único nível semântico (h1) para o título da página, em toda tela. Antes
 * disto o sistema tinha 18 títulos com `order` entre 3 e 6 para a mesma
 * hierarquia — o que quebrava a navegação por heading em leitor de tela.
 */
export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" mb="md">
      <Stack gap={2}>
        <Title order={1} fz="h3">{title}</Title>
        {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
      </Stack>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}
```

> `order={1}` dá a semântica correta; `fz="h3"` mantém o tamanho visual compacto que a densidade pede. Semântica e tamanho são coisas distintas.

- [ ] **Step 4: Exportar do barril**

Adicionar a `apps/web/src/components/ui/index.ts`:

```ts
export { PageHeader } from './PageHeader';
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/components/ui/PageHeader.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/components/ui
git commit -m "✨ feat(web): primitivo PageHeader"
```

---

### Task 7: Primitivos `EmptyState` e `ErrorState`

`EmptyState` substitui os 17 textos `c="dimmed"` que hoje fazem papel de estado vazio. `ErrorState` preenche uma lacuna — hoje o sistema não tem nenhum estado de erro dedicado.

**Files:**
- Create: `apps/web/src/components/ui/EmptyState.tsx`
- Create: `apps/web/src/components/ui/ErrorState.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/EmptyState.test.tsx`
- Test: `apps/web/src/components/ui/ErrorState.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `EmptyState` — `{ title: string; description?: string; icon?: ReactNode; action?: ReactNode }`
  - `ErrorState` — `{ message: string; onRetry?: () => void }`
  Consumidos pelas Tasks 11, 12 e 13.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/web/src/components/ui/EmptyState.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { Button } from '@mantine/core';
import { renderWithProviders } from '../../test/render';
import { EmptyState } from './EmptyState';

// As strings de cópia atuais são preservadas: 33 arquivos de teste consultam por texto.
it('mostra o título do estado vazio', () => {
  renderWithProviders(<EmptyState title="Sem guarnições para hoje." />);
  expect(screen.getByText('Sem guarnições para hoje.')).toBeInTheDocument();
});

it('mostra descrição e ação quando fornecidas', () => {
  renderWithProviders(
    <EmptyState
      title="Nenhuma escala"
      description="Crie a primeira escala do mês."
      action={<Button>Nova Escala</Button>}
    />,
  );
  expect(screen.getByText('Crie a primeira escala do mês.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nova Escala' })).toBeInTheDocument();
});

it('o ícone é decorativo e fica escondido do leitor de tela', () => {
  const { container } = renderWithProviders(<EmptyState title="Vazio" />);
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});
```

Criar `apps/web/src/components/ui/ErrorState.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { ErrorState } from './ErrorState';

it('mostra a mensagem de erro', () => {
  renderWithProviders(<ErrorState message="Falha ao carregar a escala." />);
  expect(screen.getByText('Falha ao carregar a escala.')).toBeInTheDocument();
});

it('chama onRetry ao clicar em Tentar novamente', async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  renderWithProviders(<ErrorState message="Falhou." onRetry={onRetry} />);
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it('omite o botão quando não há onRetry', () => {
  renderWithProviders(<ErrorState message="Falhou." />);
  expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @escalas/web test src/components/ui/EmptyState.test.tsx src/components/ui/ErrorState.test.tsx`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 3: Implementar `apps/web/src/components/ui/EmptyState.tsx`**

```tsx
import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

/**
 * Estado vazio desenhado.
 *
 * Substitui os textos `c="dimmed"` soltos. Um estado vazio sem forma é
 * indistinguível de uma tela quebrada — o usuário não sabe se não há dado
 * ou se algo falhou.
 */
export function EmptyState({ title, description, icon, action }: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" maw={420}>
        <ThemeIcon variant="light" color="gray" size={44} radius="xl" aria-hidden="true">
          {icon ?? <IconInbox size={22} />}
        </ThemeIcon>
        <Text fw={600} ta="center">{title}</Text>
        {description && <Text size="sm" c="dimmed" ta="center">{description}</Text>}
        {action}
      </Stack>
    </Center>
  );
}
```

- [ ] **Step 4: Implementar `apps/web/src/components/ui/ErrorState.tsx`**

```tsx
import { Alert, Button, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

/**
 * Estado de erro com recuperação.
 *
 * `variant="light"` por decisão do spec: vermelho preenchido fica reservado
 * a ação primária e ao badge de conflito. Erro comunica por superfície
 * tingida, não por bloco chapado.
 */
export function ErrorState({ message, onRetry }: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      variant="light"
      color="cbmrn"
      title="Não foi possível carregar"
      icon={<IconAlertTriangle size={18} />}
    >
      {message}
      {onRetry && (
        <Group mt="sm">
          <Button size="xs" variant="default" onClick={onRetry}>Tentar novamente</Button>
        </Group>
      )}
    </Alert>
  );
}
```

- [ ] **Step 5: Exportar do barril**

Adicionar a `apps/web/src/components/ui/index.ts`:

```ts
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @escalas/web test src/components/ui/EmptyState.test.tsx src/components/ui/ErrorState.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 7: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/components/ui
git commit -m "✨ feat(web): primitivos EmptyState e ErrorState"
```

---

### Task 8: Primitivo `LoadingState`

Substitui os 12 `<Loader />` crus por esqueleto com a forma do conteúdo real.

**Files:**
- Create: `apps/web/src/components/ui/LoadingState.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/LoadingState.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `LoadingState` — `{ variant?: 'table' | 'cards' | 'form'; linhas?: number }`.
  Padrão: `variant='table'`, `linhas=5`. Consumido pelas Tasks 11, 12 e 13.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/components/ui/LoadingState.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { LoadingState } from './LoadingState';

it('anuncia carregamento ao leitor de tela', () => {
  renderWithProviders(<LoadingState />);
  expect(screen.getByRole('status')).toHaveAccessibleName('Carregando');
});

it('renderiza o número de linhas pedido', () => {
  const { container } = renderWithProviders(<LoadingState variant="table" linhas={3} />);
  expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(3);
});

it('a variante cards renderiza uma grade de esqueletos', () => {
  const { container } = renderWithProviders(<LoadingState variant="cards" linhas={4} />);
  expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(4);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/components/ui/LoadingState.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `apps/web/src/components/ui/LoadingState.tsx`**

```tsx
import { SimpleGrid, Skeleton, Stack } from '@mantine/core';

/**
 * Esqueleto de carregamento com a forma do conteúdo que está por vir.
 *
 * Um giro centralizado não informa nada e ainda provoca salto de layout
 * quando os dados chegam. O esqueleto reserva o espaço certo desde o início.
 */
export function LoadingState({ variant = 'table', linhas = 5 }: {
  variant?: 'table' | 'cards' | 'form';
  linhas?: number;
}) {
  const itens = Array.from({ length: linhas }, (_, i) => i);

  if (variant === 'cards') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} role="status" aria-label="Carregando">
        {itens.map((i) => <Skeleton key={i} height={140} radius="sm" />)}
      </SimpleGrid>
    );
  }

  if (variant === 'form') {
    return (
      <Stack role="status" aria-label="Carregando" maw={480}>
        {itens.map((i) => <Skeleton key={i} height={36} radius="sm" />)}
      </Stack>
    );
  }

  return (
    <Stack gap="xs" role="status" aria-label="Carregando">
      {itens.map((i) => <Skeleton key={i} height={32} radius="sm" />)}
    </Stack>
  );
}
```

- [ ] **Step 4: Exportar do barril**

Adicionar a `apps/web/src/components/ui/index.ts`:

```ts
export { LoadingState } from './LoadingState';
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/components/ui/LoadingState.test.tsx`
Expected: PASS, 3 testes.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/components/ui
git commit -m "✨ feat(web): primitivo LoadingState com esqueletos"
```

---

### Task 9: Primitivo `StatusBadge`

Centraliza o mapa estado→cor→rótulo, hoje espalhado entre telas.

**Files:**
- Create: `apps/web/src/components/ui/StatusBadge.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/StatusBadge.test.tsx`

**Interfaces:**
- Consumes: `STATUS_ESCALA`, `tokenCor`, `type StatusEscala` de `src/theme/semantic.ts` (Task 3).
- Produces: `StatusBadge` — `{ status: StatusEscala }`. Consumido pelas Tasks 11 e 13.

> **Nota de escopo:** o `StatusExecucaoBadge` existente (`src/features/execucao/StatusExecucaoBadge.tsx`) trata da máquina de estados de *execução* (`pendente`/`registrada`/`validada`/`rejeitada`), que é distinta da de *escala*. Ele **não é removido nem absorvido** nesta tarefa — apenas herda os defaults de `Badge` da Task 4. Fundir os dois exigiria unificar dois vocabulários de domínio, o que é mudança de domínio e está fora do escopo deste plano.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/components/ui/StatusBadge.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatusBadge } from './StatusBadge';

it('mostra o rótulo em caixa mista', () => {
  renderWithProviders(<StatusBadge status="em_validacao" />);
  expect(screen.getByText('Em validação')).toBeInTheDocument();
});

it('cobre os cinco estados de escala', () => {
  const estados = ['rascunho', 'publicada', 'em_validacao', 'aprovada', 'rejeitada'] as const;
  const rotulos = ['Rascunho', 'Publicada', 'Em validação', 'Aprovada', 'Rejeitada'];
  estados.forEach((e, i) => {
    const { unmount } = renderWithProviders(<StatusBadge status={e} />);
    expect(screen.getByText(rotulos[i])).toBeInTheDocument();
    unmount();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/components/ui/StatusBadge.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `apps/web/src/components/ui/StatusBadge.tsx`**

```tsx
import { Badge, useComputedColorScheme } from '@mantine/core';
import { STATUS_ESCALA, tokenCor, type StatusEscala } from '../../theme/semantic';

/**
 * Único lugar do sistema que sabe que `em_validacao` se escreve
 * "Em validação" e é âmbar.
 */
export function StatusBadge({ status }: { status: StatusEscala }) {
  const esquema = useComputedColorScheme('light');
  const token = STATUS_ESCALA[status];
  return <Badge color={tokenCor(token, esquema)}>{token.label}</Badge>;
}
```

- [ ] **Step 4: Exportar do barril**

Adicionar a `apps/web/src/components/ui/index.ts`:

```ts
export { StatusBadge } from './StatusBadge';
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/components/ui/StatusBadge.test.tsx`
Expected: PASS, 2 testes.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/components/ui
git commit -m "✨ feat(web): primitivo StatusBadge"
```

---

### Task 10: AppShell — navbar neutra, rota ativa, cabeçalho

**Files:**
- Modify: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/AppShell.module.css`
- Test: `apps/web/src/components/AppShell.test.tsx` (acrescentar casos; **não alterar os existentes**)

**Interfaces:**
- Consumes: `ColorSchemeToggle` de `src/components/ui` (Task 5).
- Produces: `AppShellNav` mantém **exatamente** a assinatura atual —
  `{ nome, papel, canExecutar, canValidar, canLayouts, sa?, onLogout, children? }`.
  `navFlags` fica intocada. Isso preserva os 12 testes existentes do arquivo.

- [ ] **Step 1: Escrever os testes novos que falham**

Acrescentar ao final de `apps/web/src/components/AppShell.test.tsx`:

```tsx
describe('AppShellNav — cromo', () => {
  it('a navbar não é mais um bloco vermelho sólido', () => {
    const { container } = renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    const navbar = container.querySelector('.mantine-AppShell-navbar');
    expect(navbar?.className).not.toContain('cbmrn');
  });

  it('tem alternador de tema no cabeçalho', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /tema/i })).toBeInTheDocument();
  });

  it('mostra a marca no cabeçalho', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.getAllByText('Escalas CBMRN').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `pnpm --filter @escalas/web test src/components/AppShell.test.tsx`
Expected: FAIL nos 3 casos novos; os 12 existentes continuam passando.

- [ ] **Step 3: Criar `apps/web/src/components/AppShell.module.css`**

```css
.navbar {
  background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8));
  border-right: 1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5));
}

.marca {
  font-weight: 700;
  letter-spacing: -0.01em;
  color: light-dark(var(--mantine-color-gray-9), var(--mantine-color-dark-0));
}

/* O vermelho da marca vira o indicador de rota ativa — 3px, não 260px. */
.link[data-active] {
  box-shadow: inset 3px 0 0 0 var(--mantine-color-cbmrn-filled);
}
```

> `light-dark()` aqui é o mixin do `postcss-preset-mantine` instalado na Task 1, que compila para seletores `[data-mantine-color-scheme]` — não a função CSS nativa. Por isso funciona em navegador antigo de intranet.

- [ ] **Step 4: Reescrever `apps/web/src/components/AppShell.tsx`**

Manter `navFlags` **exatamente como está**. Substituir só o componente `AppShellNav`:

```tsx
import { AppShell, Burger, Group, NavLink, Text, ActionIcon, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconCalendar, IconShieldCheck, IconClipboardCheck, IconLogout, IconGavel, IconTemplate, IconUserCheck } from '@tabler/icons-react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';
import { ColorSchemeToggle } from './ui';
import classes from './AppShell.module.css';

// navFlags fica inalterada — não editar.

export function AppShellNav({ nome, papel, canExecutar, canValidar, canLayouts, sa, onLogout, children }: {
  nome: string; papel: string; canExecutar: boolean; canValidar: boolean; canLayouts: boolean; sa?: boolean; onLogout: () => void; children?: ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ativo = (rota: string) => pathname === rota || pathname.startsWith(`${rota}/`);

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text className={classes.marca} size="sm">Escalas CBMRN</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorSchemeToggle />
            <Avatar color="cbmrn" radius="xl" size={32}>{nome.charAt(0)}</Avatar>
            <div>
              <Text size="sm" fw={600} lh={1.2}>{nome}</Text>
              <Text size="xs" c="dimmed" lh={1.2}>{papel}</Text>
            </div>
            <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={onLogout}>
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" className={classes.navbar}>
        <NavLink className={classes.link} component={Link} to="/painel" label="Painel"
          active={ativo('/painel')} leftSection={<IconLayoutDashboard size={18} />} />
        <NavLink label="Escala" leftSection={<IconCalendar size={18} />} defaultOpened>
          <NavLink className={classes.link} component={Link} to="/escalas" label="Listar" active={ativo('/escalas')} />
          <NavLink className={classes.link} component={Link} to="/escalas/nova" label="Nova Escala" active={ativo('/escalas/nova')} />
          {canLayouts && (
            <NavLink className={classes.link} component={Link} to="/layouts" label="Layouts"
              active={ativo('/layouts')} leftSection={<IconTemplate size={16} />} />
          )}
        </NavLink>
        {canExecutar && (
          <NavLink className={classes.link} component={Link} to="/execucao" label="Execução"
            active={ativo('/execucao')} leftSection={<IconClipboardCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink className={classes.link} component={Link} to="/validacao" label="Validação"
            active={ativo('/validacao')} leftSection={<IconShieldCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink className={classes.link} component={Link} to="/aprovacao" label="Aprovação de Escalas"
            active={ativo('/aprovacao')} leftSection={<IconGavel size={18} />} />
        )}
        {sa && (
          <NavLink className={classes.link} component={Link} to="/funcao-patentes" label="Elegibilidade (Funções)"
            active={ativo('/funcao-patentes')} leftSection={<IconUserCheck size={18} />} />
        )}
      </AppShell.Navbar>

      <AppShell.Main>{children ?? <Outlet />}</AppShell.Main>
    </AppShell>
  );
}
```

> Note que `c="white"` e `bg="cbmrn.7"` desapareceram — eram 5 dos 19 hardcodes.
> `ativo('/escalas')` casa também `/escalas/nova`; isso é intencional (ambos ficam sob "Escala").

- [ ] **Step 5: Rodar o arquivo de teste inteiro**

Run: `pnpm --filter @escalas/web test src/components/AppShell.test.tsx`
Expected: PASS, 15 testes (12 antigos + 3 novos). **Se algum dos 12 antigos falhar, o componente mudou demais** — reveja, não ajuste o teste antigo.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/components
git commit -m "💄 style(web): AppShell — navbar neutra e indicador de rota ativa

O bloco vermelho de 260px vira superfície neutra com barra de 3px no item
ativo. NavLink passa a receber active: até agora o usuário navegava sem
saber onde estava."
```

---

### Task 11: Telas de Escalas

**Files:**
- Modify: `apps/web/src/routes/_app/escalas/index.tsx`
- Modify: `apps/web/src/routes/_app/escalas/$id.index.tsx`
- Modify: `apps/web/src/routes/_app/escalas/$id.dias.$data.tsx`
- Modify: `apps/web/src/features/escalas/NovaEscalaForm.tsx`
- Modify: `apps/web/src/features/escalas/AcoesBloco.tsx`
- Modify: `apps/web/src/features/escalas/PreenchimentoAuto.tsx`
- Modify: `apps/web/src/features/escalas/SeletorDeDia.tsx`
- Test: `apps/web/src/features/escalas/SeletorDeDia.test.tsx` (ajustar), demais testes de escalas devem passar sem alteração

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge` de `src/components/ui`; `COBERTURA`, `tokenCor` de `src/theme/semantic`.
- Produces: `corCobertura` mantém a assinatura `(d?: EscalaMesDiaDTO) => 'verde' | 'amarelo' | null`. **Não renomear** — há teste existente sobre ela e o nome descreve o domínio, não a cor final.

- [ ] **Step 1: Aplicar `PageHeader` nas quatro telas**

Em cada arquivo, trocar o `<Title order={N}>` de topo por `<PageHeader title="..." />`, movendo qualquer `<Group>` de botões que o acompanhava para a prop `actions`.

Exemplo em `routes/_app/escalas/$id.dias.$data.tsx` (linhas 72–80), que hoje é:

```tsx
<Group justify="space-between">
  <Title order={4}>Quadro de Escala — dia {data}</Title>
  <Group>
    <Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
    ...
  </Group>
</Group>
```

vira:

```tsx
<PageHeader
  title="Quadro de Escala"
  subtitle={`Dia ${data}`}
  actions={
    <>
      <Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
      <Button variant="default" disabled title="Em breve: duplicar de outro dia">Duplicar Dia</Button>
      <Button variant="default" onClick={() => salvar.mutate()} loading={salvar.isPending}>Salvar</Button>
      <Button onClick={() => publicar.mutate()} loading={publicar.isPending}>Publicar Escala</Button>
    </>
  }
/>
```

> Duas mudanças de hierarquia aqui, ambas do spec: "Salvar" vira `variant="default"` para que "Publicar Escala" seja o **único** botão preenchido do grupo, e `color="cbmrn"` sai de "Publicar" — é redundante, `cbmrn` já é a cor primária.

- [ ] **Step 2: Trocar os `<Loader />` por `<LoadingState />`**

Nos 5 arquivos de escalas que têm `<Loader />`, escolher a variante pela forma do conteúdo:
- `escalas/index.tsx` → `<LoadingState variant="table" />`
- `escalas/$id.index.tsx` → `<LoadingState variant="cards" linhas={3} />`
- `escalas/$id.dias.$data.tsx` → `<LoadingState variant="cards" linhas={6} />`

- [ ] **Step 3: Trocar os textos `dimmed` de vazio por `<EmptyState />`**

Preservar a string existente como `title`. Exemplo:

```tsx
// antes
<Text c="dimmed">Nenhuma escala encontrada.</Text>
// depois
<EmptyState title="Nenhuma escala encontrada." description="Crie a primeira escala do mês." />
```

**Não invente cópia nova para o `title`** — só o `description` é texto novo, e deve ser factual e útil.

- [ ] **Step 4: Migrar `SeletorDeDia` para os tokens semânticos**

Trocar as cores inline (linhas 26–30) por token:

```tsx
import { Calendar } from '@mantine/dates';
import dayjs from 'dayjs';
import type { EscalaMesDiaDTO } from '@escalas/shared-types';
import { COBERTURA } from '../../theme/semantic';

export function corCobertura(d?: EscalaMesDiaDTO): 'verde' | 'amarelo' | null {
  if (!d || d.vagas_total === 0) return null;
  if (d.vagas_preenchidas >= d.vagas_total) return 'verde';
  return 'amarelo';
}

const FUNDO: Record<'verde' | 'amarelo', string> = {
  verde: `var(--mantine-color-${COBERTURA.completa.color}-1)`,
  amarelo: `var(--mantine-color-${COBERTURA.parcial.color}-1)`,
};

export function SeletorDeDia({ mes, ano, onSelecionar, dias }: {
  mes: number; ano: number; onSelecionar: (dataIso: string) => void; dias?: EscalaMesDiaDTO[];
}) {
  const base = new Date(ano, mes - 1, 1);
  const diasMap = new Map<string, EscalaMesDiaDTO>((dias ?? []).map((d) => [d.data, d]));
  return (
    <Calendar
      defaultDate={base}
      getDayProps={(date) => {
        const key = dayjs(date).format('YYYY-MM-DD');
        const cor = corCobertura(diasMap.get(key));
        return {
          onClick: () => onSelecionar(key),
          style: cor ? { backgroundColor: FUNDO[cor] } : {},
          // Cor não pode ser o único indicador (critério do spec).
          'aria-label': cor
            ? `${key} — ${cor === 'verde' ? COBERTURA.completa.label : COBERTURA.parcial.label}`
            : key,
        };
      }}
    />
  );
}
```

> Shade **1** (não 2) porque o fundo do dia precisa manter contraste com o número do dia por cima. O `aria-label` atende o critério "cor nunca é o único indicador".

- [ ] **Step 5: Rodar os testes das telas de escalas**

Run: `pnpm --filter @escalas/web test src/features/escalas src/routes/_app/escalas`
Expected: PASS. `corCobertura` não mudou de comportamento, então o teste dela passa inalterado. Se um teste consultar `Title` por `level`, ajuste-o para `level: 1` — a mudança de semântica é intencional e está no spec.

- [ ] **Step 6: Rodar a suíte inteira e commitar**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src
git commit -m "💄 style(web): telas de Escalas sobre os primitivos

PageHeader, LoadingState e EmptyState aplicados. SeletorDeDia passa a usar
token semântico de cobertura e ganha aria-label — cor deixa de ser o único
indicador. Publicar vira o único botão preenchido do grupo."
```

---

### Task 12: Telas de Execução e Validação

**Files:**
- Modify: `apps/web/src/routes/_app/execucao/index.tsx`
- Modify: `apps/web/src/routes/_app/execucao/escalas/$id.dias.$data.tsx`
- Modify: `apps/web/src/routes/_app/validacao/index.tsx`
- Modify: `apps/web/src/routes/_app/validacao/escalas/$id.dias.$data.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState` de `src/components/ui`.
- Produces: nada novo. `StatusExecucaoBadge` fica onde está (ver nota de escopo da Task 9).

- [ ] **Step 1: Aplicar `PageHeader` nas quatro telas**

Mesma transformação da Task 11, Step 1. Os títulos atuais são:
- `execucao/index.tsx`: `<Title order={3} c="cbmrn.7">Execução — dias a registrar</Title>`
  → `<PageHeader title="Execução" subtitle="Dias a registrar" />` (o `c="cbmrn.7"` sai — é hardcode)
- `execucao/escalas/$id.dias.$data.tsx`: `<Title order={4}>Execução — {data}</Title>`
  → `<PageHeader title="Execução" subtitle={`Dia ${data}`} actions={...} />`
- `validacao/index.tsx`: `<Title order={3} c="cbmrn.7">Validação — dias aguardando</Title>`
  → `<PageHeader title="Validação" subtitle="Dias aguardando" />`
- `validacao/escalas/$id.dias.$data.tsx`: `<Title order={4}>Validação — {data}</Title>`
  → `<PageHeader title="Validação" subtitle={`Dia ${data}`} actions={...} />`

- [ ] **Step 2: Trocar `<Loader />` por `<LoadingState />`**

- `execucao/index.tsx` e `validacao/index.tsx` → `<LoadingState variant="table" />`
- as duas telas de dia → `<LoadingState variant="cards" linhas={4} />`

- [ ] **Step 3: Trocar vazios por `<EmptyState />`, preservando a cópia**

As worklists vazias são o caso mais comum aqui — o fiscal abre e não há nada a registrar. Esse estado merece parecer intencional:

```tsx
<EmptyState
  title="Nada a registrar."
  description="Todos os dias sob sua responsabilidade já foram registrados."
/>
```

Se a string atual for outra, **use a atual como `title`**.

- [ ] **Step 4: Rodar os testes de execução e validação**

Run: `pnpm --filter @escalas/web test src/features/execucao src/routes/_app/execucao src/routes/_app/validacao`
Expected: PASS.

- [ ] **Step 5: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src
git commit -m "💄 style(web): telas de Execução e Validação sobre os primitivos"
```

---

### Task 13: Telas de Aprovação, Layouts, Elegibilidade, Painel e Login

Fecha a contagem: depois desta tarefa os quatro números do spec chegam a zero.

**Files:**
- Modify: `apps/web/src/routes/_app/aprovacao/index.tsx`
- Modify: `apps/web/src/routes/_app/aprovacao/escalas/$id.tsx`
- Modify: `apps/web/src/routes/_app/layouts/index.tsx`
- Modify: `apps/web/src/routes/_app/painel.tsx`
- Modify: `apps/web/src/features/painel/PainelView.tsx`
- Modify: `apps/web/src/features/funcaoPatentes/CatalogoFuncoes.tsx`
- Modify: `apps/web/src/features/layouts/LayoutEditor.tsx`
- Modify: `apps/web/src/features/auth/LoginForm.tsx`
- Modify: `apps/web/src/components/GuardaSessao.tsx`

**Interfaces:**
- Consumes: todos os primitivos de `src/components/ui`.
- Produces: nada novo.

- [ ] **Step 1: `PageHeader` nas telas restantes**

Aplicar em `aprovacao/index.tsx`, `aprovacao/escalas/$id.tsx`, `layouts/index.tsx`, `CatalogoFuncoes.tsx`, `PainelView.tsx`, `LayoutEditor.tsx`, `AcoesBloco.tsx` e `PreenchimentoAuto.tsx`.

**Exceção:** `AcoesBloco` e `PreenchimentoAuto` são **cartões dentro** de uma tela, não telas. Eles não recebem `PageHeader` — mantêm `<Title order={5}>` como cabeçalho de seção. Isso é correto: `PageHeader` é para o título da página.

- [ ] **Step 2: Painel — trocar a saudação genérica**

`PainelView.tsx` hoje abre com `<Title order={3} c="cbmrn.7">Seja bem vindo!</Title>` seguido do nome. Uma saudação não é informação. Trocar por cabeçalho que diz onde o usuário está e o que está vendo:

```tsx
import { PageHeader, EmptyState } from '../../components/ui';
import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import type { EscalaDiaDTO } from '@escalas/shared-types';

export function PainelView({ nome, dia, getMilitarNome }: {
  nome: string; dia: EscalaDiaDTO | null; getMilitarNome: (id: number) => string;
}) {
  return (
    <Stack>
      <PageHeader title="Painel" subtitle={`${nome} — serviço de hoje`} />
      {!dia || dia.guarnicoes.length === 0 ? (
        <EmptyState
          title="Sem guarnições para hoje."
          description="Nenhuma guarnição está escalada para a data de hoje na sua lotação."
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {dia.guarnicoes.map((g) => (
            <Card key={g.id}>
              <Text fw={700}>{g.atividade}</Text>
              <Text size="sm" c="dimmed" data-tabular>{g.turno_inicio} – {g.turno_fim}</Text>
              {g.vagas.map((v) => (
                <Text key={v.id} size="sm">
                  {v.funcao} — {v.militar_id != null ? getMilitarNome(v.militar_id) : 'VAGO'}
                </Text>
              ))}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
```

> A string `"Sem guarnições para hoje."` é preservada literalmente — há teste que a consulta.
> `withBorder` sai do `Card`: agora é default (Task 4). `data-tabular` liga algarismos tabulares no turno.

- [ ] **Step 3: Login — matar o `bg="gray.1"`**

`LoginForm.tsx` linha 17 usa `bg="gray.1"`, que fica branco-acinzentado no modo escuro. Trocar:

```tsx
<Center mih="100vh" bg="var(--mantine-color-body)">
```

E o título `<Title order={3} ta="center" c="cbmrn.7">ESCALAS CBMRN</Title>` mantém a cor da marca — **esta é a exceção deliberada**: a tela de login é onde a identidade CBMRN deve aparecer. Trocar apenas por um shade que responda à polaridade:

```tsx
<Title order={3} ta="center" c="cbmrn.7" darkHidden>ESCALAS CBMRN</Title>
<Title order={3} ta="center" c="cbmrn.4" lightHidden>ESCALAS CBMRN</Title>
```

> `cbmrn.7` sobre fundo escuro não tem contraste suficiente; `cbmrn.4` sim. `darkHidden`/`lightHidden` são props nativas do Mantine 7.

- [ ] **Step 4: Trocar os `<Loader />` restantes**

`GuardaSessao.tsx`, `aprovacao/index.tsx`, `aprovacao/escalas/$id.tsx`, `layouts/index.tsx`, `painel.tsx`.
`GuardaSessao` é tela cheia de verificação de sessão — usar `<LoadingState variant="form" linhas={3} />` centralizado.

- [ ] **Step 5: Confirmar que a contagem zerou**

```bash
cd apps/web/src
echo "Loader crus:";     grep -rn "<Loader" --include=*.tsx . | wc -l
echo "Titles ad-hoc:";   grep -rln "Title order=" --include=*.tsx . | wc -l
echo "Hardcodes:";       grep -rn 'bg="gray\|bg="cbmrn\|c="white"\|c="cbmrn' --include=*.tsx . | wc -l
```

Expected: `Loader crus: 0`. `Titles ad-hoc` deve restar apenas em `AcoesBloco.tsx`, `PreenchimentoAuto.tsx` e `LayoutEditor.tsx` (cabeçalhos de *seção*, legítimos). `Hardcodes` deve restar apenas as 2 linhas do `LoginForm` (exceção deliberada do Step 3).

**Se sobrar mais que isso, não commite** — encontre o que ficou para trás.

- [ ] **Step 6: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src
git commit -m "💄 style(web): telas restantes sobre os primitivos

Painel troca a saudação genérica por cabeçalho informativo. Login deixa de
usar bg=gray.1 (branco no modo escuro); a marca ganha shade por polaridade."
```

---

### Task 14: Responsivo de campo — Execução e Validação em 375px

O fiscal registra execução no quartel, possivelmente no celular.

**Files:**
- Modify: `apps/web/src/features/execucao/ExecucaoVagaRow.tsx`
- Modify: `apps/web/src/features/execucao/ExecucaoGuarnicaoCard.tsx`
- Modify: `apps/web/src/features/execucao/ExecucaoDiaView.tsx`
- Create: `apps/web/src/features/execucao/ExecucaoDiaView.module.css`
- Test: `apps/web/src/features/execucao/ExecucaoDiaView.test.tsx` (acrescentar caso)

**Interfaces:**
- Consumes: nada novo.
- Produces: nada novo. Só mudanças de layout.

- [ ] **Step 1: Ler os três componentes antes de editar**

Estes arquivos passaram por validação ao vivo e não podem mudar de comportamento. Leia-os inteiros primeiro. **Só layout muda; nenhuma lógica de rascunho, nenhuma chamada de API, nenhum handler.**

- [ ] **Step 2: Escrever o teste que falha**

Acrescentar a `apps/web/src/features/execucao/ExecucaoDiaView.test.tsx`:

```tsx
it('a barra de ações fica fixa no rodapé em telas estreitas', () => {
  const { container } = renderWithProviders(/* ...as props que os testes vizinhos já usam... */);
  const barra = container.querySelector('[data-barra-acoes]');
  expect(barra).not.toBeNull();
});
```

> Reaproveite exatamente as props de montagem já usadas nos testes vizinhos deste arquivo — não invente um fixture novo.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter @escalas/web test src/features/execucao/ExecucaoDiaView.test.tsx`
Expected: FAIL — `barra` é `null`.

- [ ] **Step 4: Criar `apps/web/src/features/execucao/ExecucaoDiaView.module.css`**

```css
.barraAcoes {
  display: flex;
  gap: var(--mantine-spacing-xs);
  justify-content: flex-end;
}

/* No celular as ações passam a acompanhar a rolagem: a lista de vagas é
   longa e o fiscal não deveria rolar até o fim para salvar. */
@media (max-width: $mantine-breakpoint-sm) {
  .barraAcoes {
    position: sticky;
    bottom: 0;
    z-index: 2;
    padding: var(--mantine-spacing-sm);
    margin: 0 calc(-1 * var(--mantine-spacing-md));
    background-color: light-dark(var(--mantine-color-white), var(--mantine-color-dark-7));
    border-top: 1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5));
  }

  .barraAcoes button {
    flex: 1;
    min-height: 44px; /* alvo de toque mínimo */
  }
}
```

- [ ] **Step 5: Aplicar em `ExecucaoDiaView.tsx`**

Envolver o grupo de botões de ação existente:

```tsx
import classes from './ExecucaoDiaView.module.css';
// ...
<div className={classes.barraAcoes} data-barra-acoes>
  {/* os mesmos botões que já existiam, sem mudança de handler */}
</div>
```

- [ ] **Step 6: Empilhar as linhas de vaga no celular**

Em `ExecucaoVagaRow.tsx`, trocar o `<Group>` de topo por:

```tsx
<Group gap="xs" wrap="wrap" align="flex-start">
```

E garantir que todo controle interativo da linha tenha altura mínima de toque no celular.
CSS fica junto do seu componente — criar `apps/web/src/features/execucao/ExecucaoVagaRow.module.css`:

```css
@media (max-width: $mantine-breakpoint-sm) {
  .linhaVaga :is(button, input, [role='combobox']) {
    min-height: 44px;
  }
}
```

Em `ExecucaoVagaRow.tsx`, importar `classes from './ExecucaoVagaRow.module.css'` e aplicar
`className={classes.linhaVaga}` no elemento raiz.

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @escalas/web test src/features/execucao`
Expected: PASS, incluindo o caso novo.

- [ ] **Step 8: Verificação completa e commit**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
git add apps/web/src/features/execucao
git commit -m "📱 feat(web): Execução usável em 375px

Barra de ações acompanha a rolagem e alvos de toque vão a 44px no celular.
O fiscal registra no quartel, não na mesa."
```

---

### Task 15: QA final

Nenhum código novo. Esta tarefa é verificação, e o seu produto é um relatório.

**Files:**
- Nenhum modificado, salvo correções que o QA revelar.

**Interfaces:**
- Consumes: `contrastRatio` de `src/theme/contrast.ts` (Task 1).
- Produces: relatório em texto no corpo da resposta.

- [ ] **Step 1: Suíte completa**

```bash
pnpm --filter @escalas/web test && pnpm --filter @escalas/web build && pnpm --filter @escalas/web lint
```

Expected: tudo verde. **Anote o número de arquivos e de testes** — comparar com a linha de base de 33 arquivos.

- [ ] **Step 2: Confirmar os critérios de aceite contáveis**

```bash
cd apps/web/src
echo "Loader crus (meta 0):";   grep -rn "<Loader" --include=*.tsx . | wc -l
echo "Hardcodes (meta 2):";     grep -rn 'bg="gray\|bg="cbmrn\|c="white"\|c="cbmrn' --include=*.tsx . | wc -l
echo "PageHeader em uso:";      grep -rln "PageHeader" --include=*.tsx . | wc -l
echo "EmptyState em uso:";      grep -rln "EmptyState" --include=*.tsx . | wc -l
```

- [ ] **Step 3: Inspeção visual nas três larguras**

```bash
pnpm --filter @escalas/backend dev     # :3000
pnpm --filter @escalas/web dev         # :5173
```

Login: `99999999900` / `admin-escalas-2026`.

Percorrer **em 1440px, 768px e 375px**, nas **duas polaridades** (alternar pelo botão do cabeçalho):
Painel → Escalas (lista) → Escala (detalhe) → Editor do dia → Layouts → Execução → Validação → Aprovação → Elegibilidade.

Procurar por: texto ilegível, rolagem horizontal do corpo da página, botão cortado, borda invisível, esqueleto com forma errada, estado vazio parecendo tela quebrada.

- [ ] **Step 4: Verificar contraste nos pares que o teste automático não cobre**

O Node não importa TypeScript direto; use o vitest, que já está configurado. Criar
`apps/web/src/theme/contraste-qa.test.ts`, rodar, e **manter no repositório** — estes pares
merecem trava permanente, não conferência manual:

```ts
import { contrastRatio } from './contrast';

// Texto secundário sobre superfície de cartão, nas duas polaridades.
it('gray.6 sobre branco passa AA', () => {
  expect(contrastRatio('#6e7e90', '#ffffff')).toBeGreaterThanOrEqual(4.5);
});
it('dark.2 sobre o corpo dark.7 passa AA', () => {
  expect(contrastRatio('#8b95a1', '#1f262e')).toBeGreaterThanOrEqual(4.5);
});
```

Run: `pnpm --filter @escalas/web test src/theme/contraste-qa.test.ts`

Se qualquer um falhar, escureça (modo claro) ou clareie (modo escuro) o shade correspondente
em `palette.ts` e rode a suíte inteira de novo. **Não relaxe a asserção.**

- [ ] **Step 5: Relatar**

Escrever um relatório curto com: contagens do Step 2, resultado da suíte do Step 1, e a lista do que a inspeção visual revelou. **Reportar o que ficou torto, não só o que funcionou.** Se algo não foi verificado, dizer que não foi.

- [ ] **Step 6: Commit final (só se o QA gerou correções)**

```bash
git add apps/web/src
git commit -m "🐛 fix(web): correções do QA do redesign"
```

---

## Autoavaliação do plano

**Cobertura do spec:**

| Seção do spec | Tarefa |
|---|---|
| 3.1 Cor | 1, 2 |
| 3.2 Cor semântica de domínio | 3, 11 |
| 3.3 Tipografia | 2 |
| 3.4 Espaçamento, raio, sombra | 2 |
| 4 Defaults de componente | 4 |
| 5 Primitivos (6) | 5, 6, 7, 8, 9 |
| 6 AppShell | 10 |
| 7 Modo escuro | 5, 10, 13 |
| 8 Responsivo | 14 |
| 9 Acessibilidade | 1 (contraste), 6 (semântica de heading), 11 (aria-label), 14 (alvo de toque), 15 (verificação) |
| 10 Faseamento | ordem das tarefas 1→15 |
| 12 Critérios de aceite | 13 (Step 5), 15 (Step 2) |
| 13 Dependências novas | 1 |

**Lacuna assumida:** o spec lista `StatusBadge` como substituto do `StatusExecucaoBadge`. A Task 9 **não** faz essa fusão, e explica por quê: são duas máquinas de estados distintas (escala vs. execução), e unificá-las é mudança de domínio, fora do escopo declarado de "nenhum fluxo muda". O spec fica com essa linha imprecisa; o plano é a fonte de verdade neste ponto.

**Consistência de tipos:** `TokenSemantico`, `StatusEscala` e `tokenCor` são definidos na Task 3 e usados com a mesma assinatura nas Tasks 9 e 11. `corCobertura` mantém o retorno `'verde' | 'amarelo' | null` da Task 11 em diante. `AppShellNav` mantém a assinatura original ao longo da Task 10.
