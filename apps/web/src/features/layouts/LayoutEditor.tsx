import { Button, Card, Group, NumberInput, SegmentedControl, Stack, Text, TextInput, Title, ActionIcon, MultiSelect } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { patentesApi } from '../../lib/api/patentes';
import type { useLayoutDraft } from './useLayoutDraft';

export function LayoutEditor({ draft, onSalvar, salvando }: {
  draft: ReturnType<typeof useLayoutDraft>; onSalvar: () => void; salvando: boolean;
}) {
  const { data: patentes = [] } = useQuery({ queryKey: ['patentes'], queryFn: () => patentesApi.listar() });
  const patenteOpts = [...patentes]
    .sort((a, b) => a.forca_id - b.forca_id || a.ordem - b.ordem)
    .map((p) => ({ value: String(p.id), label: `${p.sigla} — ${p.nome}` }));
  return (
    <Stack>
      <Group justify="space-between">
        <TextInput label="Nome do layout" w={280} {...draft.getInputProps('nome')} />
        <Group><Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
          <Button color="cbmrn" onClick={onSalvar} loading={salvando}>Salvar Layout</Button></Group>
      </Group>
      <Stack gap={4}>
        <SegmentedControl
          w={420}
          data={[
            { value: 'indiferente', label: 'Indiferente' },
            { value: 'rodizia', label: 'Rodiziar' },
            { value: 'fixa', label: 'Fixar' },
          ]}
          {...draft.getInputProps('politica_localidade')}
        />
        <Text size="xs" c="dimmed">
          {draft.values.politica_localidade === 'rodizia'
            ? 'O preenchimento automático gira o militar entre as guarnições — usar nas praias do GBSA.'
            : draft.values.politica_localidade === 'fixa'
              ? 'O militar permanece na guarnição dele (incêndio, resgate). Militar sem histórico precisa de uma primeira escalação manual.'
              : 'A guarnição não influencia a escolha do preenchimento automático.'}
        </Text>
      </Stack>
      {draft.values.guarnicoes.map((g, gi) => (
        <Card key={gi} withBorder>
          <Group>
            <TextInput label="Sigla" w={100} {...draft.getInputProps(`guarnicoes.${gi}.sigla`)} />
            <TextInput label="Atividade" w={160} {...draft.getInputProps(`guarnicoes.${gi}.atividade`)} />
            <TextInput label="Início" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_inicio`)} />
            <TextInput label="Fim" w={90} {...draft.getInputProps(`guarnicoes.${gi}.turno_padrao_fim`)} />
            <NumberInput label="Ciclo (dias)" description="24×72 = 4" w={110} min={1} max={31} {...draft.getInputProps(`guarnicoes.${gi}.ciclo_dias`)} />
            <ActionIcon color="red" mt={24} aria-label="Remover guarnição" onClick={() => draft.removeGuarnicao(gi)}><IconTrash size={16} /></ActionIcon>
          </Group>
          <Title order={6} mt="sm">Vagas (função × quantidade)</Title>
          {g.vagas_sugeridas.map((_v, vi) => (
            <Group key={vi} mt={4}>
              <TextInput placeholder="Função" w={200} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.funcao`)} />
              <NumberInput w={90} min={1} max={50} {...draft.getInputProps(`guarnicoes.${gi}.vagas_sugeridas.${vi}.quantidade_sugerida`)} />
              <MultiSelect
                label="Patentes esperadas" placeholder="(herda da lotação/global)" w={260} data={patenteOpts} searchable clearable
                value={(draft.values.guarnicoes[gi]!.vagas_sugeridas[vi]!.patentes_esperadas ?? []).map(String)}
                onChange={(vals) => draft.setFieldValue(`guarnicoes.${gi}.vagas_sugeridas.${vi}.patentes_esperadas`, vals.map(Number))}
              />
              <ActionIcon variant="subtle" color="red" aria-label="Remover vaga" onClick={() => draft.removeVaga(gi, vi)}><IconTrash size={14} /></ActionIcon>
            </Group>
          ))}
          <Button mt="xs" size="xs" variant="light" onClick={() => draft.addVaga(gi)}>Adicionar Vaga</Button>
        </Card>
      ))}
    </Stack>
  );
}
