import { Table, Badge, Group, ActionIcon, Text } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { EscalaDTO } from '@escalas/shared-types';

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'gray', publicada: 'blue', em_validacao: 'yellow', aprovada: 'green', rejeitada: 'red',
};

export function EscalasTable({ escalas, onEditar, onExcluir }: {
  escalas: EscalaDTO[]; onEditar: (e: EscalaDTO) => void; onExcluir: (e: EscalaDTO) => void;
}) {
  if (escalas.length === 0) return <Text c="dimmed" ta="center" py="xl">Nenhuma escala encontrada.</Text>;
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr><Table.Th>Período</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th></Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {escalas.map((e) => (
          <Table.Tr key={e.id}>
            <Table.Td>{String(e.mes).padStart(2, '0')}/{e.ano}</Table.Td>
            <Table.Td><Badge color={STATUS_COLOR[e.status] ?? 'gray'}>{e.status}</Badge></Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon variant="subtle" aria-label="Editar" onClick={() => onEditar(e)}><IconPencil size={16} /></ActionIcon>
                <ActionIcon variant="subtle" color="red" aria-label="Excluir" onClick={() => onExcluir(e)}><IconTrash size={16} /></ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
