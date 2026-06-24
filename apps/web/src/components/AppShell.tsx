import { AppShell, Burger, Group, NavLink, Text, ActionIcon, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconCalendar, IconShieldCheck, IconLogout } from '@tabler/icons-react';
import { Link, Outlet } from '@tanstack/react-router';
import { type ReactNode } from 'react';

export function AppShellNav({ nome, papel, onLogout, children }: {
  nome: string; papel: string; onLogout: () => void; children?: ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Group ml="auto" gap="xs">
            <Avatar color="cbmrn" radius="xl">{nome.charAt(0)}</Avatar>
            <div><Text size="sm" fw={600}>{nome}</Text><Text size="xs" c="dimmed">{papel}</Text></div>
            <ActionIcon variant="subtle" aria-label="Sair" onClick={onLogout}><IconLogout size={18} /></ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" bg="cbmrn.7">
        <Text c="white" fw={700} mb="md">Escalas CBMRN</Text>
        <NavLink component={Link} to="/painel" label="Painel" c="white" leftSection={<IconLayoutDashboard size={18} />} />
        <NavLink label="Escala" c="white" leftSection={<IconCalendar size={18} />} defaultOpened>
          <NavLink component={Link} to="/escalas" label="Listar" c="white" />
          <NavLink component={Link} to="/escalas/nova" label="Nova Escala" c="white" />
        </NavLink>
        <NavLink label="Validação" c="white" leftSection={<IconShieldCheck size={18} />} disabled />
      </AppShell.Navbar>
      <AppShell.Main>{children ?? <Outlet />}</AppShell.Main>
    </AppShell>
  );
}
