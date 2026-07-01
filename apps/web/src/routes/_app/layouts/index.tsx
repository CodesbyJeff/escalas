import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { layoutsApi } from '../../../lib/api/layouts';
import { useLotacoesDoUsuario } from '../../../features/escalas/useLotacoesDoUsuario';
import { useLayoutDraft } from '../../../features/layouts/useLayoutDraft';
import { LayoutEditor } from '../../../features/layouts/LayoutEditor';
import { ApiError } from '../../../lib/api/client';

export const Route = createFileRoute('/_app/layouts/')({ component: LayoutsPage });

export function LayoutsView({ lotacoes }: { lotacoes: { value: string; label: string }[] }) {
  const [lotacaoId, setLotacaoId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | 'novo' | null>(null);
  const qc = useQueryClient();
  const { data: layouts = [] } = useQuery({ queryKey: ['layouts', lotacaoId], queryFn: () => layoutsApi.listar(lotacaoId!), enabled: !!lotacaoId });

  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Layouts de Escala</Title>
      <Select label="Lotação" placeholder="Selecione..." data={lotacoes}
        value={lotacaoId ? String(lotacaoId) : null} onChange={(v) => { setLotacaoId(v ? Number(v) : null); setEditId(null); }} w={320} />
      {lotacaoId && editId === null && (
        <Stack>
          <Group justify="space-between"><Text fw={600}>Layouts da lotação</Text>
            <Button onClick={() => setEditId('novo')}>Novo Layout</Button></Group>
          {layouts.length === 0 ? <Text c="dimmed">Nenhum layout. Crie o primeiro.</Text> : (
            <Table striped>
              <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Guarnições</Table.Th><Table.Th>Ações</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{layouts.map((l) => (
                <Table.Tr key={l.id}><Table.Td>{l.nome}</Table.Td><Table.Td>{l.qtd_guarnicoes}</Table.Td>
                  <Table.Td><Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => setEditId(l.id)}>Editar</Button>
                    <Button size="xs" variant="subtle" color="red" onClick={async () => { await layoutsApi.excluir(l.id); qc.invalidateQueries({ queryKey: ['layouts', lotacaoId] }); }}>Excluir</Button>
                  </Group></Table.Td></Table.Tr>))}</Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
      {lotacaoId && editId !== null && (
        <LayoutForm key={String(editId)} lotacaoId={lotacaoId} editId={editId} onDone={() => { setEditId(null); qc.invalidateQueries({ queryKey: ['layouts', lotacaoId] }); }} />
      )}
    </Stack>
  );
}

export function LayoutsPage() {
  const lotacoes = useLotacoesDoUsuario();
  return <LayoutsView lotacoes={lotacoes} />;
}

function LayoutForm({ lotacaoId, editId, onDone }: { lotacaoId: number; editId: number | 'novo'; onDone: () => void }) {
  const { data: existente } = useQuery({ queryKey: ['layout', editId], queryFn: () => layoutsApi.obter(editId as number), enabled: editId !== 'novo' });
  const draft = useLayoutDraft(existente ? { nome: existente.nome, guarnicoes: existente.guarnicoes.map((g) => ({ sigla: g.sigla, atividade: g.atividade, turno_padrao_inicio: g.turno_padrao_inicio, turno_padrao_fim: g.turno_padrao_fim, ordem: g.ordem, vagas_sugeridas: g.vagas_sugeridas.map((v) => ({ funcao: v.funcao, quantidade_sugerida: v.quantidade_sugerida })) })) } : undefined);
  const salvar = useMutation({
    mutationFn: () => editId === 'novo' ? layoutsApi.criar(lotacaoId, draft.toPayload()) : layoutsApi.atualizar(editId, draft.toPayload()),
    onSuccess: () => { notifications.show({ message: 'Layout salvo.' }); onDone(); },
    onError: (e) => notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro ao salvar' }),
  });
  return <LayoutEditor draft={draft} onSalvar={() => salvar.mutate()} salvando={salvar.isPending} />;
}
