import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { escalaService } from '../services/escala.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) {
    const extra = (e as unknown as { conflitos?: unknown }).conflitos;
    if (extra) {
      res.status((e as unknown as { status: number }).status).json({ success: false, message: e.message, data: { conflitos: extra } });
      return;
    }
    fail(res, e.message, e.status);
    return;
  }
  next(e);
}

export const escalaController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotacao_id = req.query.lotacao_id ? Number(req.query.lotacao_id) : undefined;
      const mes = req.query.mes ? Number(req.query.mes) : undefined;
      const ano = req.query.ano ? Number(req.query.ano) : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      // Escopo por lotação: não-super-admin só vê escalas das lotações onde é ESCALANTE.
      let lotacao_ids: number[] | undefined;
      if (!req.user!.is_super_admin) {
        const roles = await prisma.userRole.findMany({
          where: { user_id: req.user!.id, role: 'ESCALANTE' },
          select: { lotacao_id: true },
        });
        const permitidas = roles.map((r) => r.lotacao_id).filter((x): x is number => x != null);
        // Se filtrou por uma lotação específica, só permite se estiver no conjunto autorizado.
        lotacao_ids =
          lotacao_id !== undefined ? (permitidas.includes(lotacao_id) ? [lotacao_id] : []) : permitidas;
      }

      const lista = await escalaService.listar(
        { ...(lotacao_ids ? { lotacao_ids } : { lotacao_id }), mes, ano, status },
        prisma,
      );
      ok(res, 'Escalas listadas.', lista);
    } catch (e) { next(e); }
  },

  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const escala = await escalaService.criar(req.body, req.user!.id, prisma);
      ok(res, 'Escala criada.', escala, 201);
    } catch (e) { handle(res, next, e); }
  },

  async getDetalhe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const escala = await escalaService.getDetalhe(Number(req.params.id), prisma);
      if (!escala) { fail(res, 'Escala não encontrada.', 404); return; }
      ok(res, 'Escala obtida.', escala);
    } catch (e) { next(e); }
  },

  async getMes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mes = await escalaService.getMes(Number(req.params.id), prisma);
      if (!mes) { fail(res, 'Escala não encontrada.', 404); return; }
      ok(res, 'Visão mensal obtida.', mes);
    } catch (e) { next(e); }
  },

  async getDia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dia = await escalaService.getDia(Number(req.params.id), req.params.data!, prisma);
      if (!dia) { fail(res, 'Dia não encontrado.', 404); return; }
      ok(res, 'Dia obtido.', dia);
    } catch (e) { next(e); }
  },

  async putDia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dia = await escalaService.putDia(Number(req.params.id), req.params.data!, req.body, req.user!.id, prisma);
      ok(res, 'Dia salvo.', dia);
    } catch (e) { handle(res, next, e); }
  },

  async duplicarDia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dia = await escalaService.duplicarDia(Number(req.params.id), req.params.data!, req.body.de, req.user!.id, prisma);
      ok(res, 'Dia duplicado.', dia);
    } catch (e) { handle(res, next, e); }
  },

  async publicar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versao = await escalaService.publicar(Number(req.params.id), req.user!.id, prisma);
      ok(res, 'Escala publicada.', versao, 201);
    } catch (e) { handle(res, next, e); }
  },

  async deletar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await escalaService.deletar(Number(req.params.id), req.user!.id, prisma);
      ok(res, 'Escala excluída.', null);
    } catch (e) { handle(res, next, e); }
  },

  async listarVersoes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lista = await escalaService.listarVersoes(Number(req.params.id), prisma);
      ok(res, 'Versões listadas.', lista);
    } catch (e) { next(e); }
  },

  async getVersao(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const v = await escalaService.getVersao(Number(req.params.id), Number(req.params.versao), prisma);
      if (!v) { fail(res, 'Versão não encontrada.', 404); return; }
      ok(res, 'Versão obtida.', v);
    } catch (e) { next(e); }
  },
};
