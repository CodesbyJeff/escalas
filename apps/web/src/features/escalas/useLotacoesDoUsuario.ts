import type { AuthUser } from '@escalas/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/AuthContext';
import { lotacoesApi } from '../../lib/api/lotacoes';

// Mapeia os papéis ESCALANTE do usuário para opções de <Select>. Quando um mapa
// id→nome é fornecido, usa o nome real da lotação como label; senão cai para
// "Lotação #<id>" (fallback enquanto a lista de lotações não carregou).
export function mapRolesToLotacoes(
  roles: AuthUser['roles'],
  nomesById?: Record<number, string>,
): { value: string; label: string }[] {
  const seen = new Set<number>();
  const result: { value: string; label: string }[] = [];
  for (const r of roles) {
    if (r.role === 'ESCALANTE' && r.lotacao_id !== null && !seen.has(r.lotacao_id)) {
      seen.add(r.lotacao_id);
      result.push({ value: String(r.lotacao_id), label: nomesById?.[r.lotacao_id] ?? `Lotação #${r.lotacao_id}` });
    }
  }
  return result;
}

export function useLotacoesDoUsuario(): { value: string; label: string }[] {
  const { user } = useAuth();
  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: () => lotacoesApi.listar() });
  if (!user) return [];
  const nomesById = Object.fromEntries(lotacoes.map((l) => [l.id, l.nome] as const));
  return mapRolesToLotacoes(user.roles, nomesById);
}
