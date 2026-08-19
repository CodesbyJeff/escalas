import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Box, Group, Stack, Text } from '@mantine/core';
import { escalasApi } from '../../../lib/api/escalas';
import { SeletorDeDia } from '../../../features/escalas/SeletorDeDia';
import { AcoesBloco } from '../../../features/escalas/AcoesBloco';
import { PreenchimentoAuto } from '../../../features/escalas/PreenchimentoAuto';
import { PageHeader, LoadingState } from '../../../components/ui';
import { COBERTURA } from '../../../theme/semantic';

export const Route = createFileRoute('/_app/escalas/$id/')({ component: DetalhePage });

function DetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: escala, isLoading } = useQuery({
    queryKey: ['escala-mes', Number(id)], queryFn: () => escalasApi.getMes(Number(id)),
  });
  const { data: escalaDetalhe } = useQuery({
    queryKey: ['escala', Number(id)], queryFn: () => escalasApi.detalhe(Number(id)),
  });
  if (isLoading || !escala) return <LoadingState variant="cards" linhas={3} />;
  return (
    <Stack>
      <PageHeader title={`Escala ${String(escala.mes).padStart(2, '0')}/${escala.ano}`} />
      <Text>Clique no dia para editar</Text>
      <SeletorDeDia
        mes={escala.mes} ano={escala.ano} dias={escala.dias}
        onSelecionar={(data) => navigate({ to: '/escalas/$id/dias/$data', params: { id, data } })}
      />
      <Group>
        <Box w={16} h={16} bg={`${COBERTURA.completa.color}.1`} style={{ borderRadius: 4 }} />
        <Text size="sm">Completo</Text>
        <Box w={16} h={16} bg={`${COBERTURA.parcial.color}.1`} style={{ borderRadius: 4 }} />
        <Text size="sm">Tem vaga aberta (DO)</Text>
      </Group>
      {escalaDetalhe && escalaDetalhe.status === 'rascunho' && (
        <AcoesBloco
          escalaId={Number(id)} lotacaoId={escalaDetalhe.lotacao_id}
          ano={escalaDetalhe.ano} mes={escalaDetalhe.mes}
        />
      )}
      {escalaDetalhe && escalaDetalhe.status === 'rascunho' && (
        <PreenchimentoAuto escalaId={Number(id)} rascunho={escalaDetalhe.status === 'rascunho'} />
      )}
    </Stack>
  );
}
