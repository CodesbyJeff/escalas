import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import { Stack, Breadcrumbs, Anchor } from '@mantine/core';
import { escalasApi } from '../../../lib/api/escalas';
import { NovaEscalaForm } from '../../../features/escalas/NovaEscalaForm';
import { useLotacoesDoUsuario } from '../../../features/escalas/useLotacoesDoUsuario';

export const Route = createFileRoute('/_app/escalas/nova')({ component: NovaPage });

function NovaPage() {
  const navigate = useNavigate();
  // MVP: lista de lotações virá de um seeder/endpoint; por ora, deriva das escalas/contexto do usuário.
  const lotacoes = useLotacoesDoUsuario();
  return (
    <Stack>
      <Breadcrumbs><Anchor href="#">Escalas CBMRN</Anchor><span>Criar Escala</span></Breadcrumbs>
      <NovaEscalaForm
        lotacoes={lotacoes}
        onSubmit={async (v) => {
          try {
            const escala = await escalasApi.criar(v);
            notifications.show({ message: 'Escala criada.' });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await navigate({ to: '/escalas/$id', params: { id: String(escala.id) } } as any);
          } catch (e) { notifications.show({ color: 'red', message: (e as Error).message }); }
        }}
      />
    </Stack>
  );
}
