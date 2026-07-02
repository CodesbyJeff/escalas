import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SegmentedControl,
  Select,
  Stack,
  Table,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  MultiSelect,
  ActionIcon,
  Card,
} from '@mantine/core';
import { IconTrash, IconPencil, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { PatenteDTO, FuncaoPatenteDTO } from '@escalas/shared-types';
import { patentesApi } from '../../lib/api/patentes';
import { lotacoesApi } from '../../lib/api/lotacoes';
import { funcaoPatentesApi } from '../../lib/api/funcaoPatentes';
import { ApiError } from '../../lib/api/client';

type Escopo = 'global' | 'lotacao';

function patentesParaMultiSelect(patentes: PatenteDTO[]) {
  const grupos = new Map<number, { group: string; items: { value: string; label: string }[] }>();
  for (const p of [...patentes].sort((a, b) => a.ordem - b.ordem)) {
    if (!grupos.has(p.forca_id)) grupos.set(p.forca_id, { group: `Força ${p.forca_id}`, items: [] });
    grupos.get(p.forca_id)!.items.push({ value: String(p.id), label: `${p.sigla} — ${p.nome}` });
  }
  return Array.from(grupos.values());
}

export function CatalogoFuncoes() {
  const [escopo, setEscopo] = useState<Escopo>('global');
  const [lotacaoSelId, setLotacaoSelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [funcao, setFuncao] = useState('');
  const [patenteIds, setPatenteIds] = useState<string[]>([]);
  const qc = useQueryClient();

  const lotacaoId = escopo === 'lotacao' && lotacaoSelId ? Number(lotacaoSelId) : undefined;
  const podeListar = escopo === 'global' || lotacaoId !== undefined;

  const { data: patentes = [] } = useQuery({ queryKey: ['patentes'], queryFn: patentesApi.listar });
  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: lotacoesApi.listar });
  const { data: regras = [] } = useQuery({
    queryKey: ['funcao-patentes', escopo, lotacaoId],
    queryFn: () => funcaoPatentesApi.listar(lotacaoId),
    enabled: podeListar,
  });

  const patentesData = patentesParaMultiSelect(patentes);
  const siglaDe = (id: number) => patentes.find((p) => p.id === id)?.sigla ?? String(id);
  const lotacoesData = lotacoes.map((l) => ({ value: String(l.id), label: `${l.sigla} — ${l.nome}` }));

  function resetForm() {
    setEditId(null);
    setFuncao('');
    setPatenteIds([]);
  }

  function editar(regra: FuncaoPatenteDTO) {
    setEditId(regra.id);
    setFuncao(regra.funcao_norm);
    setPatenteIds(regra.patente_ids.map(String));
  }

  const salvar = useMutation({
    mutationFn: () =>
      editId === null
        ? funcaoPatentesApi.criar({ lotacao_id: lotacaoId ?? null, funcao, patente_ids: patenteIds.map(Number) })
        : funcaoPatentesApi.atualizar(editId, { patente_ids: patenteIds.map(Number) }),
    onSuccess: () => {
      notifications.show({ message: editId === null ? 'Regra criada.' : 'Regra atualizada.' });
      resetForm();
      qc.invalidateQueries({ queryKey: ['funcao-patentes', escopo, lotacaoId] });
    },
    onError: (e) => notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro ao salvar.' }),
  });

  const excluir = useMutation({
    mutationFn: (id: number) => funcaoPatentesApi.excluir(id),
    onSuccess: () => {
      notifications.show({ message: 'Regra removida.' });
      qc.invalidateQueries({ queryKey: ['funcao-patentes', escopo, lotacaoId] });
    },
    onError: (e) => notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro ao excluir.' }),
  });

  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Elegibilidade por Função</Title>
      <Group align="flex-end">
        <SegmentedControl
          value={escopo}
          onChange={(v) => {
            setEscopo(v as Escopo);
            setLotacaoSelId(null);
            resetForm();
          }}
          data={[
            { label: 'Global', value: 'global' },
            { label: 'Lotação', value: 'lotacao' },
          ]}
        />
        {escopo === 'lotacao' && (
          <Select
            label="Lotação"
            placeholder="Selecione..."
            data={lotacoesData}
            value={lotacaoSelId}
            onChange={(v) => {
              setLotacaoSelId(v);
              resetForm();
            }}
            w={280}
          />
        )}
      </Group>

      {podeListar && (
        <>
          {regras.length === 0 ? (
            <Text c="dimmed">Nenhuma regra cadastrada neste escopo.</Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Função</Table.Th>
                  <Table.Th>Patentes</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {regras.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{r.funcao_norm}</Table.Td>
                    <Table.Td>{r.patente_ids.map(siglaDe).join(', ')}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon variant="light" aria-label="Editar" onClick={() => editar(r)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" aria-label="Excluir" onClick={() => excluir.mutate(r.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          <Card withBorder>
            <Group align="flex-end">
              <TextInput
                label="Função"
                placeholder="Ex.: Comandante"
                value={funcao}
                onChange={(e) => setFuncao(e.currentTarget.value)}
                disabled={editId !== null}
                w={220}
              />
              <MultiSelect
                label="Patentes elegíveis"
                placeholder="Selecione..."
                data={patentesData}
                value={patenteIds}
                onChange={setPatenteIds}
                searchable
                w={360}
              />
              <Button onClick={() => salvar.mutate()} loading={salvar.isPending} disabled={!funcao.trim()}>
                {editId === null ? 'Adicionar Regra' : 'Salvar Alterações'}
              </Button>
              {editId !== null && (
                <ActionIcon variant="subtle" aria-label="Cancelar edição" onClick={resetForm}>
                  <IconX size={18} />
                </ActionIcon>
              )}
            </Group>
          </Card>
        </>
      )}
    </Stack>
  );
}
