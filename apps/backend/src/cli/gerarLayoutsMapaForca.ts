import { prisma } from '../config/db.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { mapaLayoutService } from '../services/mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

// Puxa todo o snapshot de mapa-guarnicoes (paginado) a partir de `since`, agrupa
// por _lotacao (sisbom_ref) e gera os layouts. `since` default = 90 dias atrás.
async function carregarMapaPorLotacao(since: string): Promise<Map<string, MapaGuarnicaoDoc[]>> {
  const porLot = new Map<string, MapaGuarnicaoDoc[]>();
  let skip = 0; const limit = 500;
  for (;;) {
    const resp = await sisbomClient.getSnapshot({ entity: 'mapa-guarnicoes', since, skip, limit });
    const docs = resp.items as unknown as MapaGuarnicaoDoc[];
    for (const d of docs) {
      const k = String(d._lotacao);
      if (!porLot.has(k)) porLot.set(k, []);
      porLot.get(k)!.push(d);
    }
    if (!resp.has_more) break;
    skip += limit;
  }
  return porLot;
}

async function main(): Promise<void> {
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const since = sinceArg ? sinceArg.split('=')[1]! : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const admin = await prisma.user.findFirst({ where: { is_super_admin: true }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('Nenhum super-admin para autoria dos layouts.');
  logger.info('gerar_layouts_carregando_mapa', { since });
  const porLot = await carregarMapaPorLotacao(since);
  const r = await mapaLayoutService.gerarTodas(
    admin.id,
    async (lot) => porLot.get(lot.sisbom_ref) ?? [],
    prisma,
  );
  logger.info('gerar_layouts_done', r);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { logger.error('gerar_layouts_failed', { err: (e as Error).message }); process.exit(1); })
  .finally(() => prisma.$disconnect());
