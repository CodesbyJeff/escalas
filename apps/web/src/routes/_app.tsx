import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Center, Loader } from '@mantine/core';
import { getToken } from '../lib/auth/storage';
import { useAuth } from '../lib/auth/AuthContext';
import { AppShellNav, navFlags } from '../components/AppShell';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => { if (!getToken()) throw redirect({ to: '/login' }); },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  if (loading) return <Center mih="100vh"><Loader /></Center>;
  const papel = user?.is_super_admin ? 'Administrador' : 'Operador';
  const { canExecutar, canValidar, canLayouts } = navFlags(user);
  return (
    <AppShellNav
      nome={user?.nome ?? ''}
      papel={papel}
      canExecutar={canExecutar}
      canValidar={canValidar}
      canLayouts={canLayouts}
      onLogout={() => { logout(); navigate({ to: '/login' }); }}
    />
  );
}
