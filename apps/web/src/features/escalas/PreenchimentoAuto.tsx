import { useState } from 'react';
import { Badge, Button, Group, NumberInput, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { PreenchimentoSugestaoDTO } from '@escalas/shared-types';
import { escalasApi } from '../../lib/api/escalas';
import { ApiError } from '../../lib/api/client';

export function PreenchimentoAuto({ escalaId, rascunho }: { escalaId: number; rascunho?: boolean }) {
  const queryClient = useQueryClient();
  const invalidarMes = () => queryClient.invalidateQueries({ queryKey: ['escala-mes', escalaId] });
  const mostrarErro = (e: unknown) =>
    notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro inesperado.' });

  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [descansoHoras, setDescansoHoras] = useState<number | string>(72);

  const body = () => ({
    data_ini: dataIni,
    data_fim: dataFim,
    descanso_horas: Number(descansoHoras),
  });

  const sugerir = useMutation({
    mutationFn: () => escalasApi.sugerirPreenchimento(escalaId, body()),
    onError: mostrarErro,
  });

  const aplicar = useMutation({
    mutationFn: () => escalasApi.aplicarPreenchimento(escalaId, body()),
    onSuccess: (result) => {
      notifications.show({
        message: `Preenchimento aplicado: ${result.vagas_preenchidas} vagas preenchidas, `
          + `${result.avisos_patente} avisos de patente, ${result.avisos_descanso} avisos de descanso.`,
      });
      invalidarMes();
    },
    onError: mostrarErro,
  });

  const disabled = !rascunho;
  const sugestoes = sugerir.data ?? [];

  return (
    <Paper p="md" withBorder>
      <Stack>
        <Title order={4}>Preenchimento Automático</Title>
        <Group align="flex-end">
          <TextInput
            label="Data Início" placeholder="YYYY-MM-DD" value={dataIni}
            onChange={(e) => setDataIni(e.currentTarget.value)} disabled={disabled}
          />
          <TextInput
            label="Data Fim" placeholder="YYYY-MM-DD" value={dataFim}
            onChange={(e) => setDataFim(e.currentTarget.value)} disabled={disabled}
          />
          <NumberInput
            label="Descanso (horas)" value={descansoHoras}
            onChange={setDescansoHoras} disabled={disabled} min={0}
          />
          <Button
            onClick={() => sugerir.mutate()} loading={sugerir.isPending} variant="default"
            disabled={disabled || !dataIni || !dataFim}
          >
            Pré-visualizar
          </Button>
          <Button
            onClick={() => aplicar.mutate()} loading={aplicar.isPending}
            disabled={disabled || !dataIni || !dataFim || sugestoes.length === 0}
          >
            Aplicar
          </Button>
        </Group>
        {sugerir.isSuccess && (
          sugestoes.length === 0 ? (
            <Text c="dimmed">Nenhuma vaga aberta no intervalo.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Dia</Table.Th>
                  <Table.Th>Guarnição</Table.Th>
                  <Table.Th>Função</Table.Th>
                  <Table.Th>Militar</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sugestoes.map((s: PreenchimentoSugestaoDTO) => (
                  <Table.Tr key={s.vaga_id}>
                    <Table.Td>{s.data}</Table.Td>
                    <Table.Td>{s.guarnicao_sigla}</Table.Td>
                    <Table.Td>{s.funcao}</Table.Td>
                    <Table.Td>{s.militar_nome ?? '—'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm">{s.motivo}</Text>
                        {s.aviso_patente && <Badge color="yellow">Patente</Badge>}
                        {s.aviso_descanso && <Badge color="yellow">Descanso</Badge>}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )
        )}
      </Stack>
    </Paper>
  );
}
