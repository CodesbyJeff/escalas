import { describe, expect, it } from 'vitest';
import { planejarPreenchimento, type PlanoInput } from './preenchimento.js';

const T24 = { turno_inicio: '08:00', turno_fim: '08:00' }; // 24h
function base(over: Partial<PlanoInput> = {}): PlanoInput {
  return {
    descanso_horas: 72,
    militares: [
      { id: 1, nome: 'A', patente_id: 17 },
      { id: 2, nome: 'B', patente_id: 12 },
    ],
    contagemInicial: new Map(),
    contagemLocalInicial: new Map(),
    politicaLocalidade: 'indiferente',
    intervalosExistentes: [],
    vagas: [],
    esperadasPorFuncao: new Map(),
    ...over,
  };
}
const vaga = (vaga_id: number, data: string, funcao = 'OP', atividade = 'INCENDIO') =>
  ({ vaga_id, data, guarnicao_sigla: 'INC', guarnicao_atividade: atividade, guarnicao_ordem: 0, funcao, ...T24 });

describe('planejarPreenchimento', () => {
  it('equidade: quem tem menos serviços é escolhido primeiro', () => {
    const out = planejarPreenchimento(base({ contagemInicial: new Map([[1, 5]]), vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(2); // A tem 5, B tem 0
    expect(out[0]!.aviso_descanso).toBe(false);
  });

  it('conflito de turno no mesmo dia nunca ocorre (hard): a 2ª vaga do dia vai p/ o outro militar', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-01')] }));
    const ids = out.map((r) => r.militar_id);
    expect(new Set(ids).size).toBe(2); // dois militares distintos no mesmo dia/turno 24h
  });

  it('descanso: com 1 militar só, a 2ª vaga em 72h é preenchida com aviso_descanso', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-02')], // 08→08 no dia seguinte: começa logo após o fim
    }));
    expect(out[1]!.militar_id).toBe(1);
    expect(out[1]!.aviso_descanso).toBe(true);
  });

  it('patente: prioriza compatível, mas não bloqueia divergente', () => {
    const out = planejarPreenchimento(base({
      esperadasPorFuncao: new Map([['OP', [12]]]), // espera patente 12 → militar B
      vagas: [vaga(10, '2026-08-01', 'OP')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.aviso_patente).toBe(false);
  });

  it('vaga sem candidato sem conflito → militar_id null', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      intervalosExistentes: [{ militar_id: 1, data: '2026-08-01', ...T24 }], // A já ocupado 24h nesse dia
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBeNull();
  });

  it('determinístico: empate total de equidade → menor militar_id', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(1);
  });

  it('intervalo de militar fora do pool é ignorado, não vira candidato nem trava a vaga', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      intervalosExistentes: [{ militar_id: 99, data: '2026-08-01', ...T24 }], // 99 não está no pool
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBe(1);
  });

  it('indiferente: a localidade não influencia e o motivo é o do 2c (regressão)', () => {
    const out = planejarPreenchimento(base({
      contagemInicial: new Map([[1, 5]]),
      contagemLocalInicial: new Map([[2, new Map([['INCENDIO', 99]])]]),
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.motivo).toBe('menos serviços (0) · descansado · patente ok');
  });

  it('rodizia: com o mesmo total, vence quem tirou menos serviços naquela localidade', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'rodizia',
      contagemInicial: new Map([[1, 3], [2, 3]]),
      contagemLocalInicial: new Map([
        [1, new Map([['PONTA NEGRA', 3]])],
        [2, new Map([['MIAMI', 3]])],
      ]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.motivo).toContain('menos serviços em Ponta Negra (0)');
  });

  it('rodizia: com a mesma contagem local, o total desempata', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'rodizia',
      contagemInicial: new Map([[1, 9], [2, 2]]),
      contagemLocalInicial: new Map([
        [1, new Map([['PONTA NEGRA', 1]])],
        [2, new Map([['PONTA NEGRA', 1]])],
      ]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra')],
    }));
    expect(out[0]!.militar_id).toBe(2);
  });

  it('rodizia: espalha as localidades dentro da mesma rodada', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'rodizia',
      descanso_horas: 0,
      contagemInicial: new Map([[2, 5]]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra'), vaga(11, '2026-08-05', 'OP', 'Ponta Negra')],
    }));
    // 1ª vaga: ninguém serviu em Ponta Negra → decide o total → militar 1.
    // 2ª vaga: militar 1 já tem 1 em Ponta Negra → vai o militar 2, apesar do total maior.
    expect(out[0]!.militar_id).toBe(1);
    expect(out[1]!.militar_id).toBe(2);
  });

  it('fixa: quem já serviu na guarnição vence quem nunca serviu, mesmo com mais serviços no total', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'fixa',
      contagemInicial: new Map([[1, 12]]),
      contagemLocalInicial: new Map([[1, new Map([['INCENDIO', 12]])]]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
    }));
    expect(out[0]!.militar_id).toBe(1);
    expect(out[0]!.motivo).toContain('é do INCENDIO');
  });

  it('fixa: entre dois que pertencem à guarnição, vence o de menor total (o sinal é binário, não placar)', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'fixa',
      militares: [
        { id: 1, nome: 'A', patente_id: 17 },
        { id: 2, nome: 'B', patente_id: 12 },
        { id: 3, nome: 'C', patente_id: 12 },
      ],
      contagemInicial: new Map([[1, 1], [2, 8], [3, 9]]),
      contagemLocalInicial: new Map([
        [1, new Map([['INCENDIO', 5]])],
        [2, new Map([['INCENDIO', 1]])],
        [3, new Map([['INCENDIO', 9]])],
      ]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
    }));
    expect(out[0]!.militar_id).toBe(1);
  });

  it('fixa: sem ninguém com histórico na guarnição, o ranqueio cai no total', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'fixa',
      contagemInicial: new Map([[1, 7]]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.motivo).toContain('sem histórico em INCENDIO');
  });

  it('conflito de turno continua hard sob fixa', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'fixa',
      contagemLocalInicial: new Map([[1, new Map([['INCENDIO', 10]])]]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'INCENDIO'), vaga(11, '2026-08-01', 'OP', 'INCENDIO')],
    }));
    expect(new Set(out.map((r) => r.militar_id)).size).toBe(2);
  });

  it('localidade é normalizada (acento, caixa e espaços não criam contagens separadas)', () => {
    const out = planejarPreenchimento(base({
      politicaLocalidade: 'rodizia',
      contagemInicial: new Map([[2, 5]]),
      contagemLocalInicial: new Map([[1, new Map([['PRAIA DO MEIO', 2]])]]),
      vagas: [vaga(10, '2026-08-01', 'OP', 'Praia  do  Meio')],
    }));
    expect(out[0]!.militar_id).toBe(2); // militar 1 já tem 2 na mesma praia, apesar do total menor
  });

  it('determinismo: a mesma entrada produz a mesma saída', () => {
    const entrada = () => base({
      politicaLocalidade: 'rodizia',
      vagas: [vaga(10, '2026-08-01', 'OP', 'Ponta Negra'), vaga(11, '2026-08-02', 'OP', 'Miami')],
    });
    expect(planejarPreenchimento(entrada())).toEqual(planejarPreenchimento(entrada()));
  });
});
