import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader } from '@mantine/core';
import dayjs from 'dayjs';
import { escalasApi } from '../../lib/api/escalas';
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
  if (isLoading) return <Loader />;
  return <PainelView nome={user?.nome ?? ''} dia={dia ?? null} />;
}
