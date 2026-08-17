import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const atual = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const proximo = atual === 'dark' ? 'light' : 'dark';

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={`Mudar para tema ${proximo === 'dark' ? 'escuro' : 'claro'}`}
      onClick={() => setColorScheme(proximo)}
    >
      {atual === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}
