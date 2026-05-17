import type { PrismaClient } from '@prisma/client';
import type { AtribuirRoleInput } from '@escalas/shared-schemas';
import { HttpError } from '../utils/errors.js';

export const adminService = {
  async atribuirRole(input: AtribuirRoleInput, createdBy: number, prisma: PrismaClient) {
    const user = await prisma.user.findUnique({ where: { id: input.user_id } });
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');

    if (input.lotacao_id) {
      const lot = await prisma.lotacao.findUnique({ where: { id: input.lotacao_id } });
      if (!lot) throw new HttpError(404, 'Lotação não encontrada.');
    }

    const existing = await prisma.userRole.findFirst({
      where: {
        user_id: input.user_id,
        role: input.role,
        lotacao_id: input.lotacao_id ?? null,
      },
    });
    if (existing) return existing;

    return prisma.userRole.create({
      data: {
        user_id: input.user_id,
        role: input.role,
        lotacao_id: input.lotacao_id,
        created_by: createdBy,
      },
    });
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
