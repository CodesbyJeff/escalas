import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { EscalaDiaDTO } from '@escalas/shared-types';

export function PainelView({ nome, dia }: { nome: string; dia: EscalaDiaDTO | null }) {
  return (
    <Stack>
      <Title order={3} c="cbmrn.7">Seja bem vindo!</Title>
      <Text fw={600}>{nome}</Text>
      {!dia || dia.guarnicoes.length === 0 ? (
        <Text c="dimmed">Sem guarnições para hoje.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {dia.guarnicoes.map((g) => (
            <Card key={g.id} withBorder>
              <Text fw={700}>{g.atividade}</Text>
              <Text size="sm" c="dimmed">{g.turno_inicio} – {g.turno_fim}</Text>
              {g.vagas.map((v) => (
                <Text key={v.id} size="sm">{v.funcao} — {v.militar_id ?? 'VAGO'}</Text>
              ))}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
