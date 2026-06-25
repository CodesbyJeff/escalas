// apps/web/src/routes/_app/execucao/escalas/$id.dias.$data.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { ExecucaoDiaDTO } from '@escalas/shared-types';
import { putExecucaoSchema } from '@escalas/shared-schemas';
import { execucaoApi } from '../../../../lib/api/execucao';
import { militaresApi } from '../../../../lib/api/militares';
import { ApiError } from '../../../../lib/api/client';
import { useExecucaoDraft } from '../../../../features/execucao/useExecucaoDraft';
import { ExecucaoDiaView } from '../../../../features/execucao/ExecucaoDiaView';

export const Route = createFileRoute('/_app/execucao/escalas/$id/dias/$data')({ component: FiscalDiaPage });

function FiscalDiaPage() {
  const { id, data } = Route.useParams();
  return <FiscalDiaScreen escalaId={Number(id)} data={data} />;
}

export function FiscalDiaScreen({ escalaId, data }: { escalaId: number; data: string }) {
  const { data: dia, isLoading } = useQuery({
    queryKey: ['execucao', 'dia', escalaId, data], queryFn: () => execucaoApi.getDia(escalaId, data),
  });
  const { data: militares = [] } = useQuery({
    queryKey: ['militares', escalaId], queryFn: () => militaresApi.listar(escalaId),
  });
  if (isLoading || !dia) return <Loader />;
  const map = new Map<number, string>(militares.map((m) => [m.id, [m.posto, m.nome_curto ?? m.nome].filter(Boolean).join(' ')]));
  const getMilitarNome = (mid: number) => map.get(mid) ?? String(mid);
  return <FiscalDiaForm escalaId={escalaId} data={data} dia={dia} getMilitarNome={getMilitarNome} />;
}

function FiscalDiaForm({ escalaId, data, dia, getMilitarNome }: {
  escalaId: number; data: string; dia: ExecucaoDiaDTO; getMilitarNome: (id: number) => string;
}) {
  const draft = useExecucaoDraft(dia);
  const editavel = dia.execucao_status === 'pendente' || dia.execucao_status === 'rejeitada';
  const [erro, setErro] = useState<string | null>(null);
  const [confirmOpen, confirm] = useDisclosure(false);
  const qc = useQueryClient();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['execucao', 'dia', escalaId, data] });
    qc.invalidateQueries({ queryKey: ['execucao', 'pendentes', 'fiscal'] });
  };
  const tratarErro = (e: unknown) => {
    const err = e as ApiError;
    if (err.status === 422) setErro(err.message);
    else if (err.status === 409) notifications.show({ color: 'red', message: 'Dia já fechado/validado. Recarregue.' });
    else notifications.show({ color: 'red', message: err.message });
  };

  const salvar = useMutation({
    mutationFn: () => {
      const input = draft.toPutInput();
      const r = putExecucaoSchema.safeParse(input);
      if (!r.success) return Promise.reject(new Error(r.error.issues.map((i) => i.message).join('; ')));
      return execucaoApi.salvar(escalaId, data, input);
    },
    onSuccess: () => { setErro(null); notifications.show({ message: 'Execução salva.' }); invalidar(); },
    onError: (e) => { if (e instanceof ApiError) tratarErro(e); else setErro((e as Error).message); },
  });

  const fechar = useMutation({
    mutationFn: () => execucaoApi.fechar(escalaId, data),
    onSuccess: () => { confirm.close(); setErro(null); notifications.show({ message: 'Execução fechada para validação.' }); invalidar(); },
    onError: (e) => { confirm.close(); tratarErro(e); },
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Execução — {data}</Title>
        {editavel && (
          <Group>
            <Button onClick={() => salvar.mutate()} loading={salvar.isPending}>Salvar</Button>
            <Button color="cbmrn" onClick={confirm.open}>Fechar para validação</Button>
          </Group>
        )}
      </Group>
      {!editavel && dia.execucao_status !== 'registrada' && (
        <Alert color="blue">Dia validado.</Alert>
      )}
      {erro && <Alert color="red" title="Não foi possível salvar">{erro}</Alert>}
      <ExecucaoDiaView
        escalaId={escalaId}
        dia={dia}
        getMilitarNome={getMilitarNome}
        mode={editavel ? 'registrar' : 'validar'}
        getDraft={draft.getVaga}
        onChangeVaga={draft.setVaga}
      />
      <Modal opened={confirmOpen} onClose={confirm.close} title="Fechar para validação" centered>
        <Stack>
          <Text size="sm">Após fechar, o dia vai para o gestor e não poderá mais ser editado até ser validado/rejeitado. Confirmar?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>Cancelar</Button>
            <Button color="cbmrn" onClick={() => fechar.mutate()} loading={fechar.isPending}>Confirmar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
