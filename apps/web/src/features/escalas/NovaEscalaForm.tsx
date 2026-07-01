import { useForm, zodResolver } from '@mantine/form';
import { Paper, Stack, Select, NumberInput, Button, Title, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { criarEscalaSchema, type CriarEscalaInput } from '@escalas/shared-schemas';
import { layoutsApi } from '../../lib/api/layouts';

const now = new Date();
export function NovaEscalaForm({ lotacoes, onSubmit }: {
  lotacoes: { value: string; label: string }[];
  onSubmit: (v: CriarEscalaInput) => Promise<void>;
}) {
  const form = useForm({
    initialValues: { lotacao_id: 0, mes: now.getMonth() + 1, ano: now.getFullYear(), template_id: 0 },
    validate: zodResolver(criarEscalaSchema),
  });

  const lotacao_id = form.values.lotacao_id;

  const { data: layouts = [] } = useQuery({
    queryKey: ['layouts', lotacao_id],
    queryFn: () => layoutsApi.listar(lotacao_id),
    enabled: lotacao_id > 0,
  });

  const layoutOptions = layouts.map((l) => ({ value: String(l.id), label: l.nome }));
  const semLayouts = lotacao_id > 0 && layouts.length === 0;

  return (
    <Paper p="xl" maw={520} withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <Title order={3}>Criar Escala</Title>
          <Select
            label="Lotação" placeholder="Selecione uma lotação..." data={lotacoes}
            value={form.values.lotacao_id ? String(form.values.lotacao_id) : null}
            onChange={(v) => {
              form.setFieldValue('lotacao_id', Number(v));
              form.setFieldValue('template_id', 0);
            }}
            error={form.errors.lotacao_id}
          />
          <Select
            label="Layout"
            placeholder={semLayouts ? 'Crie um layout para esta lotação em Layouts' : 'Selecione um layout...'}
            data={layoutOptions}
            value={form.values.template_id ? String(form.values.template_id) : null}
            onChange={(v) => form.setFieldValue('template_id', Number(v))}
            error={form.errors.template_id}
            disabled={lotacao_id === 0 || semLayouts}
          />
          {semLayouts && (
            <Text size="xs" c="dimmed">Crie um layout para esta lotação em Layouts</Text>
          )}
          <NumberInput label="Mês" min={1} max={12} {...form.getInputProps('mes')} />
          <NumberInput label="Ano" min={2024} max={2100} {...form.getInputProps('ano')} />
          <Button type="submit" loading={form.submitting}>Gerar Escala</Button>
        </Stack>
      </form>
    </Paper>
  );
}
