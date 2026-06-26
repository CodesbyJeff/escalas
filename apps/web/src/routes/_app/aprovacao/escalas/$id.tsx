// apps/web/src/routes/_app/aprovacao/escalas/$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Loader, Modal, SimpleGrid, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { validacoesApi } from '../../../../lib/api/validacoes';
import { escalasApi } from '../../../../lib/api/escalas';
import { ApiError } from '../../../../lib/api/client';
import { ResumoServicosTable } from '../../../../features/aprovacao/ResumoServicosTable';

export const Route = createFileRoute('/_app/aprovacao/escalas/$id')({ component: AprovacaoEscalaPage });

function AprovacaoEscalaPage() {
  const { id } = Route.useParams();
  return <AprovacaoEscalaScreen escalaId={Number(id)} />;
}

export function AprovacaoEscalaScreen({ escalaId }: { escalaId: number }) {
  const { data: mes, isLoading: l1 } = useQuery({ queryKey: ['escala', 'mes', escalaId], queryFn: () => escalasApi.getMes(escalaId) });
  const { data: resumo = [], isLoading: l2 } = useQuery({ queryKey: ['resumo-servicos', escalaId], queryFn: () => validacoesApi.resumoServicos(escalaId) });
  const [rejeitarOpen, rejeitar] = useDisclosure(false);
  const [justificativa, setJustificativa] = useState('');
  const qc = useQueryClient();

  const validar = useMutation({
    mutationFn: (input: { status: 'aprovada' | 'rejeitada'; justificativa?: string }) => validacoesApi.validar(escalaId, input),
    onSuccess: (_r, input) => {
      rejeitar.close();
      notifications.show({ message: input.status === 'aprovada' ? 'Escala aprovada.' : 'Escala rejeitada.' });
      qc.invalidateQueries({ queryKey: ['validacoes', 'pendentes'] });
      qc.invalidateQueries({ queryKey: ['escala', 'mes', escalaId] });
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.status === 409) notifications.show({ color: 'red', message: 'A escala mudou de estado. Recarregue.' });
      else if (err.status === 422) notifications.show({ color: 'red', message: err.message });
      else notifications.show({ color: 'red', message: err.message });
    },
  });

  if (l1 || l2 || !mes) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Aprovação — {String(mes.mes).padStart(2, '0')}/{mes.ano}</Title>
        <Group>
          <Button color="green" onClick={() => validar.mutate({ status: 'aprovada' })} loading={validar.isPending}>Aprovar</Button>
          <Button color="red" variant="light" onClick={rejeitar.open}>Rejeitar</Button>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Stack gap="xs">
          <Text fw={700}>Prevista (cobertura por dia)</Text>
          <Table striped withTableBorder>
            <Table.Thead><Table.Tr><Table.Th>Dia</Table.Th><Table.Th>Vagas preenchidas</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {mes.dias.map((d) => (
                <Table.Tr key={d.data}><Table.Td>{d.data}</Table.Td><Table.Td>{d.vagas_preenchidas}/{d.vagas_total}</Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Resumo de serviços</Text>
          <ResumoServicosTable itens={resumo} />
        </Stack>
      </SimpleGrid>
      <Modal opened={rejeitarOpen} onClose={() => { rejeitar.close(); setJustificativa(''); }} title="Rejeitar escala" centered>
        <Stack>
          <Textarea label="Justificativa" placeholder="Descreva o que precisa ser corrigido" minRows={3} maxLength={500} value={justificativa} onChange={(e) => setJustificativa(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { rejeitar.close(); setJustificativa(''); }}>Cancelar</Button>
            <Button color="red" disabled={!justificativa.trim()} loading={validar.isPending} onClick={() => validar.mutate({ status: 'rejeitada', justificativa: justificativa.trim() })}>Confirmar rejeição</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
