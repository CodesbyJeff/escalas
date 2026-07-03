import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { mapaLayoutService } from '../../services/mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../../integrations/sisbom/types.js';

const NOME = 'Padrão (mapa de força)';
async function ctx() {
  const lot = await testPrisma.lotacao.create({ data: { id: 960, sigla: 'L960', nome: 'L', nivel: 3, operacional: true, sisbom_ref: 'L960' } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM960', nome: 'Adm', is_super_admin: true, last_sync_at: new Date() } });
  return { lot, admin };
}
const docs: MapaGuarnicaoDoc[] = [
  { _lotacao: 'L960', atividade: 'INCENDIO', time_start: '08:00', time_end: '08:00', guarnicao: [{ str_funcao: 'Comandante' }, { str_funcao: 'Motorista' }] },
];

describe('mapaLayoutService.gerarParaLotacao', () => {
  beforeEach(async () => { await resetDb(); });

  it('cria o layout "Padrão (mapa de força)" com as guarnições agregadas', async () => {
    const { lot, admin } = await ctx();
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    const tpls = await testPrisma.templateLotacao.findMany({ where: { lotacao_id: lot.id }, include: { guarnicoes: { include: { vagas_sugeridas: true } } } });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]!.nome).toBe(NOME);
    expect(tpls[0]!.guarnicoes[0]!.atividade).toBe('INCENDIO');
    expect(tpls[0]!.guarnicoes[0]!.vagas_sugeridas).toHaveLength(2);
  });

  it('é idempotente — re-rodar atualiza o mesmo layout (não duplica)', async () => {
    const { lot, admin } = await ctx();
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    await mapaLayoutService.gerarParaLotacao(lot.id, admin.id, docs, testPrisma);
    expect(await testPrisma.templateLotacao.count({ where: { lotacao_id: lot.id, nome: NOME } })).toBe(1);
  });
});
