// apps/mobile/app/(tabs)/calendario.tsx
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { MeuServicoDTO } from '@escalas/shared-types';
import { servicosApi } from '../../src/api/servicos';
import { CalendarioServicos } from '../../src/features/CalendarioServicos';

const hoje = () => new Date().toISOString().slice(0, 10);
function maisUmAno(ymd: string) { const d = new Date(`${ymd}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 365); return d.toISOString().slice(0, 10); }

export default function CalendarioScreen() {
  const [servicos, setServicos] = useState<MeuServicoDTO[]>([]);
  useEffect(() => { servicosApi.meus(hoje(), maisUmAno(hoje())).then(setServicos).catch(() => setServicos([])); }, []);
  return <ScrollView contentContainerStyle={{ paddingVertical: 12 }}><CalendarioServicos servicos={servicos} /></ScrollView>;
}
