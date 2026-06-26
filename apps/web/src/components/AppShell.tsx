import { AppShell, Burger, Group, NavLink, Text, ActionIcon, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconCalendar, IconShieldCheck, IconClipboardCheck, IconLogout, IconGavel } from '@tabler/icons-react';
import { Link, Outlet } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';

export function navFlags(user: AuthUser | null): { canExecutar: boolean; canValidar: boolean } {
  const roles = user?.roles ?? [];
  const sa = user?.is_super_admin ?? false;
  return {
    canExecutar: sa || roles.some((r) => r.role === 'FISCAL'),
    canValidar: sa || roles.some((r) => r.role === 'GESTOR'),
  };
}

export function AppShellNav({ nome, papel, canExecutar, canValidar, onLogout, children }: {
  nome: string; papel: string; canExecutar: boolean; canValidar: boolean; onLogout: () => void; children?: ReactNode;
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
        {canExecutar && (
          <NavLink component={Link} to="/execucao" label="Execução" c="white" leftSection={<IconClipboardCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink component={Link} to="/validacao" label="Validação" c="white" leftSection={<IconShieldCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink component={Link} to="/aprovacao" label="Aprovação de Escalas" c="white" leftSection={<IconGavel size={18} />} />
        )}
      </AppShell.Navbar>
      <AppShell.Main>{children ?? <Outlet />}</AppShell.Main>
    </AppShell>
  );
}
