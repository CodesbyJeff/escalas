// apps/web/src/routes/_app/validacao/escalas/$id.dias.$data.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Loader, Modal, Stack, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import type { ValidarExecucaoInput } from '@escalas/shared-schemas';
import { execucaoApi } from '../../../../lib/api/execucao';
import { militaresApi } from '../../../../lib/api/militares';
import { ApiError } from '../../../../lib/api/client';
import { ExecucaoDiaView } from '../../../../features/execucao/ExecucaoDiaView';

export const Route = createFileRoute('/_app/validacao/escalas/$id/dias/$data')({ component: GestorDiaPage });

function GestorDiaPage() {
  const { id, data } = Route.useParams();
  return <GestorDiaScreen escalaId={Number(id)} data={data} />;
}

export function GestorDiaScreen({ escalaId, data }: { escalaId: number; data: string }) {
  const { data: dia, isLoading } = useQuery({
    queryKey: ['execucao', 'dia', escalaId, data], queryFn: () => execucaoApi.getDia(escalaId, data),
  });
  const { data: militares = [] } = useQuery({
    queryKey: ['militares', escalaId], queryFn: () => militaresApi.listar(escalaId),
  });
  if (isLoading || !dia) return <Loader />;
  const map = new Map<number, string>(militares.map((m) => [m.id, [m.posto, m.nome_curto ?? m.nome].filter(Boolean).join(' ')]));
  const getMilitarNome = (mid: number) => map.get(mid) ?? String(mid);
  return <GestorDiaView escalaId={escalaId} data={data} dia={dia} getMilitarNome={getMilitarNome} />;
}

function GestorDiaView({ escalaId, data, dia, getMilitarNome }: {
  escalaId: number; data: string; dia: ExecucaoDiaDTO; getMilitarNome: (id: number) => string;
}) {
  const podeValidar = dia.execucao_status === 'registrada';
  const [rejeitarOpen, rejeitar] = useDisclosure(false);
  const [justificativa, setJustificativa] = useState('');
  const qc = useQueryClient();

  const validar = useMutation({
    mutationFn: (input: ValidarExecucaoInput) => execucaoApi.validar(escalaId, data, input),
    onSuccess: (_res, input) => {
      rejeitar.close();
      notifications.show({ message: input.status === 'validada' ? 'Execução validada.' : 'Execução rejeitada.' });
      qc.invalidateQueries({ queryKey: ['execucao', 'dia', escalaId, data] });
      qc.invalidateQueries({ queryKey: ['execucao', 'pendentes', 'gestor'] });
    },
    onError: (e) => {
      const err = e as ApiError;
      if (err.status === 409) notifications.show({ color: 'red', message: 'O dia mudou de estado. Recarregue.' });
      else notifications.show({ color: 'red', message: err.message });
    },
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Validação — {data}</Title>
        {podeValidar && (
          <Group>
            <Button color="green" onClick={() => validar.mutate({ status: 'validada' })} loading={validar.isPending}>Validar</Button>
            <Button color="red" variant="light" onClick={rejeitar.open}>Rejeitar</Button>
          </Group>
        )}
      </Group>
      {dia.execucao_status === 'validada' && <Alert color="green">Dia validado{dia.validado_em ? ` em ${dia.validado_em.slice(0, 10)}` : ''}.</Alert>}
      {dia.execucao_status === 'pendente' && <Alert color="gray">Ainda não fechado pelo fiscal.</Alert>}
      <ExecucaoDiaView escalaId={escalaId} dia={dia} getMilitarNome={getMilitarNome} mode="validar" />
      <Modal opened={rejeitarOpen} onClose={() => { rejeitar.close(); setJustificativa(''); }} title="Rejeitar execução" centered>
        <Stack>
          <Textarea
            label="Justificativa"
            placeholder="Descreva o que precisa ser corrigido"
            minRows={3}
            maxLength={500}
            value={justificativa}
            onChange={(e) => setJustificativa(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={rejeitar.close}>Cancelar</Button>
            <Button
              color="red"
              disabled={!justificativa.trim()}
              loading={validar.isPending}
              onClick={() => validar.mutate({ status: 'rejeitada', justificativa: justificativa.trim() })}
            >
              Confirmar rejeição
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
