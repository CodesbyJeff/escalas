import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { navFlags, AppShellNav } from './AppShell';

it('mostra os itens de navegação do escalante', () => {
  renderWithProviders(<AppShellNav nome="ST Paiva" papel="Escalante" canExecutar={false} canValidar={false} canLayouts={false} onLogout={vi.fn()} />);
  expect(screen.getByText('Painel')).toBeInTheDocument();
  expect(screen.getByText('Escala')).toBeInTheDocument();
  expect(screen.getByText('ST Paiva')).toBeInTheDocument();
});

describe('navFlags', () => {
  it('super-admin vê execução, validação e layouts', () => {
    expect(navFlags({ is_super_admin: true, roles: [] } as any)).toEqual({ canExecutar: true, canValidar: true, canLayouts: true });
  });
  it('FISCAL vê execução; GESTOR vê validação; ESCALANTE vê layouts', () => {
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'FISCAL', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: true, canValidar: false, canLayouts: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'GESTOR', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: true, canLayouts: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'ESCALANTE', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: false, canLayouts: true });
  });
  it('usuário sem papéis não vê nenhum', () => {
    expect(navFlags({ is_super_admin: false, roles: [] } as any)).toEqual({ canExecutar: false, canValidar: false, canLayouts: false });
  });
});

describe('AppShellNav gating', () => {
  it('mostra Execução/Validação quando habilitados', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="Administrador" canExecutar canValidar canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.getByText('Execução')).toBeInTheDocument();
    expect(screen.getByText('Validação')).toBeInTheDocument();
  });
  it('esconde Execução quando desabilitada', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.queryByText('Execução')).not.toBeInTheDocument();
  });
  it('mostra "Aprovação de Escalas" quando canValidar', () => {
    renderWithProviders(<AppShellNav nome="A" papel="Administrador" canExecutar={false} canValidar canLayouts={false} onLogout={() => {}} />);
    expect(screen.getByText('Aprovação de Escalas')).toBeInTheDocument();
  });
  it('esconde "Aprovação de Escalas" quando não canValidar', () => {
    renderWithProviders(<AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />);
    expect(screen.queryByText('Aprovação de Escalas')).not.toBeInTheDocument();
  });
  it('mostra "Layouts" quando canLayouts', () => {
    renderWithProviders(<AppShellNav nome="A" papel="Escalante" canExecutar={false} canValidar={false} canLayouts onLogout={() => {}} />);
    expect(screen.getByText('Layouts')).toBeInTheDocument();
  });
  it('esconde "Layouts" quando não canLayouts', () => {
    renderWithProviders(<AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />);
    expect(screen.queryByText('Layouts')).not.toBeInTheDocument();
  });
});
