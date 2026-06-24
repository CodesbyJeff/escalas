import { useForm, zodResolver } from '@mantine/form';
import { Paper, Stack, Select, NumberInput, Button, Title } from '@mantine/core';
import { criarEscalaSchema, type CriarEscalaInput } from '@escalas/shared-schemas';

const now = new Date();
export function NovaEscalaForm({ lotacoes, onSubmit }: {
  lotacoes: { value: string; label: string }[];
  onSubmit: (v: CriarEscalaInput) => Promise<void>;
}) {
  const form = useForm({
    initialValues: { lotacao_id: 0, mes: now.getMonth() + 1, ano: now.getFullYear() },
    validate: zodResolver(criarEscalaSchema),
  });
  return (
    <Paper p="xl" maw={520} withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <Title order={3}>Criar Escala</Title>
          <Select
            label="Lotação" placeholder="Selecione uma lotação..." data={lotacoes}
            value={form.values.lotacao_id ? String(form.values.lotacao_id) : null}
            onChange={(v) => form.setFieldValue('lotacao_id', Number(v))}
            error={form.errors.lotacao_id}
          />
          <NumberInput label="Mês" min={1} max={12} {...form.getInputProps('mes')} />
          <NumberInput label="Ano" min={2024} max={2100} {...form.getInputProps('ano')} />
          <Button type="submit" loading={form.submitting}>Gerar Escala</Button>
        </Stack>
      </form>
    </Paper>
  );
}
