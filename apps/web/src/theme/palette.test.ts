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
