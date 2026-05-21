import type { Prisma, PrismaClient } from '@prisma/client';

type TxClient = PrismaClient | Prisma.TransactionClient;

interface AuditInput {
  user_id: number | null;
  acao: string;
  entidade: string;
  entidade_id: number;
  antes?: Prisma.InputJsonValue | null;
  depois?: Prisma.InputJsonValue | null;
}

export const auditService = {
  async log(input: AuditInput, prisma: TxClient): Promise<void> {
    await prisma.auditLog.create({
      data: {
        user_id: input.user_id,
        acao: input.acao,
        entidade: input.entidade,
        entidade_id: input.entidade_id,
        payload_antes: input.antes ?? undefined,
        payload_depois: input.depois ?? undefined,
      },
    });
  },
};
