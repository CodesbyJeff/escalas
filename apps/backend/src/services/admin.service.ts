import { Prisma, type PrismaClient } from '@prisma/client';
import type { AtribuirRoleInput } from '@escalas/shared-schemas';
import { NotFoundError } from '../utils/errors.js';

export const adminService = {
  async atribuirRole(input: AtribuirRoleInput, createdBy: number, prisma: PrismaClient) {
    const user = await prisma.user.findUnique({ where: { id: input.user_id } });
    if (!user) throw new NotFoundError('Usuário não encontrado.');

    if (input.lotacao_id) {
      const lot = await prisma.lotacao.findUnique({ where: { id: input.lotacao_id } });
      if (!lot) throw new NotFoundError('Lotação não encontrada.');
    }

    try {
      return await prisma.userRole.create({
        data: {
          user_id: input.user_id,
          role: input.role,
          lotacao_id: input.lotacao_id,
          created_by: createdBy,
        },
      });
    } catch (e) {
      // P2002 = unique violation → idempotência: retorna a existente
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await prisma.userRole.findFirst({
          where: {
            user_id: input.user_id,
            role: input.role,
            lotacao_id: input.lotacao_id ?? null,
          },
        });
        if (existing) return existing;
      }
      throw e;
    }
  },

  async removerRole(roleId: number, prisma: PrismaClient): Promise<void> {
    await prisma.userRole.delete({ where: { id: roleId } });
  },

  async listarUsuarios(filtro: { q?: string; lotacao_id?: number }, prisma: PrismaClient) {
    return prisma.user.findMany({
      where: {
        ativo: true,
        ...(filtro.q && {
          OR: [
            { nome: { contains: filtro.q, mode: 'insensitive' } },
            { cpf: { contains: filtro.q } },
            { matricula: { contains: filtro.q } },
          ],
        }),
        ...(filtro.lotacao_id && {
          lotacoes: { some: { lotacao_id: filtro.lotacao_id } },
        }),
      },
      include: { roles: true },
      take: 100,
      orderBy: { nome: 'asc' },
    });
  },
};
