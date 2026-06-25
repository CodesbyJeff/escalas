import { Button, Table, Text } from '@mantine/core';
import type { ExecucaoPendenteDTO } from '@escalas/shared-types';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';

export function ExecucaoWorklistTable({ itens, actionLabel, emptyText, onAbrir }: {
  itens: ExecucaoPendenteDTO[];
  actionLabel: string;
  emptyText: string;
  onAbrir: (item: ExecucaoPendenteDTO) => void;
}) {
  if (itens.length === 0) return <Text c="dimmed" ta="center" py="xl">{emptyText}</Text>;
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Lotação</Table.Th><Table.Th>Data</Table.Th><Table.Th>Status</Table.Th>
          <Table.Th>Vagas</Table.Th><Table.Th>Ação</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {itens.map((it) => (
          <Table.Tr key={`${it.escala_id}-${it.data}`}>
            <Table.Td>#{it.lotacao_id}</Table.Td>
            <Table.Td>{it.data}</Table.Td>
            <Table.Td><StatusExecucaoBadge status={it.execucao_status} /></Table.Td>
            <Table.Td>{it.vagas_total}</Table.Td>
            <Table.Td><Button size="xs" variant="light" onClick={() => onAbrir(it)}>{actionLabel}</Button></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
