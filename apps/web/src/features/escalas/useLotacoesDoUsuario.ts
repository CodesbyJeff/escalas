import type { AuthUser } from '@escalas/shared-types';
import { useAuth } from '../../lib/auth/AuthContext';

export function mapRolesToLotacoes(roles: AuthUser['roles']): { value: string; label: string }[] {
  const seen = new Set<number>();
  const result: { value: string; label: string }[] = [];
  for (const r of roles) {
    if (r.role === 'ESCALANTE' && r.lotacao_id !== null && !seen.has(r.lotacao_id)) {
      seen.add(r.lotacao_id);
      result.push({ value: String(r.lotacao_id), label: `Lotação #${r.lotacao_id}` });
    }
  }
  return result;
}

export function useLotacoesDoUsuario(): { value: string; label: string }[] {
  const { user } = useAuth();
  if (!user) return [];
  return mapRolesToLotacoes(user.roles);
}
