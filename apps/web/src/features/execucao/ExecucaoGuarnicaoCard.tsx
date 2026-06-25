// apps/web/src/features/execucao/ExecucaoGuarnicaoCard.tsx
import { Card, Divider, Group, Stack, Text } from '@mantine/core';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { ExecucaoVagaRow } from './ExecucaoVagaRow';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

type Guarnicao = ExecucaoDiaDTO['guarnicoes'][number];

export function ExecucaoGuarnicaoCard({ escalaId, guarnicao, getMilitarNome, mode, getDraft, onChangeVaga }: {
  escalaId: number;
  guarnicao: Guarnicao;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  getDraft?: (vaga_id: number) => ExecucaoVagaDraft | undefined;
  onChangeVaga?: (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  return (
    <Card withBorder>
      <Group justify="space-between">
        <Text fw={700}>{guarnicao.sigla} — {guarnicao.atividade}</Text>
        <Text size="sm" c="dimmed">{guarnicao.turno_inicio} – {guarnicao.turno_fim}</Text>
      </Group>
      <Divider my="xs" />
      <Stack gap="sm">
        {guarnicao.vagas.map((v) => (
          <ExecucaoVagaRow
            key={v.id}
            escalaId={escalaId}
            vaga={v}
            getMilitarNome={getMilitarNome}
            mode={mode}
            draft={mode === 'registrar' ? getDraft?.(v.id) : undefined}
            onChange={mode === 'registrar' ? (patch) => onChangeVaga?.(v.id, patch) : undefined}
          />
        ))}
      </Stack>
    </Card>
  );
}
