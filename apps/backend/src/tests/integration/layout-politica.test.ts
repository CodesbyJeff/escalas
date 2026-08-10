import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';
import { criarLayoutSchema } from '@escalas/shared-schemas';

const guarnicoes = [{
  sigla: 'PN', atividade: 'Ponta Negra',
  turno_padrao_inicio: '07:00', turno_padrao_fim: '17:00', ordem: 0,
  vagas_sugeridas: [{ funcao: 'GUARDA_VIDAS', quantidade_sugerida: 2 }],
}];

async function cenario(lotId = 940) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({
    data: { cpf: `PL${lotId}0`, nome: 'Escalante', last_sync_at: new Date() },
  });
  return { lot, esc };
}

describe('política de localidade no layout', () => {
  beforeEach(async () => { await resetDb(); });

  it('criar grava a política escolhida', async () => {
    const { lot, esc } = await cenario(940);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'rodizia', guarnicoes }),
      testPrisma,
    );
    expect(tpl.politica_localidade).toBe('rodizia');
  });

  it('atualizar troca a política', async () => {
    const { lot, esc } = await cenario(941);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'rodizia', guarnicoes }),
      testPrisma,
    );
    const upd = await layoutService.atualizar(
      tpl.id, esc.id,
      criarLayoutSchema.parse({ nome: 'GBSA', politica_localidade: 'fixa', guarnicoes }),
      testPrisma,
    );
    expect(upd.politica_localidade).toBe('fixa');
  });

  it('sem a chave no payload, o default é indiferente', async () => {
    const { lot, esc } = await cenario(942);
    const tpl = await layoutService.criar(
      lot.id, esc.id,
      criarLayoutSchema.parse({ nome: 'Quartel', guarnicoes }),
      testPrisma,
    );
    expect(tpl.politica_localidade).toBe('indiferente');
  });
});
