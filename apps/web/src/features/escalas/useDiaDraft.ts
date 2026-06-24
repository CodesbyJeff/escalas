import { useForm } from '@mantine/form';
import type { EscalaDiaDTO } from '@escalas/shared-types';
import type { PutDiaInput, GuarnicaoInput, VagaInput } from '@escalas/shared-schemas';

function novaVaga(turno_inicio = '08:00', turno_fim = '08:00'): VagaInput {
  return { funcao: '', militar_id: null, turno_inicio, turno_fim };
}
function novaGuarnicao(ordem: number): GuarnicaoInput {
  return { sigla: '', atividade: '', viatura_id: null, turno_inicio: '08:00', turno_fim: '08:00', ordem, vagas: [novaVaga()] };
}

export function useDiaDraft(dia: EscalaDiaDTO) {
  const form = useForm<PutDiaInput>({
    initialValues: {
      observacoes: dia.observacoes,
      guarnicoes: dia.guarnicoes.map((g) => ({
        sigla: g.sigla, atividade: g.atividade, viatura_id: g.viatura_id,
        turno_inicio: g.turno_inicio, turno_fim: g.turno_fim, ordem: g.ordem,
        vagas: g.vagas.map((v) => ({
          funcao: v.funcao, militar_id: v.militar_id,
          turno_inicio: v.turno_inicio, turno_fim: v.turno_fim,
          observacoes: v.observacoes ?? undefined,
        })),
      })),
    },
  });

  return {
    ...form,
    addGuarnicao: () => form.insertListItem('guarnicoes', novaGuarnicao(form.values.guarnicoes.length)),
    removeGuarnicao: (gi: number) => form.removeListItem('guarnicoes', gi),
    addVaga: (gi: number) => form.insertListItem(`guarnicoes.${gi}.vagas`, novaVaga()),
    removeVaga: (gi: number, vi: number) => form.removeListItem(`guarnicoes.${gi}.vagas`, vi),
    toPutInput: (): PutDiaInput => form.values,
  };
}
