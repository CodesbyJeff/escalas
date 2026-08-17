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
    expect(navFlags({ is_super_admin: true, roles: [] } as any)).toEqual({ canExecutar: true, canValidar: true, canLayouts: true, sa: true });
  });
  it('FISCAL vê execução; GESTOR vê validação; ESCALANTE vê layouts', () => {
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'FISCAL', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: true, canValidar: false, canLayouts: false, sa: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'GESTOR', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: true, canLayouts: false, sa: false });
    expect(navFlags({ is_super_admin: false, roles: [{ role: 'ESCALANTE', lotacao_id: 1 }] } as any)).toEqual({ canExecutar: false, canValidar: false, canLayouts: true, sa: false });
  });
  it('usuário sem papéis não vê nenhum', () => {
    expect(navFlags({ is_super_admin: false, roles: [] } as any)).toEqual({ canExecutar: false, canValidar: false, canLayouts: false, sa: false });
  });
});

describe('AppShellNav — item de super-admin', () => {
  it('mostra "Elegibilidade (Funções)" quando sa', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="Administrador" canExecutar canValidar canLayouts sa onLogout={() => {}} />,
    );
    expect(screen.getByText('Elegibilidade (Funções)')).toBeInTheDocument();
  });
  it('esconde "Elegibilidade (Funções)" quando não sa', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} sa={false} onLogout={() => {}} />,
    );
    expect(screen.queryByText('Elegibilidade (Funções)')).not.toBeInTheDocument();
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

describe('AppShellNav — cromo', () => {
  it('a navbar não é mais um bloco vermelho sólido', () => {
    const { container } = renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    const navbar = container.querySelector('.mantine-AppShell-navbar');
    expect(navbar?.className).not.toContain('cbmrn');
  });

  it('tem alternador de tema no cabeçalho', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /tema/i })).toBeInTheDocument();
  });

  it('mostra a marca no cabeçalho', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
    );
    expect(screen.getAllByText('Escalas CBMRN').length).toBeGreaterThan(0);
  });

  it('marca o item de rota ativa com aria-current="page" e deixa os demais sem o atributo', () => {
    renderWithProviders(
      <AppShellNav nome="A" papel="x" canExecutar={false} canValidar={false} canLayouts={false} onLogout={() => {}} />,
      { initialPath: '/painel' },
    );
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Listar' })).not.toHaveAttribute('aria-current');
  });
});
