import { Calendar } from '@mantine/dates';
import dayjs from 'dayjs';

export function SeletorDeDia({ mes, ano, onSelecionar }: {
  mes: number; ano: number; onSelecionar: (dataIso: string) => void;
}) {
  const base = new Date(ano, mes - 1, 1);
  return (
    <Calendar
      defaultDate={base}
      getDayProps={(date) => ({
        onClick: () => onSelecionar(dayjs(date).format('YYYY-MM-DD')),
      })}
    />
  );
}
