import { AppShell, Burger, Group, NavLink, Text, ActionIcon, Avatar } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconCalendar, IconShieldCheck, IconClipboardCheck, IconLogout, IconGavel, IconTemplate, IconUserCheck } from '@tabler/icons-react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';
import { ColorSchemeToggle } from './ui';
import classes from './AppShell.module.css';

export function navFlags(user: AuthUser | null): { canExecutar: boolean; canValidar: boolean; canLayouts: boolean; sa: boolean } {
  const roles = user?.roles ?? [];
  const sa = user?.is_super_admin ?? false;
  return {
    canExecutar: sa || roles.some((r) => r.role === 'FISCAL'),
    canValidar: sa || roles.some((r) => r.role === 'GESTOR'),
    canLayouts: sa || roles.some((r) => r.role === 'ESCALANTE'),
    sa,
  };
}

export function AppShellNav({ nome, papel, canExecutar, canValidar, canLayouts, sa, onLogout, children }: {
  nome: string; papel: string; canExecutar: boolean; canValidar: boolean; canLayouts: boolean; sa?: boolean; onLogout: () => void; children?: ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ativo = (rota: string) => pathname === rota || pathname.startsWith(`${rota}/`);

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text className={classes.marca} size="sm">Escalas CBMRN</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorSchemeToggle />
            <Avatar color="cbmrn" radius="xl" size={32}>{nome.charAt(0)}</Avatar>
            <div>
              <Text size="sm" fw={600} lh={1.2}>{nome}</Text>
              <Text size="xs" c="dimmed" lh={1.2}>{papel}</Text>
            </div>
            <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={onLogout}>
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" className={classes.navbar}>
        <NavLink className={classes.link} component={Link} to="/painel" label="Painel"
          active={ativo('/painel')} leftSection={<IconLayoutDashboard size={18} />} />
        <NavLink label="Escala" leftSection={<IconCalendar size={18} />} defaultOpened>
          <NavLink className={classes.link} component={Link} to="/escalas" label="Listar" active={ativo('/escalas')} />
          <NavLink className={classes.link} component={Link} to="/escalas/nova" label="Nova Escala" active={ativo('/escalas/nova')} />
          {canLayouts && (
            <NavLink className={classes.link} component={Link} to="/layouts" label="Layouts"
              active={ativo('/layouts')} leftSection={<IconTemplate size={16} />} />
          )}
        </NavLink>
        {canExecutar && (
          <NavLink className={classes.link} component={Link} to="/execucao" label="Execução"
            active={ativo('/execucao')} leftSection={<IconClipboardCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink className={classes.link} component={Link} to="/validacao" label="Validação"
            active={ativo('/validacao')} leftSection={<IconShieldCheck size={18} />} />
        )}
        {canValidar && (
          <NavLink className={classes.link} component={Link} to="/aprovacao" label="Aprovação de Escalas"
            active={ativo('/aprovacao')} leftSection={<IconGavel size={18} />} />
        )}
        {sa && (
          <NavLink className={classes.link} component={Link} to="/funcao-patentes" label="Elegibilidade (Funções)"
            active={ativo('/funcao-patentes')} leftSection={<IconUserCheck size={18} />} />
        )}
      </AppShell.Navbar>

      <AppShell.Main>{children ?? <Outlet />}</AppShell.Main>
    </AppShell>
  );
}
