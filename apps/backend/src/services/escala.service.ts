import type { PrismaClient } from '@prisma/client';
import type { CriarEscalaInput } from '@escalas/shared-schemas';
import { ConflictError } from '../utils/errors.js';
import { diasDoMes } from '../utils/calendario.js';
import { auditService } from './audit.service.js';

export const escalaService = {
  async criar(input: CriarEscalaInput, user_id: number, prisma: PrismaClient) {
    const template = await prisma.templateLotacao.findUnique({
      where: { lotacao_id: input.lotacao_id },
      include: { guarnicoes: { include: { vagas_sugeridas: true } } },
    });
    if (!template) {
      throw new ConflictError('Configure o template da lotação antes de criar a escala.');
    }

    const existente = await prisma.escala.findUnique({
      where: { lotacao_id_mes_ano: { lotacao_id: input.lotacao_id, mes: input.mes, ano: input.ano } },
    });
    if (existente) {
      throw new ConflictError('Já existe escala para essa lotação neste mês/ano.');
    }

    const dias = diasDoMes(input.mes, input.ano);

    const escala = await prisma.$transaction(async (tx) => {
      const nova = await tx.escala.create({
        data: {
          lotacao_id: input.lotacao_id,
          mes: input.mes,
          ano: input.ano,
          criado_por_id: user_id,
          dias: {
            create: dias.map((data) => ({
              data,
              guarnicoes: {
                create: template.guarnicoes.map((g) => ({
                  sigla: g.sigla,
                  atividade: g.atividade,
                  turno_inicio: g.turno_padrao_inicio,
                  turno_fim: g.turno_padrao_fim,
                  ordem: g.ordem,
                  vagas: {
                    create: g.vagas_sugeridas.flatMap((vs) =>
                      Array.from({ length: vs.quantidade_sugerida }, () => ({
                        funcao: vs.funcao,
                        turno_inicio: g.turno_padrao_inicio,
                        turno_fim: g.turno_padrao_fim,
                      })),
                    ),
                  },
                })),
              },
            })),
          },
        },
      });
      await auditService.log(
        { user_id, acao: 'criar', entidade: 'Escala', entidade_id: nova.id, antes: null, depois: { mes: nova.mes, ano: nova.ano, lotacao_id: nova.lotacao_id } },
        tx,
      );
      return nova;
    });

    return escala;
  },
};
