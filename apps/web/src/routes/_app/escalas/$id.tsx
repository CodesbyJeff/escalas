import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Modal, Stack, Title, Text } from '@mantine/core';
import { escalasApi } from '../../../lib/api/escalas';
import { SeletorDeDia } from '../../../features/escalas/SeletorDeDia';

export const Route = createFileRoute('/_app/escalas/$id')({ component: DetalhePage });

function DetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: escala, isLoading } = useQuery({
    queryKey: ['escala', Number(id)], queryFn: () => escalasApi.detalhe(Number(id)),
  });
  if (isLoading || !escala) return <Loader />;
  return (
    <Stack>
      <Title order={3}>Escala {String(escala.mes).padStart(2, '0')}/{escala.ano}</Title>
      <Text>Selecione o dia que deseja editar:</Text>
      <Modal opened onClose={() => navigate({ to: '/escalas' })} title="Selecione o dia" centered>
        <SeletorDeDia
          mes={escala.mes} ano={escala.ano}
          onSelecionar={(data) => navigate({ to: '/escalas/$id/dias/$data', params: { id, data } })}
        />
      </Modal>
    </Stack>
  );
}
