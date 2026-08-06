import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { getToken } from '../lib/auth/storage';
import { useAuth } from '../lib/auth/AuthContext';
import { AppShellNav, navFlags } from '../components/AppShell';
import { GuardaSessao } from '../components/GuardaSessao';

export const Route = createFileRoute('/_app')({
  // atalho barato para quem nunca logou; a validação de verdade é a GuardaSessao,
  // porque aqui só dá para ver se existe token, não se ele ainda vale.
  beforeLoad: () => { if (!getToken()) throw redirect({ to: '/login' }); },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const irParaLogin = useCallback(() => { void navigate({ to: '/login' }); }, [navigate]);
  return (
    <GuardaSessao onAnonimo={irParaLogin}>
      <ShellAutenticado />
    </GuardaSessao>
  );
}

function ShellAutenticado() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { canExecutar, canValidar, canLayouts, sa } = navFlags(user);
  return (
    <AppShellNav
      nome={user?.nome ?? ''}
      papel={user?.is_super_admin ? 'Administrador' : 'Operador'}
      canExecutar={canExecutar}
      canValidar={canValidar}
      canLayouts={canLayouts}
      sa={sa}
      onLogout={() => { logout(); void navigate({ to: '/login' }); }}
    />
  );
}
