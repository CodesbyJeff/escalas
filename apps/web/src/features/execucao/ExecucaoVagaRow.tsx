// apps/web/src/features/execucao/ExecucaoVagaRow.tsx
import { Badge, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { ExecucaoDiaDTO, SituacaoExecucaoDTO } from '@escalas/shared-types';
import { MilitarPicker } from '../../components/MilitarPicker';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

export type DiaVaga = ExecucaoDiaDTO['guarnicoes'][number]['vagas'][number];

export const SITUACAO_OPCOES: { value: SituacaoExecucaoDTO; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'falta', label: 'Falta' },
  { value: 'substituido', label: 'Substituído' },
  { value: 'preenchido', label: 'Preenchido' },
];
const SITUACAO_LABEL: Record<SituacaoExecucaoDTO, string> = {
  presente: 'Presente', falta: 'Falta', substituido: 'Substituído', preenchido: 'Preenchido',
};

export function ExecucaoVagaRow({ escalaId, vaga, getMilitarNome, mode, draft, onChange }: {
  escalaId: number;
  vaga: DiaVaga;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  draft?: ExecucaoVagaDraft;
  onChange?: (patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  const previsto = vaga.militar_id != null ? getMilitarNome(vaga.militar_id) : 'VAGO';

  if (mode === 'validar') {
    const ex = vaga.execucao;
    return (
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={500}>{vaga.funcao} — <Text span c="dimmed">{previsto}</Text></Text>
        {ex ? (
          <Group gap="xs">
            <Badge variant="light">{SITUACAO_LABEL[ex.situacao]}</Badge>
            {ex.militar_executado_id != null && <Text size="xs">→ {getMilitarNome(ex.militar_executado_id)}</Text>}
            {ex.do && <Badge color="grape" variant="light">DO</Badge>}
            {ex.observacoes && <Text size="xs" c="dimmed">"{ex.observacoes}"</Text>}
          </Group>
        ) : <Badge color="gray" variant="outline">Sem registro</Badge>}
      </Group>
    );
  }

  const d = draft!;
  const mostrarPicker = d.situacao === 'substituido' || d.situacao === 'preenchido';
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>{vaga.funcao} — <Text span c="dimmed">{previsto}</Text></Text>
        <Switch
          label="DO"
          checked={d.do}
          onChange={(e) => onChange!({ do: e.currentTarget.checked })}
          aria-label={`Diária Operacional ${vaga.funcao}`}
        />
      </Group>
      <Group grow align="flex-start">
        <Select
          aria-label={`Situação ${vaga.funcao}`}
          data={SITUACAO_OPCOES}
          value={d.situacao}
          onChange={(v) => v && onChange!({ situacao: v as SituacaoExecucaoDTO })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: false }}
        />
        {mostrarPicker && (
          <MilitarPicker
            escalaId={escalaId}
            value={d.militar_executado_id}
            onChange={(id) => onChange!({ militar_executado_id: id })}
          />
        )}
      </Group>
      <TextInput
        placeholder="Observações"
        maxLength={280}
        value={d.observacoes}
        onChange={(e) => onChange!({ observacoes: e.currentTarget.value })}
        aria-label={`Observações ${vaga.funcao}`}
      />
    </Stack>
  );
}
