import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader } from '@mantine/core';
import dayjs from 'dayjs';
import { escalasApi } from '../../lib/api/escalas';
import { militaresApi } from '../../lib/api/militares';
import { useAuth } from '../../lib/auth/AuthContext';
import { PainelView } from '../../features/painel/PainelView';

export const Route = createFileRoute('/_app/painel')({ component: PainelPage });

function PainelPage() {
  const { user } = useAuth();
  const hoje = dayjs();
  const { data: escalas, isLoading } = useQuery({ queryKey: ['escalas'], queryFn: escalasApi.listar });
  const escalaDoMes = escalas?.find((e) => e.mes === hoje.month() + 1 && e.ano === hoje.year());
  const { data: dia } = useQuery({
    queryKey: ['dia', escalaDoMes?.id, hoje.format('YYYY-MM-DD')],
    queryFn: () => escalasApi.getDia(escalaDoMes!.id, hoje.format('YYYY-MM-DD')),
    enabled: !!escalaDoMes,
  });
  const { data: militares } = useQuery({
    queryKey: ['militares', escalaDoMes?.id],
    queryFn: () => militaresApi.listar(escalaDoMes!.id),
    enabled: !!escalaDoMes,
  });
  const militarMap = new Map<number, string>(
    (militares ?? []).map((m) => [m.id, [m.posto, m.nome_curto ?? m.nome].filter(Boolean).join(' ')])
  );
  const getMilitarNome = (id: number) => militarMap.get(id) ?? String(id);
  if (isLoading) return <Loader />;
  return <PainelView nome={user?.nome ?? ''} dia={dia ?? null} getMilitarNome={getMilitarNome} />;
}
