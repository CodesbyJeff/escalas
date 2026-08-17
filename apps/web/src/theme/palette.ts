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
  '#8b9aab', '#5c6c80', '#566475', '#3e4a58', '#2a333e',
];

/** Neutro frio — superfícies e texto do modo escuro. Índice 7 é o fundo do corpo. */
export const dark: MantineColorsTuple = [
  '#c9d1d9', '#b0bac5', '#8b95a1', '#6b7785', '#4c5764',
  '#3a434f', '#2c343e', '#1f262e', '#171d24', '#10151a',
];
