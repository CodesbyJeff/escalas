import { useForm } from '@mantine/form';
import type { CriarLayoutInput } from '@escalas/shared-schemas';

const novaVaga = () => ({ funcao: '', quantidade_sugerida: 1 });
const novaGuarnicao = (ordem: number) => ({ sigla: '', atividade: '', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem, vagas_sugeridas: [novaVaga()] });

export function useLayoutDraft(inicial?: CriarLayoutInput) {
  const form = useForm<CriarLayoutInput>({ initialValues: inicial ?? { nome: '', guarnicoes: [novaGuarnicao(0)] } });
  return {
    ...form,
    setNome: (n: string) => form.setFieldValue('nome', n),
    addGuarnicao: () => form.insertListItem('guarnicoes', novaGuarnicao(form.values.guarnicoes.length)),
    removeGuarnicao: (gi: number) => form.removeListItem('guarnicoes', gi),
    addVaga: (gi: number) => form.insertListItem(`guarnicoes.${gi}.vagas_sugeridas`, novaVaga()),
    removeVaga: (gi: number, vi: number) => form.removeListItem(`guarnicoes.${gi}.vagas_sugeridas`, vi),
    toPayload: (): CriarLayoutInput => form.values,
  };
}
