// apps/mobile/app/(tabs)/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, RefreshControl, View } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { servicosApi } from '../../src/api/servicos';
import { proximoServico, proximos7Dias } from '../../src/lib/datas';
import { ProximoServicoCard } from '../../src/features/ProximoServicoCard';
import { ListaServicos } from '../../src/features/ListaServicos';

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const [servicos, setServicos] = useState<MeuServicoDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const carregar = useCallback(async () => {
    setRefreshing(true);
    try { setServicos(await servicosApi.meus(hoje())); } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const h = hoje();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={carregar} />}>
      <ProximoServicoCard servico={proximoServico(servicos, h)} />
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700' }}>Próximos 7 dias</Text>
        <ListaServicos servicos={proximos7Dias(servicos, h)} />
      </View>
    </ScrollView>
  );
}
