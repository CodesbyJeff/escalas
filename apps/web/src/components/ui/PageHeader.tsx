import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Cabeçalho de página padrão.
 *
 * Um único nível semântico (h1) para o título da página, em toda tela. Antes
 * disto o sistema tinha 18 títulos com `order` entre 3 e 6 para a mesma
 * hierarquia — o que quebrava a navegação por heading em leitor de tela.
 */
export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" mb="md">
      <Stack gap={2}>
        <Title order={1} fz="h3">{title}</Title>
        {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
      </Stack>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}
