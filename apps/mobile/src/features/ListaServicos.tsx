// apps/mobile/src/features/ListaServicos.tsx
import { View, Text } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
export function ListaServicos({ servicos }: { servicos: MeuServicoDTO[] }) {
  if (servicos.length === 0) return <Text style={{ color: '#777', paddingVertical: 12 }}>Nenhum serviço nos próximos dias.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {servicos.map((s) => (
        <View key={s.vaga_id} style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12 }}>
          <Text style={{ fontWeight: '600' }}>{s.data} · {s.turno_inicio}–{s.turno_fim}</Text>
          <Text>{s.guarnicao.sigla} — {s.funcao}</Text>
        </View>
      ))}
    </View>
  );
}
