// apps/web/src/features/execucao/StatusExecucaoBadge.tsx
import { Badge } from '@mantine/core';
import type { ExecucaoStatusDTO } from '@escalas/shared-types';

const MAP: Record<ExecucaoStatusDTO, { color: string; label: string }> = {
  pendente: { color: 'gray', label: 'Pendente' },
  registrada: { color: 'blue', label: 'Aguardando validação' },
  validada: { color: 'green', label: 'Validada' },
  rejeitada: { color: 'red', label: 'Rejeitada' },
};

export function StatusExecucaoBadge({ status }: { status: ExecucaoStatusDTO }) {
  const { color, label } = MAP[status];
  return <Badge color={color}>{label}</Badge>;
}
