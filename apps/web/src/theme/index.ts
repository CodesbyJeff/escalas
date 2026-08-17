import { createTheme, rem } from '@mantine/core';
import { cbmrn, gray, dark } from './palette';
import { componentes } from './components';

export { contrastRatio } from './contrast';
export * from './semantic';

export const theme = createTheme({
  components: componentes,
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
