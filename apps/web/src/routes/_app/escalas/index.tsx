import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Stack, Breadcrumbs, Anchor } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { escalasApi } from '../../../lib/api/escalas';
import { EscalasTable } from '../../../features/escalas/EscalasTable';
import { PageHeader, LoadingState } from '../../../components/ui';

export const Route = createFileRoute('/_app/escalas/')({ component: ListarPage });

function ListarPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['escalas'], queryFn: escalasApi.listar });
  const del = useMutation({
    mutationFn: (id: number) => escalasApi.deletar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalas'] }); notifications.show({ message: 'Escala excluída.' }); },
    onError: (e) => notifications.show({ color: 'red', message: (e as Error).message }),
  });
  return (
    <Stack>
      <Breadcrumbs><Anchor href="#">Escalas CBMRN</Anchor><span>Listar Escalas</span></Breadcrumbs>
      <PageHeader
        title="Lista de Escalas"
        actions={<Button onClick={() => navigate({ to: '/escalas/nova' })}>Nova Escala</Button>}
      />
      {isLoading ? <LoadingState variant="table" /> : (
        <EscalasTable
          escalas={data ?? []}
          onEditar={(e) => navigate({ to: '/escalas/$id', params: { id: String(e.id) } })}
          onExcluir={(e) => del.mutate(e.id)}
        />
      )}
    </Stack>
  );
}
