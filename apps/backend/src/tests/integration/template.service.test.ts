import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { templateService } from '../../services/template.service.js';

async function seedLotacao(id = 901) {
  return testPrisma.lotacao.create({
    data: { id, sigla: `LOT${id}`, nome: 'Lotação Test', nivel: 3, operacional: true },
  });
}

async function seedUser(cpf = '00011122233') {
  return testPrisma.user.create({
    data: { cpf, nome: 'Escalante', last_sync_at: new Date() },
  });
}

describe('templateService.getByLotacao', () => {
  it('retorna null quando não existe template para a lotação', async () => {
    const lot = await seedLotacao();
    const result = await templateService.getByLotacao(lot.id, testPrisma);
    expect(result).toBeNull();
  });

  it('retorna template com guarnições ordenadas e vagas sugeridas', async () => {
    const lot = await seedLotacao();
    const user = await seedUser();
    await testPrisma.templateLotacao.create({
      data: {
        lotacao_id: lot.id,
        criado_por_id: user.id,
        guarnicoes: {
          create: [
            {
              sigla: 'ABT-02',
              atividade: 'incendio',
              turno_padrao_inicio: '07:00',
              turno_padrao_fim: '19:00',
              ordem: 1,
              vagas_sugeridas: { create: [{ funcao: 'motorista', quantidade_sugerida: 1 }] },
            },
            {
              sigla: 'ABT-01',
              atividade: 'incendio',
              turno_padrao_inicio: '07:00',
              turno_padrao_fim: '19:00',
              ordem: 0,
              vagas_sugeridas: { create: [{ funcao: 'comandante', quantidade_sugerida: 1 }] },
            },
          ],
        },
      },
    });

    const result = await templateService.getByLotacao(lot.id, testPrisma);
    expect(result).not.toBeNull();
    expect(result!.guarnicoes).toHaveLength(2);
    expect(result!.guarnicoes[0]!.sigla).toBe('ABT-01'); // ordem 0 antes
    expect(result!.guarnicoes[1]!.sigla).toBe('ABT-02');
    expect(result!.guarnicoes[0]!.vagas_sugeridas).toHaveLength(1);
  });
});
