// apps/web/src/features/aprovacao/ResumoServicosTable.tsx
import { Table, Text } from '@mantine/core';
import type { ResumoServicoDTO } from '@escalas/shared-types';

export function ResumoServicosTable({ itens }: { itens: ResumoServicoDTO[] }) {
  if (itens.length === 0) return <Text c="dimmed" ta="center" py="md">Nenhum militar previsto na escala.</Text>;
  const totalGeral = itens.reduce((s, r) => s + r.total, 0);
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr><Table.Th>Militar</Table.Th><Table.Th>Total</Table.Th><Table.Th>Semana</Table.Th><Table.Th>FDS/Feriado</Table.Th></Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {itens.map((r) => (
          <Table.Tr key={r.militar_id}>
            <Table.Td>{[r.posto, r.nome].filter(Boolean).join(' ')}</Table.Td>
            <Table.Td>{r.total}</Table.Td>
            <Table.Td>{r.semana}</Table.Td>
            <Table.Td>{r.fim_semana_feriado}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
      <Table.Tfoot>
        <Table.Tr><Table.Th colSpan={4}>Total: {totalGeral}</Table.Th></Table.Tr>
      </Table.Tfoot>
    </Table>
  );
}
