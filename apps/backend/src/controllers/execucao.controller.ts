import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { execucaoService } from '../services/execucao.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) {
    fail(res, e.message, e.status);
    return;
  }
  next(e);
}

export const execucaoController = {
  // GET /api/v1/escalas/:id/execucao/:data
  async getDia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await execucaoService.getDia(Number(req.params.id), req.params.data!, prisma);
      ok(res, 'Execução do dia.', dto);
    } catch (e) { handle(res, next, e); }
  },

  // PUT /api/v1/escalas/:id/execucao/:data
  async salvar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await execucaoService.salvar(
        Number(req.params.id),
        req.params.data!,
        req.body,
        req.user!.id,
        prisma,
      );
      ok(res, 'Execução salva.', dto);
    } catch (e) { handle(res, next, e); }
  },

  // POST /api/v1/escalas/:id/execucao/:data/fechar
  async fechar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await execucaoService.fechar(
        Number(req.params.id),
        req.params.data!,
        req.user!.id,
        prisma,
      );
      ok(res, 'Execução fechada para validação.', dto);
    } catch (e) { handle(res, next, e); }
  },

  // POST /api/v1/escalas/:id/execucao/:data/validar
  async validar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await execucaoService.validar(
        Number(req.params.id),
        req.params.data!,
        req.body,
        req.user!.id,
        prisma,
      );
      ok(res, 'Execução validada.', dto);
    } catch (e) { handle(res, next, e); }
  },

  // GET /api/v1/execucoes/pendentes/fiscal
  async pendentesFiscal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let lotacao_ids: number[] | undefined;
      if (!req.user!.is_super_admin) {
        const roles = await prisma.userRole.findMany({
          where: { user_id: req.user!.id, role: 'FISCAL' },
          select: { lotacao_id: true },
        });
        lotacao_ids = roles.map((r) => r.lotacao_id).filter((x): x is number => x != null);
      }
      const hoje = new Date().toISOString().slice(0, 10);
      const lista = await execucaoService.listarPendentesFiscal(lotacao_ids, hoje, prisma);
      ok(res, 'Execuções pendentes do fiscal.', lista);
    } catch (e) { next(e); }
  },

  // GET /api/v1/execucoes/pendentes/gestor
  async pendentesGestor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let lotacao_ids: number[] | undefined;
      if (!req.user!.is_super_admin) {
        const roles = await prisma.userRole.findMany({
          where: { user_id: req.user!.id, role: 'GESTOR' },
          select: { lotacao_id: true },
        });
        lotacao_ids = roles.map((r) => r.lotacao_id).filter((x): x is number => x != null);
      }
      const lista = await execucaoService.listarPendentesGestor(lotacao_ids, prisma);
      ok(res, 'Execuções pendentes do gestor.', lista);
    } catch (e) { next(e); }
  },
};
