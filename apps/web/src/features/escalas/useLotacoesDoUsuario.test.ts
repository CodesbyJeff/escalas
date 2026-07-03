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

it('usa o nome real da lotação quando o mapa id→nome é fornecido', () => {
  const roles: AuthUser['roles'] = [
    { role: 'ESCALANTE', lotacao_id: 132 },
    { role: 'ESCALANTE', lotacao_id: 174 },
  ];
  const result = mapRolesToLotacoes(roles, { 132: 'GBSA', 174: '1º SGB/1º GBM (NATAL)' });
  expect(result).toEqual([
    { value: '132', label: 'GBSA' },
    { value: '174', label: '1º SGB/1º GBM (NATAL)' },
  ]);
});

it('cai para "Lotação #<id>" quando o nome não está no mapa', () => {
  const roles: AuthUser['roles'] = [{ role: 'ESCALANTE', lotacao_id: 99 }];
  const result = mapRolesToLotacoes(roles, { 132: 'GBSA' });
  expect(result).toEqual([{ value: '99', label: 'Lotação #99' }]);
});
