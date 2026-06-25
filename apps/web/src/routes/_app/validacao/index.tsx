import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Stack, Title } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { execucaoApi } from '../../../lib/api/execucao';
import { ExecucaoWorklistTable } from '../../../features/execucao/ExecucaoWorklistTable';

export const Route = createFileRoute('/_app/validacao/')({ component: GestorWorklistPage });

function GestorWorklistPage() {
  const navigate = useNavigate();
  return (
    <GestorWorklist
      onAbrir={(it) => navigate({ to: '/validacao/escalas/$id/dias/$data', params: { id: String(it.escala_id), data: it.data } })}
    />
  );
}

export function GestorWorklist({ onAbrir }: { onAbrir: (it: ExecucaoPendenteDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['execucao', 'pendentes', 'gestor'], queryFn: execucaoApi.pendentesGestor });
  if (isLoading) return <Loader />;
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Validação — dias aguardando</Title>
      <ExecucaoWorklistTable itens={data} actionLabel="Validar" emptyText="Nenhum dia aguardando validação." onAbrir={onAbrir} />
    </Stack>
  );
}
