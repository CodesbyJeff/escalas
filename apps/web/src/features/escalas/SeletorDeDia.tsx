import { Calendar } from '@mantine/dates';
import dayjs from 'dayjs';
import type { EscalaMesDiaDTO } from '@escalas/shared-types';
import { COBERTURA } from '../../theme/semantic';

export function corCobertura(d?: EscalaMesDiaDTO): 'verde' | 'amarelo' | null {
  if (!d || d.vagas_total === 0) return null;
  if (d.vagas_preenchidas >= d.vagas_total) return 'verde';
  return 'amarelo';
}

const FUNDO: Record<'verde' | 'amarelo', string> = {
  verde: `var(--mantine-color-${COBERTURA.completa.color}-1)`,
  amarelo: `var(--mantine-color-${COBERTURA.parcial.color}-1)`,
};

export function SeletorDeDia({ mes, ano, onSelecionar, dias }: {
  mes: number; ano: number; onSelecionar: (dataIso: string) => void; dias?: EscalaMesDiaDTO[];
}) {
  const base = new Date(ano, mes - 1, 1);
  const diasMap = new Map<string, EscalaMesDiaDTO>((dias ?? []).map((d) => [d.data, d]));
  return (
    <Calendar
      defaultDate={base}
      getDayProps={(date) => {
        const key = dayjs(date).format('YYYY-MM-DD');
        const cor = corCobertura(diasMap.get(key));
        return {
          onClick: () => onSelecionar(key),
          style: cor ? { backgroundColor: FUNDO[cor] } : {},
          // Cor não pode ser o único indicador (critério do spec).
          'aria-label': cor
            ? `${key} — ${cor === 'verde' ? COBERTURA.completa.label : COBERTURA.parcial.label}`
            : key,
        };
      }}
    />
  );
}
