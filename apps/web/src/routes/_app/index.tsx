import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeLoad: () => { throw redirect({ to: '/painel' as any }); },
});
