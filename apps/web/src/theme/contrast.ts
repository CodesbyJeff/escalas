/** Converte um canal sRGB (0–1) para o espaço linear, conforme WCAG 2.1. */
function canalLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa de uma cor sRGB, conforme WCAG 2.1. */
function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace('#', '');
  const r = canalLinear(parseInt(limpo.slice(0, 2), 16) / 255);
  const g = canalLinear(parseInt(limpo.slice(2, 4), 16) / 255);
  const b = canalLinear(parseInt(limpo.slice(4, 6), 16) / 255);
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
