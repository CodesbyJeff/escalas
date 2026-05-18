import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { templateService } from '../../services/template.service.js';
import type { UpsertTemplateLotacaoInput } from '@escalas/shared-schemas';

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

const inputValido: UpsertTemplateLotacaoInput = {
  guarnicoes: [
    {
      sigla: 'ABT-01',
      atividade: 'incendio',
      turno_padrao_inicio: '07:00',
      turno_padrao_fim: '19:00',
      ordem: 0,
      vagas_sugeridas: [
        { funcao: 'comandante', quantidade_sugerida: 1 },
        { funcao: 'motorista', quantidade_sugerida: 1 },
      ],
    },
  ],
};

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

describe('templateService.upsert', () => {
  it('cria template novo quando não existe', async () => {
    const lot = await seedLotacao(910);
    const user = await seedUser('11122233355');

    const result = await templateService.upsert(lot.id, user.id, inputValido, testPrisma);

    expect(result.lotacao_id).toBe(lot.id);
    expect(result.guarnicoes).toHaveLength(1);
    expect(result.guarnicoes[0]!.vagas_sugeridas).toHaveLength(2);
    expect(result.criado_por_id).toBe(user.id);
  });

  it('substitui guarnições anteriores ao atualizar', async () => {
    const lot = await seedLotacao(911);
    const user = await seedUser('11122233366');
    await templateService.upsert(lot.id, user.id, inputValido, testPrisma);

    const novoInput: UpsertTemplateLotacaoInput = {
      guarnicoes: [
        {
          sigla: 'AR-01',
          atividade: 'resgate',
          turno_padrao_inicio: '08:00',
          turno_padrao_fim: '20:00',
          ordem: 0,
          vagas_sugeridas: [{ funcao: 'socorrista', quantidade_sugerida: 2 }],
        },
      ],
    };
    const atualizado = await templateService.upsert(lot.id, user.id, novoInput, testPrisma);

    expect(atualizado.guarnicoes).toHaveLength(1);
    expect(atualizado.guarnicoes[0]!.sigla).toBe('AR-01');
    // Confirma que guarnições antigas foram removidas em cascata
    const count = await testPrisma.templateGuarnicao.count({
      where: { template_lotacao_id: atualizado.id },
    });
    expect(count).toBe(1);
  });

  it('lança 404 se lotação não existir', async () => {
    const user = await seedUser('11122233377');
    await expect(
      templateService.upsert(99999, user.id, inputValido, testPrisma),
    ).rejects.toMatchObject({ status: 404 });
  });
});
