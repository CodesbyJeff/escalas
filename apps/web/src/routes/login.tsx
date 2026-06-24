import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoginForm } from '../features/auth/LoginForm';
import { useAuth } from '../lib/auth/AuthContext';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  return <LoginForm onSubmit={async (v) => { await login(v); await navigate({ to: '/painel' as any }); }} />;
}
