import { mapRolesToLotacoes } from './useLotacoesDoUsuario';
import type { AuthUser } from '@escalas/shared-types';

it('mapeia roles ESCALANTE com lotacao_id para {value, label}', () => {
  const roles: AuthUser['roles'] = [
    { role: 'ESCALANTE', lotacao_id: 10 },
    { role: 'ESCALANTE', lotacao_id: 20 },
    { role: 'MILITAR', lotacao_id: 30 },
    { role: 'GESTOR', lotacao_id: null },
  ];
  const result = mapRolesToLotacoes(roles);
  expect(result).toEqual([
    { value: '10', label: 'Lotação #10' },
    { value: '20', label: 'Lotação #20' },
  ]);
});

it('ignora roles ESCALANTE sem lotacao_id', () => {
  const roles: AuthUser['roles'] = [
    { role: 'ESCALANTE', lotacao_id: null },
  ];
  const result = mapRolesToLotacoes(roles);
  expect(result).toEqual([]);
});

it('deduplica lotacao_id repetido', () => {
  const roles: AuthUser['roles'] = [
    { role: 'ESCALANTE', lotacao_id: 10 },
    { role: 'ESCALANTE', lotacao_id: 10 },
  ];
  const result = mapRolesToLotacoes(roles);
  expect(result).toHaveLength(1);
});
