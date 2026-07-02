import { useState } from 'react';
import { Group, Paper, Select, Stack, Text, TextInput, Title, Button } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { escalasApi } from '../../lib/api/escalas';
import { layoutsApi } from '../../lib/api/layouts';
import { ApiError } from '../../lib/api/client';

export function AcoesBloco({ escalaId, lotacaoId, ano, mes, disabled }: {
  escalaId: number;
  lotacaoId: number;
  ano: number;
  mes: number;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: layouts = [] } = useQuery({
    queryKey: ['layouts', lotacaoId], queryFn: () => layoutsApi.listar(lotacaoId),
  });
  const layoutOptions = layouts.map((l) => ({ value: String(l.id), label: l.nome }));

  const invalidarMes = () => queryClient.invalidateQueries({ queryKey: ['escala-mes', escalaId] });
  const mostrarErro = (e: unknown) =>
    notifications.show({ color: 'red', message: e instanceof ApiError ? e.message : 'Erro inesperado.' });

  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);

  const gerarBloco = useMutation({
    mutationFn: () => escalasApi.gerarBloco(escalaId, { data_ini: dataIni, data_fim: dataFim, template_id: Number(templateId) }),
    onSuccess: (result) => {
      notifications.show({ message: `Estrutura gerada: ${result.dias_afetados} dias afetados.` });
      invalidarMes();
    },
    onError: mostrarErro,
  });

  const [cicloIni, setCicloIni] = useState('');
  const [cicloFim, setCicloFim] = useState('');
  const [ate, setAte] = useState('');

  const repetirCiclo = useMutation({
    mutationFn: () => escalasApi.repetirCiclo(escalaId, { ciclo_ini: cicloIni, ciclo_fim: cicloFim, ate }),
    onSuccess: (result) => {
      notifications.show({ message: `Ciclo repetido: ${result.dias_afetados} dias afetados.` });
      invalidarMes();
    },
    onError: mostrarErro,
  });

  return (
    <Stack>
      <Title order={4}>Ações de Bloco — {String(mes).padStart(2, '0')}/{ano}</Title>
      <Group grow align="flex-start">
        <Paper p="md" withBorder>
          <Stack>
            <Text fw={600}>Gerar estrutura no intervalo</Text>
            <TextInput
              label="Data Início" placeholder="YYYY-MM-DD" value={dataIni}
              onChange={(e) => setDataIni(e.currentTarget.value)} disabled={disabled}
            />
            <TextInput
              label="Data Fim" placeholder="YYYY-MM-DD" value={dataFim}
              onChange={(e) => setDataFim(e.currentTarget.value)} disabled={disabled}
            />
            <Select
              label="Layout" placeholder="Selecione um layout..." data={layoutOptions}
              value={templateId} onChange={setTemplateId} disabled={disabled}
            />
            <Button
              onClick={() => gerarBloco.mutate()} loading={gerarBloco.isPending}
              disabled={disabled || !dataIni || !dataFim || !templateId}
            >
              Gerar Estrutura
            </Button>
          </Stack>
        </Paper>
        <Paper p="md" withBorder>
          <Stack>
            <Text fw={600}>Repetir ciclo</Text>
            <TextInput
              label="Início do Ciclo" placeholder="YYYY-MM-DD" value={cicloIni}
              onChange={(e) => setCicloIni(e.currentTarget.value)} disabled={disabled}
            />
            <TextInput
              label="Fim do Ciclo" placeholder="YYYY-MM-DD" value={cicloFim}
              onChange={(e) => setCicloFim(e.currentTarget.value)} disabled={disabled}
            />
            <TextInput
              label="Repetir Até" placeholder="YYYY-MM-DD" value={ate}
              onChange={(e) => setAte(e.currentTarget.value)} disabled={disabled}
            />
            <Button
              onClick={() => repetirCiclo.mutate()} loading={repetirCiclo.isPending}
              disabled={disabled || !cicloIni || !cicloFim || !ate}
            >
              Repetir Ciclo
            </Button>
          </Stack>
        </Paper>
      </Group>
    </Stack>
  );
}
