// apps/mobile/src/features/ProximoServicoCard.tsx
import { View, Text } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
export function ProximoServicoCard({ servico }: { servico: MeuServicoDTO | null }) {
  if (!servico) return <View style={{ padding: 16 }}><Text style={{ color: '#777' }}>Sem próximo serviço.</Text></View>;
  return (
    <View style={{ backgroundColor: '#b3001b', borderRadius: 12, padding: 16, gap: 4 }}>
      <Text style={{ color: '#fff', fontSize: 12, opacity: 0.8 }}>PRÓXIMO SERVIÇO</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{servico.data} · {servico.turno_inicio}–{servico.turno_fim}</Text>
      <Text style={{ color: '#fff' }}>{servico.guarnicao.sigla} — {servico.guarnicao.atividade}</Text>
      <Text style={{ color: '#fff' }}>{servico.funcao} · {servico.lotacao.sigla}</Text>
    </View>
  );
}
