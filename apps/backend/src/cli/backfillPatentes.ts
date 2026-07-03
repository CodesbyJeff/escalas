import { prisma } from '../config/db.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { patenteBackfillService } from '../services/patenteBackfill.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

// Puxa o mapa de força (paginado) a partir de `since` e popula User.patente_id com a
// patente mais recente observada por militar. `since` default = 180 dias atrás.
async function carregarMapa(since: string): Promise<MapaGuarnicaoDoc[]> {
  const todos: MapaGuarnicaoDoc[] = [];
  let skip = 0; const limit = 500;
  for (;;) {
    const resp = await sisbomClient.getSnapshot({ entity: 'mapa-guarnicoes', since, skip, limit });
    const docs = (resp.items ?? []) as unknown as MapaGuarnicaoDoc[];
    todos.push(...docs);
    if (!resp.has_more) break;
    skip += limit;
  }
  return todos;
}

async function main(): Promise<void> {
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const since = sinceArg ? sinceArg.split('=')[1]! : new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  logger.info('backfill_patentes_carregando', { since });
  const docs = await carregarMapa(since);
  const r = await patenteBackfillService.backfill(prisma, docs);
  logger.info('backfill_patentes_done', r);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { logger.error('backfill_patentes_failed', { err: (e as Error).message }); process.exit(1); })
  .finally(() => prisma.$disconnect());
