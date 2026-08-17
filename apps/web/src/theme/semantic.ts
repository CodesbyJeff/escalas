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
