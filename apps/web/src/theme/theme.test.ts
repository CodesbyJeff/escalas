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
    // `rem()` do Mantine 7 devolve `calc(0.875rem * var(--mantine-scale))`,
    // não a string crua — verificado no pacote instalado (7.17.8).
    // O que importa asserir é o 14px, não o formato do wrapper.
    expect(theme.spacing?.md).toContain('0.875rem'); // 14px, não os 16px do padrão
  });
});
