import { Calendar } from '@mantine/dates';
import dayjs from 'dayjs';
import type { EscalaMesDiaDTO } from '@escalas/shared-types';

export function corCobertura(d?: EscalaMesDiaDTO): 'verde' | 'amarelo' | null {
  if (!d || d.vagas_total === 0) return null;
  if (d.vagas_preenchidas >= d.vagas_total) return 'verde';
  return 'amarelo';
}

export function SeletorDeDia({ mes, ano, onSelecionar, dias }: {
  mes: number; ano: number; onSelecionar: (dataIso: string) => void; dias?: EscalaMesDiaDTO[];
}) {
  const base = new Date(ano, mes - 1, 1);
  const diasMap = new Map<string, EscalaMesDiaDTO>(
    (dias ?? []).map((d) => [d.data, d])
  );
  return (
    <Calendar
      defaultDate={base}
      getDayProps={(date) => {
        const key = dayjs(date).format('YYYY-MM-DD');
        const cor = corCobertura(diasMap.get(key));
        return {
          onClick: () => onSelecionar(key),
          style: cor === 'verde'
            ? { backgroundColor: 'var(--mantine-color-green-2)' }
            : cor === 'amarelo'
            ? { backgroundColor: 'var(--mantine-color-yellow-2)' }
            : {},
        };
      }}
    />
  );
}
