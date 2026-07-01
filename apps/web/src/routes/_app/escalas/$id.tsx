import { createFileRoute, Outlet } from '@tanstack/react-router';

// Layout do escopo /escalas/$id — só renderiza o filho ativo:
//   /escalas/$id            → $id.index.tsx (calendário/detalhe)
//   /escalas/$id/dias/$data → $id.dias.$data.tsx (editor do dia)
export const Route = createFileRoute('/_app/escalas/$id')({ component: () => <Outlet /> });
