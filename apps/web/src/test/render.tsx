import { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { RouterContextProvider, createRouter, createRootRoute, createMemoryHistory } from '@tanstack/react-router';
import { theme } from '../theme';

function createTestRouter(initialPath: string) {
  const rootRoute = createRootRoute();
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

export function renderWithProviders(ui: ReactNode, options?: { initialPath?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter(options?.initialPath ?? '/');
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={theme} env="test">
        <Notifications />
        <RouterContextProvider router={router as any}>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </RouterContextProvider>
      </MantineProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
