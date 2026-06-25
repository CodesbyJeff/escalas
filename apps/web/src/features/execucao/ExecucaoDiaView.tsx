// apps/web/src/features/execucao/ExecucaoDiaView.tsx
import { Alert, SimpleGrid, Stack } from '@mantine/core';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { ExecucaoGuarnicaoCard } from './ExecucaoGuarnicaoCard';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';
import type { ExecucaoVagaDraft } from './useExecucaoDraft';

export function ExecucaoDiaView({ escalaId, dia, getMilitarNome, mode, getDraft, onChangeVaga }: {
  escalaId: number;
  dia: ExecucaoDiaDTO;
  getMilitarNome: (id: number) => string;
  mode: 'registrar' | 'validar';
  getDraft?: (vaga_id: number) => ExecucaoVagaDraft | undefined;
  onChangeVaga?: (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) => void;
}) {
  return (
    <Stack>
      <StatusExecucaoBadge status={dia.execucao_status} />
      {dia.execucao_status === 'rejeitada' && dia.justificativa && (
        <Alert color="red" title="Rejeitada pelo gestor">{dia.justificativa}</Alert>
      )}
      {dia.guarnicoes.length === 0 ? (
        <Alert color="gray">Sem guarnições neste dia.</Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {dia.guarnicoes.map((g) => (
            <ExecucaoGuarnicaoCard
              key={g.id}
              escalaId={escalaId}
              guarnicao={g}
              getMilitarNome={getMilitarNome}
              mode={mode}
              getDraft={getDraft}
              onChangeVaga={onChangeVaga}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
