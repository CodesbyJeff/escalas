// apps/mobile/src/features/CalendarioServicos.tsx
import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { agruparPorDia, markedDates } from '../lib/datas';
import { ListaServicos } from './ListaServicos';

export function CalendarioServicos({ servicos }: { servicos: MeuServicoDTO[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const grupos = useMemo(() => agruparPorDia(servicos), [servicos]);
  const marks = useMemo(() => {
    const m: Record<string, any> = markedDates(servicos);
    if (sel) m[sel] = { ...(m[sel] ?? {}), selected: true, selectedColor: '#b3001b' };
    return m;
  }, [servicos, sel]);
  return (
    <View style={{ gap: 12 }}>
      <Calendar markedDates={marks} onDayPress={(d) => setSel(d.dateString)} theme={{ todayTextColor: '#b3001b' }} />
      {sel && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>{sel}</Text>
          <ListaServicos servicos={grupos[sel] ?? []} />
        </View>
      )}
    </View>
  );
}
