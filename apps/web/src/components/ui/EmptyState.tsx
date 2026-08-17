import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

/**
 * Estado vazio desenhado.
 *
 * Substitui os textos `c="dimmed"` soltos. Um estado vazio sem forma é
 * indistinguível de uma tela quebrada — o usuário não sabe se não há dado
 * ou se algo falhou.
 */
export function EmptyState({ title, description, icon, action }: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" maw={420}>
        <ThemeIcon variant="light" color="gray" size={44} radius="xl" aria-hidden="true">
          {icon ?? <IconInbox size={22} />}
        </ThemeIcon>
        <Text fw={600} ta="center">{title}</Text>
        {description && <Text size="sm" c="dimmed" ta="center">{description}</Text>}
        {action}
      </Stack>
    </Center>
  );
}
