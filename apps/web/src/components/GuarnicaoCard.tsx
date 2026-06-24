import { Card, Group, TextInput, Button, ActionIcon, Stack } from '@mantine/core';
import { IconX, IconPlus } from '@tabler/icons-react';
import type { GuarnicaoInput } from '@escalas/shared-schemas';
import { VagaRow } from './VagaRow';

export function GuarnicaoCard({ escalaId, guarnicao, gi, getInputProps, getVagaProps, setMilitar, onAddVaga, onRemoveVaga, onRemove, conflitos }: {
  escalaId: number; guarnicao: GuarnicaoInput; gi: number;
  getInputProps?: (path: string) => object;
  getVagaProps: (gi: number, vi: number) => object;
  setMilitar: (gi: number, vi: number, id: number | null) => void;
  onAddVaga: (gi: number) => void; onRemoveVaga: (gi: number, vi: number) => void; onRemove: (gi: number) => void;
  conflitos?: Set<number>;
}) {
  const gp = getInputProps ?? (() => ({}));
  const siglaProp = gp(`guarnicoes.${gi}.sigla`);
  const atividadeProp = gp(`guarnicoes.${gi}.atividade`);
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <TextInput w={90} placeholder="Sigla" defaultValue={guarnicao.sigla} {...siglaProp} />
          <TextInput placeholder="Atividade" defaultValue={guarnicao.atividade} {...atividadeProp} />
        </Group>
        <ActionIcon variant="subtle" color="red" aria-label="Remover guarnição" onClick={() => onRemove(gi)}><IconX size={16} /></ActionIcon>
      </Group>
      <Stack gap={4}>
        {guarnicao.vagas.map((v, vi) => (
          <VagaRow key={vi} escalaId={escalaId} vaga={v} funcaoProps={getVagaProps(gi, vi)}
            conflito={conflitos?.has(v.militar_id ?? -1)}
            onSetMilitar={(id) => setMilitar(gi, vi, id)} onRemove={() => onRemoveVaga(gi, vi)} />
        ))}
      </Stack>
      <Button mt="xs" size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => onAddVaga(gi)}>
        Adicionar Função / Militar
      </Button>
    </Card>
  );
}
