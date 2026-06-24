import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Loader, Paper, SimpleGrid, Stack, Title, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { EscalaDiaDTO } from '@escalas/shared-types';
import { putDiaSchema } from '@escalas/shared-schemas';
import { escalasApi } from '../../../lib/api/escalas';
import { useDiaDraft } from '../../../features/escalas/useDiaDraft';
import { GuarnicaoCard } from '../../../components/GuarnicaoCard';
import { ApiError } from '../../../lib/api/client';

export const Route = createFileRoute('/_app/escalas/$id/dias/$data')({ component: EditorPage });

function EditorPage() {
  const { id, data } = Route.useParams();
  return <EditorDia escalaId={Number(id)} data={data} />;
}

export function EditorDia({ escalaId, data }: { escalaId: number; data: string }) {
  const { data: dia, isLoading } = useQuery({
    queryKey: ['dia', escalaId, data], queryFn: () => escalasApi.getDia(escalaId, data),
  });
  if (isLoading || !dia) return <Loader />;
  return <EditorDiaForm key={dia.id} escalaId={escalaId} data={data} diaInicial={dia} />;
}

function EditorDiaForm({ escalaId, data, diaInicial }: { escalaId: number; data: string; diaInicial: EscalaDiaDTO }) {
  const draft = useDiaDraft(diaInicial);
  const [conflito, setConflito] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const salvar = useMutation({
    mutationFn: () => {
      const input = draft.toPutInput();
      const result = putDiaSchema.safeParse(input);
      if (!result.success) {
        const msg = result.error.issues.map(i => i.message).join('; ');
        return Promise.reject(new Error(`Campos obrigatórios inválidos: ${msg}`));
      }
      return escalasApi.putDia(escalaId, data, input);
    },
    onSuccess: () => {
      setConflito(null);
      notifications.show({ message: 'Dia salvo.' });
      queryClient.invalidateQueries({ queryKey: ['dia', escalaId, data] });
      queryClient.invalidateQueries({ queryKey: ['escala', escalaId] });
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.status === 422) setConflito(err.message);
      else if (err.status === 409) notifications.show({ color: 'red', message: 'A escala mudou. Recarregue.' });
      else notifications.show({ color: 'red', message: err.message });
    },
  });
  const publicar = useMutation({
    mutationFn: () => escalasApi.publicar(escalaId),
    onSuccess: () => {
      notifications.show({ message: 'Escala publicada.' });
      queryClient.invalidateQueries({ queryKey: ['escala', escalaId] });
      queryClient.invalidateQueries({ queryKey: ['escalas'] });
    },
    onError: (e) => notifications.show({ color: 'red', message: (e as Error).message }),
  });
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Quadro de Escala — dia {data}</Title>
        <Group>
          <Button variant="default" onClick={() => draft.addGuarnicao()}>Adicionar Guarnição</Button>
          <Button variant="default" disabled title="Em breve: duplicar de outro dia">Duplicar Dia</Button>
          <Button onClick={() => salvar.mutate()} loading={salvar.isPending}>Salvar</Button>
          <Button color="cbmrn" onClick={() => publicar.mutate()} loading={publicar.isPending}>Publicar Escala</Button>
        </Group>
      </Group>
      {conflito && <Alert color="red" title="Conflito de turno">{conflito}</Alert>}
      <Paper p="md" withBorder>
        <SimpleGrid cols={{ base: 1, md: 3 }}>
          {draft.values.guarnicoes.map((g, gi) => (
            <GuarnicaoCard
              key={gi} escalaId={escalaId} guarnicao={g} gi={gi}
              getInputProps={(path) => draft.getInputProps(path)}
              getVagaProps={(gix, vix) => draft.getInputProps(`guarnicoes.${gix}.vagas.${vix}.funcao`)}
              setMilitar={(gix, vix, mid) => draft.setFieldValue(`guarnicoes.${gix}.vagas.${vix}.militar_id`, mid)}
              onAddVaga={draft.addVaga} onRemoveVaga={draft.removeVaga} onRemove={draft.removeGuarnicao}
            />
          ))}
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

