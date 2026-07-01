import { Button, Card, Group, NumberInput, Stack, TextInput, Title, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { useLayoutDraft } from './useLayoutDraft';

export function LayoutEditor({ draft, onSalvar, salvando }: {
  draft: ReturnType<typeof useLayoutDraft>; onSalvar: () => void; salvando: boolean;
}) {
  return (
    <Stack>
      <Group justify="space-between">
        <TextInput label="Nome do layout" w={280} {...draft.getInputProps('nome')} />
        <Group><Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
          <Button color="cbmrn" onClick={onSalvar} loading={salvando}>Salvar Layout</Button></Group>
      </Group>
      {draft.values.guarnicoes.map((g, gi) => (
        <Card key={gi} withBorder>
          <Group>
            <TextInput label="Sigla" w={100} {...draft.getInputProps(`guarnicoes.${gi}.sigla`)} />
            <TextInput label="Atividade" w={160} {...draft.getInputProps(`guarnicoes.${gi}.atividade`)} />
            <TextInput label="Início" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_inicio`)} />
            <TextInput label="Fim" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_fim`)} />
            <ActionIcon color="red" mt={24} aria-label="Remover guarnição" onClick={() => draft.removeGuarnicao(gi)}><IconTrash size={16} /></ActionIcon>
          </Group>
          <Title order={6} mt="sm">Vagas (função × quantidade)</Title>
          {g.vagas_sugeridas.map((_v, vi) => (
            <Group key={vi} mt={4}>
              <TextInput placeholder="Função" w={200} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.funcao`)} />
              <NumberInput w={90} min={1} max={50} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.quantidade_sugerida`)} />
              <ActionIcon variant="subtle" color="red" aria-label="Remover vaga" onClick={() => draft.removeVaga(gi, vi)}><IconTrash size={14} /></ActionIcon>
            </Group>
          ))}
          <Button mt="xs" size="xs" variant="light" onClick={() => draft.addVaga(gi)}>Adicionar Vaga</Button>
        </Card>
      ))}
    </Stack>
  );
}
