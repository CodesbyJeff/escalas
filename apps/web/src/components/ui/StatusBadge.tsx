import { Badge, useComputedColorScheme } from '@mantine/core';
import { STATUS_ESCALA, tokenCor, type StatusEscala } from '../../theme/semantic';

/**
 * Único lugar do sistema que sabe que `em_validacao` se escreve
 * "Em validação" e é âmbar.
 */
export function StatusBadge({ status }: { status: StatusEscala }) {
  const esquema = useComputedColorScheme('light');
  const token = STATUS_ESCALA[status];
  return <Badge color={tokenCor(token, esquema)}>{token.label}</Badge>;
}
