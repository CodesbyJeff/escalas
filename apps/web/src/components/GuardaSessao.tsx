import { useEffect, useRef, type ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '../lib/auth/AuthContext';

// Ter token no storage não é estar autenticado — token expirado também é uma string.
// A autenticação só está confirmada quando o boot do AuthContext devolve um usuário;
// até lá nada de conteúdo protegido, e sem usuário sinaliza anônimo (quem chama decide
// para onde mandar). Sem isso o shell renderiza logado para sessão morta.
export function GuardaSessao({ children, onAnonimo }: { children: ReactNode; onAnonimo: () => void }) {
  const { user, loading } = useAuth();
  const jaSinalizou = useRef(false);

  useEffect(() => {
    if (loading || user || jaSinalizou.current) return;
    jaSinalizou.current = true;
    onAnonimo();
  }, [loading, user, onAnonimo]);

  if (loading) return <Center mih="100vh"><Loader /></Center>;
  if (!user) return null;
  return <>{children}</>;
}
