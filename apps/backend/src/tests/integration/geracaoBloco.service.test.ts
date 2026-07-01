import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { geracaoBlocoService } from '../../services/geracaoBloco.service.js';
import { escalaService } from '../../services/escala.service.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 800, sigla: 'L800', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM800', nome: 'Adm', last_sync_at: new Date() } });
  const tpl = await testPrisma.templateLotacao.create({
    data: { lotacao_id: lot.id, nome: 'P', criado_por_id: admin.id,
      guarnicoes: { create: [{ sigla: 'INC', atividade: 'INCENDIO', turno_padrao_inicio: '08:00', turno_padrao_fim: '08:00', ordem: 0, vagas_sugeridas: { create: [{ funcao: 'CMT_GU', quantidade_sugerida: 1 }] } }] } },
  });
  const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 9, ano: 2026, template_id: tpl.id }, admin.id, testPrisma);
  return { lot, admin, tpl, escala };
}

describe('geracaoBlocoService.carimbarEstrutura', () => {
  beforeEach(async () => { await resetDb(); });

  it('reaplica a estrutura do layout num intervalo (vagas abertas)', async () => {
    const { admin, tpl, escala } = await cenario();
    const r = await geracaoBlocoService.carimbarEstrutura(escala.id, '2026-09-01', '2026-09-03', tpl.id, admin.id, testPrisma);
    expect(r.dias_afetados).toBe(3);
    const dia = await escalaService.getDia(escala.id, '2026-09-02', testPrisma);
    expect(dia!.guarnicoes).toHaveLength(1);
    expect(dia!.guarnicoes[0]!.vagas[0]!.militar_id).toBeNull();
  });

  it('409 se a escala não está em rascunho', async () => {
    const { admin, tpl, escala } = await cenario();
    await testPrisma.escala.update({ where: { id: escala.id }, data: { status: 'publicada' } });
    await expect(geracaoBlocoService.carimbarEstrutura(escala.id, '2026-09-01', '2026-09-03', tpl.id, admin.id, testPrisma)).rejects.toMatchObject({ status: 409 });
  });

  it('422 se o intervalo cai fora do mês da escala', async () => {
    const { admin, tpl, escala } = await cenario();
    await expect(geracaoBlocoService.carimbarEstrutura(escala.id, '2026-08-28', '2026-09-03', tpl.id, admin.id, testPrisma)).rejects.toMatchObject({ status: 422 });
  });
});
