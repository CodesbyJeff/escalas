import { createRootRoute, Outlet } from '@tanstack/react-router';

export function AppTitle() {
  return <span>Escalas CBMRN</span>;
}

export const Route = createRootRoute({ component: () => <Outlet /> });
