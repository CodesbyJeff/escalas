import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { navFlags, AppShellNav } from './AppShell';

it('mostra os itens de navegação do escalante', () => {
  renderWithProviders(<AppShellNav nome="ST Paiva" papel="Escalante" canExecutar={false} canValidar={false} onLogout={vi.fn()} />);
  expect(screen.getByText('Painel')).toBeInTheDocument();
  expect(screen.getByText('Escala')).toBeInTheDocument();
  expect(screen.getByText('ST Paiva')).toBeInTheDocument();
});

describe('navFlags', () => {
  it('super-admin vê execução e validação', () => {
    expect(navFlags({ is_super_admin: true, roles: [] } as any)).toEqual({ canExecutar: true, canValidar: true });
  });
  it('FISCAL vê execução; GESTOR vê validação', () => {
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'FISCAL', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: true, canValidar: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'GESTOR', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: true });
  });
  it('usuário sem papéis não vê nenhum', () => {
    expect(navFlags({ is_super_admin: false, roles: [] } as any)).toEqual({ canExecutar: false, canValidar: false });
  });
});

describe('AppShellNav gating', () => {
  it('mostra Execução/Validação quando habilitados', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="Administrador" canExecutar canValidar onLogout={() => {}} />,
    );
    expect(screen.getByText('Execução')).toBeInTheDocument();
    expect(screen.getByText('Validação')).toBeInTheDocument();
  });
  it('esconde Execução quando desabilitada', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} onLogout={() => {}} />,
    );
    expect(screen.queryByText('Execução')).not.toBeInTheDocument();
  });
  it('mostra "Aprovação de Escalas" quando canValidar', () => {
    renderWithProviders(<AppShellNav nome="A" papel="Administrador" canExecutar={false} canValidar onLogout={() => {}} />);
    expect(screen.getByText('Aprovação de Escalas')).toBeInTheDocument();
  });
  it('esconde "Aprovação de Escalas" quando não canValidar', () => {
    renderWithProviders(<AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} onLogout={() => {}} />);
    expect(screen.queryByText('Aprovação de Escalas')).not.toBeInTheDocument();
  });
});
