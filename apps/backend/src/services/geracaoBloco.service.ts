import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, HttpError } from '../utils/errors.js';
import { guarnicoesCreateDoTemplate, diasNoIntervalo } from '../utils/estruturaTemplate.js';
import { auditService } from './audit.service.js';
import { encontrarConflitos, type VagaTurno } from '../utils/turnos.js';

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

function mapGuarnicaoCreateDoDia(g: { sigla: string; atividade: string; viatura_id: string | null; turno_inicio: string; turno_fim: string; ordem: number; vagas: { funcao: string; militar_id: number | null; turno_inicio: string; turno_fim: string; observacoes: string | null }[] }) {
  return {
    sigla: g.sigla, atividade: g.atividade, viatura_id: g.viatura_id,
    turno_inicio: g.turno_inicio, turno_fim: g.turno_fim, ordem: g.ordem,
    vagas: { create: g.vagas.map((v) => ({ funcao: v.funcao, militar_id: v.militar_id, turno_inicio: v.turno_inicio, turno_fim: v.turno_fim, observacoes: v.observacoes })) },
  };
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

  async repetirCiclo(escala_id: number, ciclo_ini: string, ciclo_fim: string, ate: string, user_id: number, prisma: PrismaClient) {
    const escala = await escalaRascunho(escala_id, prisma);
    const cicloDias = diasNoIntervalo(ciclo_ini, ciclo_fim);
    if (cicloDias.length === 0) throw new HttpError(422, 'Ciclo inválido.');
    const alvoIni = new Date(cicloDias[cicloDias.length - 1]!);
    alvoIni.setUTCDate(alvoIni.getUTCDate() + 1);
    const alvos = diasNoIntervalo(alvoIni.toISOString().slice(0, 10), ate);
    validarIntervaloNoMes(escala, [...cicloDias, ...alvos]);

    // Lê o conteúdo preenchido dos dias-fonte, na ordem do ciclo.
    const K = cicloDias.length;
    type DiaFonte = { id: number; guarnicoes: { sigla: string; atividade: string; viatura_id: string | null; turno_inicio: string; turno_fim: string; ordem: number; vagas: { funcao: string; militar_id: number | null; turno_inicio: string; turno_fim: string; observacoes: string | null }[] }[] };
    const fonte: (DiaFonte | null)[] = [];
    for (const d of cicloDias) {
      const dia = await prisma.escalaDia.findFirst({
        where: { escala_id, data: d },
        include: { guarnicoes: { orderBy: { ordem: 'asc' }, include: { vagas: { orderBy: { id: 'asc' } } } } },
      });
      fonte.push(dia);
    }

    // Monta o payload de cada dia-alvo e checa conflito por dia (defensivo).
    const plano: { dia_id: number; guarnicoes: ReturnType<typeof mapGuarnicaoCreateDoDia>[] }[] = [];
    for (let i = 0; i < alvos.length; i++) {
      const src = fonte[i % K];
      if (!src) continue;
      const alvo = await prisma.escalaDia.findFirst({ where: { escala_id, data: alvos[i]! } });
      if (!alvo) continue;
      const vagasTurno: VagaTurno[] = src.guarnicoes.flatMap((g, gi) => g.vagas.map((v, vi) => ({ id: gi * 1000 + vi, militar_id: v.militar_id, turno_inicio: v.turno_inicio, turno_fim: v.turno_fim })));
      const conflitos = encontrarConflitos(vagasTurno);
      if (conflitos.length > 0) {
        const err = new HttpError(422, `Conflito de turno ao repetir no dia ${alvos[i]!.toISOString().slice(0, 10)}.`);
        (err as unknown as { conflitos: unknown }).conflitos = conflitos;
        throw err;
      }
      plano.push({ dia_id: alvo.id, guarnicoes: src.guarnicoes.map(mapGuarnicaoCreateDoDia) });
    }

    return prisma.$transaction(async (tx) => {
      for (const p of plano) {
        await tx.escalaGuarnicao.deleteMany({ where: { escala_dia_id: p.dia_id } });
        await tx.escalaDia.update({ where: { id: p.dia_id }, data: { guarnicoes: { create: p.guarnicoes } } });
      }
      await auditService.log({ user_id, acao: 'repetir_ciclo', entidade: 'Escala', entidade_id: escala_id, antes: null, depois: { ciclo_ini, ciclo_fim, ate, dias: plano.length } }, tx);
      return { dias_afetados: plano.length };
    });
  },
};
