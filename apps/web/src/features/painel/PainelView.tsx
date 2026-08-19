import { PageHeader, EmptyState } from '../../components/ui';
import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import type { EscalaDiaDTO } from '@escalas/shared-types';

export function PainelView({ nome, dia, getMilitarNome }: {
  nome: string; dia: EscalaDiaDTO | null; getMilitarNome: (id: number) => string;
}) {
  return (
    <Stack>
      <PageHeader title="Painel" subtitle={`${nome} — serviço de hoje`} />
      {!dia || dia.guarnicoes.length === 0 ? (
        <EmptyState
          title="Sem guarnições para hoje."
          description="Nenhuma guarnição está escalada para a data de hoje na sua lotação."
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {dia.guarnicoes.map((g) => (
            <Card key={g.id}>
              <Text fw={700}>{g.atividade}</Text>
              <Text size="sm" c="dimmed" data-tabular>{g.turno_inicio} – {g.turno_fim}</Text>
              {g.vagas.map((v) => (
                <Text key={v.id} size="sm">
                  {v.funcao} — {v.militar_id != null ? getMilitarNome(v.militar_id) : 'VAGO'}
                </Text>
              ))}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
