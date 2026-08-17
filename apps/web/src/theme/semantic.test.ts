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
