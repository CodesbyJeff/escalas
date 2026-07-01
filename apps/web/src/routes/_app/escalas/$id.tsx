import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Group, Loader, Stack, Title, Text } from '@mantine/core';
import { escalasApi } from '../../../lib/api/escalas';
import { SeletorDeDia } from '../../../features/escalas/SeletorDeDia';

export const Route = createFileRoute('/_app/escalas/$id')({ component: DetalhePage });

function DetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: escala, isLoading } = useQuery({
    queryKey: ['escala-mes', Number(id)], queryFn: () => escalasApi.getMes(Number(id)),
  });
  if (isLoading || !escala) return <Loader />;
  return (
    <Stack>
      <Title order={3}>Escala {String(escala.mes).padStart(2, '0')}/{escala.ano}</Title>
      <Text>Clique no dia para editar</Text>
      <SeletorDeDia
        mes={escala.mes} ano={escala.ano} dias={escala.dias}
        onSelecionar={(data) => navigate({ to: '/escalas/$id/dias/$data', params: { id, data } })}
      />
      <Group>
        <Box w={16} h={16} bg="green.2" style={{ borderRadius: 4 }} />
        <Text size="sm">Completo</Text>
        <Box w={16} h={16} bg="yellow.2" style={{ borderRadius: 4 }} />
        <Text size="sm">Tem vaga aberta (DO)</Text>
      </Group>
    </Stack>
  );
}
