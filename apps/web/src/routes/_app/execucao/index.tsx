import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Stack } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { execucaoApi } from '../../../lib/api/execucao';
import { ExecucaoWorklistTable } from '../../../features/execucao/ExecucaoWorklistTable';
import { PageHeader, LoadingState } from '../../../components/ui';

export const Route = createFileRoute('/_app/execucao/')({ component: FiscalWorklistPage });

function FiscalWorklistPage() {
  const navigate = useNavigate();
  return (
    <FiscalWorklist
      onAbrir={(it) => navigate({ to: '/execucao/escalas/$id/dias/$data', params: { id: String(it.escala_id), data: it.data } })}
    />
  );
}

export function FiscalWorklist({ onAbrir }: { onAbrir: (it: ExecucaoPendenteDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['execucao', 'pendentes', 'fiscal'], queryFn: execucaoApi.pendentesFiscal });
  return (
    <Stack>
      <PageHeader title="Execução" subtitle="Dias a registrar" />
      {isLoading ? <LoadingState variant="table" /> : (
        <ExecucaoWorklistTable itens={data} actionLabel="Registrar" emptyText="Nenhum dia pendente de registro." onAbrir={onAbrir} />
      )}
    </Stack>
  );
}
