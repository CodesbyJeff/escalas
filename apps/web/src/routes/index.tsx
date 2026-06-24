import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeLoad: () => { throw redirect({ to: '/painel' as any }); },
});
