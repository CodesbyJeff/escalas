// apps/web/src/routes/_app/aprovacao/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader, Stack, Table, Text, Title, Button, Badge } from '@mantine/core';
import type { EscalaDTO } from '@escalas/shared-types';
import { validacoesApi } from '../../../lib/api/validacoes';

export const Route = createFileRoute('/_app/aprovacao/')({ component: AprovacaoWorklistPage });

function AprovacaoWorklistPage() {
  const navigate = useNavigate();
  return <AprovacaoWorklist onAbrir={(e) => navigate({ to: '/aprovacao/escalas/$id', params: { id: String(e.id) } })} />;
}

export function AprovacaoWorklist({ onAbrir }: { onAbrir: (e: EscalaDTO) => void }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['validacoes', 'pendentes'], queryFn: validacoesApi.pendentes });
  if (isLoading) return <Loader />;
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Aprovação de Escalas</Title>
      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhuma escala aguardando aprovação.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Lotação</Table.Th><Table.Th>Período</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ação</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>#{e.lotacao_id}</Table.Td>
                <Table.Td>{String(e.mes).padStart(2, '0')}/{e.ano}</Table.Td>
                <Table.Td><Badge color="yellow">{e.status}</Badge></Table.Td>
                <Table.Td><Button size="xs" variant="light" onClick={() => onAbrir(e)}>Revisar</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
