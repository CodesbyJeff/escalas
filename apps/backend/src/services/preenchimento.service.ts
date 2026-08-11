import type { PrismaClient } from '@prisma/client';
import type { PreenchimentoSugestaoDTO } from '@escalas/shared-types';
import { ConflictError, NotFoundError, HttpError } from '../utils/errors.js';
import { diasNoIntervalo } from '../utils/estruturaTemplate.js';
import { normalizeFuncao } from '../utils/funcao.js';
import { planejarPreenchimento, type PlanoInput } from '../utils/preenchimento.js';
import { auditService } from './audit.service.js';
import { adminService } from './admin.service.js';
import { patenteService } from './patente.service.js';

const DESCANSO_HORAS_DEFAULT = 72;

async function escalaRascunho(escala_id: number, prisma: PrismaClient) {
  const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
  if (!escala) throw new NotFoundError('Escala não encontrada.');
  if (escala.status !== 'rascunho') throw new ConflictError('Só é possível preencher automaticamente em escala rascunho.');
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

type EscalaRow = { id: number; lotacao_id: number; mes: number; ano: number; template_id: number | null };

async function montarPlano(
  escala: EscalaRow,
  dias: Date[],
  descanso_horas: number,
  prisma: PrismaClient,
): Promise<PlanoInput> {
  // pool de militares da lotação — sem teto: quem ficar de fora não é considerado na
  // equidade e nunca é escalado, então o pool tem que ser o efetivo inteiro da lotação.
  const usuarios = await adminService.listarUsuarios(
    { lotacao_id: escala.lotacao_id, limite: null },
    prisma,
  );
  const militares = usuarios.map((u) => ({ id: u.id, nome: u.nome, patente_id: u.patente_id }));

  // política de localidade vem do layout da escala; escala sem layout ⇒ indiferente.
  const template = escala.template_id == null
    ? null
    : await prisma.templateLotacao.findUnique({
        where: { id: escala.template_id },
        select: { politica_localidade: true },
      });
  const politicaLocalidade = template?.politica_localidade ?? 'indiferente';

  // contagemInicial (equidade): vagas preenchidas nesta escala + em escalas anteriores
  // (mesma lotação, status publicada/aprovada, mês/ano estritamente anterior).
  const [vagasNestaEscala, vagasAnteriores] = await Promise.all([
    prisma.vaga.findMany({
      where: { militar_id: { not: null }, guarnicao: { dia: { escala_id: escala.id } } },
      select: { militar_id: true, guarnicao: { select: { atividade: true } } },
    }),
    prisma.vaga.findMany({
      where: {
        militar_id: { not: null },
        guarnicao: {
          dia: {
            escala: {
              lotacao_id: escala.lotacao_id,
              status: { in: ['publicada', 'aprovada'] },
              OR: [{ ano: { lt: escala.ano } }, { AND: [{ ano: escala.ano }, { mes: { lt: escala.mes } }] }],
            },
          },
        },
      },
      select: { militar_id: true, guarnicao: { select: { atividade: true } } },
    }),
  ]);
  const contagemInicial = new Map<number, number>();
  const contagemLocalInicial = new Map<number, Map<string, number>>();
  for (const v of [...vagasNestaEscala, ...vagasAnteriores]) {
    if (v.militar_id == null) continue;
    contagemInicial.set(v.militar_id, (contagemInicial.get(v.militar_id) ?? 0) + 1);
    const key = normalizeFuncao(v.guarnicao.atividade);
    const mapa = contagemLocalInicial.get(v.militar_id) ?? new Map<string, number>();
    mapa.set(key, (mapa.get(key) ?? 0) + 1);
    contagemLocalInicial.set(v.militar_id, mapa);
  }

  // intervalosExistentes: vagas já preenchidas nos dias do intervalo desta escala
  const vagasIntervalo = await prisma.vaga.findMany({
    where: { militar_id: { not: null }, guarnicao: { dia: { escala_id: escala.id, data: { in: dias } } } },
    include: { guarnicao: { include: { dia: true } } },
  });
  const intervalosExistentes = vagasIntervalo
    .filter((v): v is typeof v & { militar_id: number } => v.militar_id != null)
    .map((v) => ({
      militar_id: v.militar_id,
      data: v.guarnicao.dia.data.toISOString().slice(0, 10),
      turno_inicio: v.turno_inicio,
      turno_fim: v.turno_fim,
    }));

  // vagas abertas nos dias do intervalo
  const vagasAbertas = await prisma.vaga.findMany({
    where: { militar_id: null, guarnicao: { dia: { escala_id: escala.id, data: { in: dias } } } },
    include: { guarnicao: { include: { dia: true } } },
  });
  const vagas = vagasAbertas.map((v) => ({
    vaga_id: v.id,
    data: v.guarnicao.dia.data.toISOString().slice(0, 10),
    guarnicao_sigla: v.guarnicao.sigla,
    guarnicao_atividade: v.guarnicao.atividade,
    guarnicao_ordem: v.guarnicao.ordem,
    funcao: v.funcao,
    turno_inicio: v.turno_inicio,
    turno_fim: v.turno_fim,
  }));

  // esperadasPorFuncao: chave = funcao exata da vaga; memoizado por normalizeFuncao (evita N+1).
  const esperadasPorFuncao = new Map<string, number[]>();
  const memo = new Map<string, number[]>();
  for (const v of vagas) {
    if (esperadasPorFuncao.has(v.funcao)) continue;
    const funcao_norm = normalizeFuncao(v.funcao);
    if (!memo.has(funcao_norm)) {
      const esperadas = await patenteService.esperadasPara(v.funcao, escala.lotacao_id, escala.template_id, prisma);
      memo.set(funcao_norm, esperadas ?? []);
    }
    esperadasPorFuncao.set(v.funcao, memo.get(funcao_norm)!);
  }

  return { descanso_horas, militares, contagemInicial, contagemLocalInicial, politicaLocalidade, intervalosExistentes, vagas, esperadasPorFuncao };
}

export const preenchimentoService = {
  async sugerir(
    escala_id: number,
    data_ini: string,
    data_fim: string,
    descanso_horas: number | undefined,
    prisma: PrismaClient,
  ): Promise<PreenchimentoSugestaoDTO[]> {
    const escala = await escalaRascunho(escala_id, prisma);
    const dias = diasNoIntervalo(data_ini, data_fim);
    validarIntervaloNoMes(escala, dias);
    const plano = await montarPlano(escala, dias, descanso_horas ?? DESCANSO_HORAS_DEFAULT, prisma);
    return planejarPreenchimento(plano);
  },

  async aplicar(
    escala_id: number,
    data_ini: string,
    data_fim: string,
    descanso_horas: number | undefined,
    user_id: number,
    prisma: PrismaClient,
  ): Promise<{ vagas_preenchidas: number; avisos_patente: number; avisos_descanso: number }> {
    const escala = await escalaRascunho(escala_id, prisma);
    const dias = diasNoIntervalo(data_ini, data_fim);
    validarIntervaloNoMes(escala, dias);
    const descanso = descanso_horas ?? DESCANSO_HORAS_DEFAULT;
    const plano = await montarPlano(escala, dias, descanso, prisma);
    const resultado = planejarPreenchimento(plano);

    return prisma.$transaction(async (tx) => {
      let vagas_preenchidas = 0;
      let avisos_patente = 0;
      let avisos_descanso = 0;
      for (const r of resultado) {
        if (r.militar_id == null) continue;
        // relê e só grava se a vaga ainda estiver aberta (defesa contra edição concorrente/manual).
        const upd = await tx.vaga.updateMany({
          where: { id: r.vaga_id, militar_id: null },
          data: { militar_id: r.militar_id },
        });
        if (upd.count === 0) continue;
        vagas_preenchidas += 1;
        if (r.aviso_patente) avisos_patente += 1;
        if (r.aviso_descanso) avisos_descanso += 1;
      }
      await auditService.log(
        {
          user_id,
          acao: 'preencher_auto',
          entidade: 'Escala',
          entidade_id: escala_id,
          depois: { data_ini, data_fim, descanso_horas: descanso, vagas_preenchidas },
        },
        tx,
      );
      return { vagas_preenchidas, avisos_patente, avisos_descanso };
    });
  },
};
