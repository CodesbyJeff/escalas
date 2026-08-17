import { SimpleGrid, Skeleton, Stack } from '@mantine/core';

/**
 * Esqueleto de carregamento com a forma do conteúdo que está por vir.
 *
 * Um giro centralizado não informa nada e ainda provoca salto de layout
 * quando os dados chegam. O esqueleto reserva o espaço certo desde o início.
 */
export function LoadingState({ variant = 'table', linhas = 5 }: {
  variant?: 'table' | 'cards' | 'form';
  linhas?: number;
}) {
  const itens = Array.from({ length: linhas }, (_, i) => i);

  if (variant === 'cards') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} role="status" aria-label="Carregando">
        {itens.map((i) => <Skeleton key={i} height={140} radius="sm" />)}
      </SimpleGrid>
    );
  }

  if (variant === 'form') {
    return (
      <Stack role="status" aria-label="Carregando" maw={480}>
        {itens.map((i) => <Skeleton key={i} height={36} radius="sm" />)}
      </Stack>
    );
  }

  return (
    <Stack gap="xs" role="status" aria-label="Carregando">
      {itens.map((i) => <Skeleton key={i} height={32} radius="sm" />)}
    </Stack>
  );
}
