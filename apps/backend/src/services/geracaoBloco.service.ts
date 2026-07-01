import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, HttpError } from '../utils/errors.js';
import { guarnicoesCreateDoTemplate, diasNoIntervalo } from '../utils/estruturaTemplate.js';
import { auditService } from './audit.service.js';

async function escalaRascunho(escala_id: number, prisma: PrismaClient) {
  const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
  if (!escala) throw new NotFoundError('Escala não encontrada.');
  if (escala.status !== 'rascunho') throw new ConflictError('Só é possível gerar em bloco em escala rascunho.');
  return escala;
}

function validarIntervaloNoMes(escala: { mes: number; ano: number }, dias: Date[]) {
  if (dias.length === 0) throw new HttpError(422, 'Intervalo inválido (fim antes do início).');
  for (const d of dias) {
    if (d.getUTCMonth() + 1 !== escala.mes || d.getUTCFullYear() !== escala.ano) {
      throw new HttpError(422, 'Intervalo fora do mês da escala.');
    }
  }
}

export const geracaoBlocoService = {
  async carimbarEstrutura(escala_id: number, data_ini: string, data_fim: string, template_id: number, user_id: number, prisma: PrismaClient) {
    const escala = await escalaRascunho(escala_id, prisma);
    const dias = diasNoIntervalo(data_ini, data_fim);
    validarIntervaloNoMes(escala, dias);

    const template = await prisma.templateLotacao.findUnique({
      where: { id: template_id },
      include: { guarnicoes: { include: { vagas_sugeridas: true } } },
    });
    if (!template || template.lotacao_id !== escala.lotacao_id) throw new ConflictError('Layout inválido para esta lotação.');

    const guarnicoes = guarnicoesCreateDoTemplate(template.guarnicoes);

    return prisma.$transaction(async (tx) => {
      let afetados = 0;
      for (const data of dias) {
        const dia = await tx.escalaDia.findFirst({ where: { escala_id, data } });
        if (!dia) continue;
        await tx.escalaGuarnicao.deleteMany({ where: { escala_dia_id: dia.id } });
        await tx.escalaDia.update({ where: { id: dia.id }, data: { guarnicoes: { create: guarnicoes } } });
        afetados++;
      }
      await auditService.log({ user_id, acao: 'carimbar_bloco', entidade: 'Escala', entidade_id: escala_id, antes: null, depois: { data_ini, data_fim, template_id, dias: afetados } }, tx);
      return { dias_afetados: afetados };
    });
  },
};
