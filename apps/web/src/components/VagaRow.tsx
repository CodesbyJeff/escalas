import { Group, TextInput, Badge, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { VagaInput } from '@escalas/shared-schemas';
import { MilitarPicker } from './MilitarPicker';

export function VagaRow({ escalaId, vaga, funcaoProps, conflito, onSetMilitar, onRemove }: {
  escalaId: number; vaga: VagaInput; funcaoProps: object; conflito?: boolean;
  onSetMilitar: (id: number | null) => void; onRemove: () => void;
}) {
  return (
    <Group gap="xs" wrap="nowrap" bg={conflito ? 'red.1' : undefined} p={4}>
      <TextInput placeholder="Função" w={120} {...funcaoProps} />
      <MilitarPicker escalaId={escalaId} value={vaga.militar_id} onChange={onSetMilitar} />
      {vaga.militar_id === null && <Badge color="grape" title="Diária Operacional — vaga aberta, será ofertada">DO</Badge>}
      <ActionIcon variant="subtle" color="red" aria-label="Remover vaga" onClick={onRemove}><IconTrash size={14} /></ActionIcon>
    </Group>
  );
}
