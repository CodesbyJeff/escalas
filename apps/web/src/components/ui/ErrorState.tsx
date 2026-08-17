import { Alert, Button, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

/**
 * Estado de erro com recuperação.
 *
 * `variant="light"` por decisão do spec: vermelho preenchido fica reservado
 * a ação primária e ao badge de conflito. Erro comunica por superfície
 * tingida, não por bloco chapado.
 */
export function ErrorState({ message, onRetry }: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      variant="light"
      color="cbmrn"
      title="Não foi possível carregar"
      icon={<IconAlertTriangle size={18} />}
    >
      {message}
      {onRetry && (
        <Group mt="sm">
          <Button size="xs" variant="default" onClick={onRetry}>Tentar novamente</Button>
        </Group>
      )}
    </Alert>
  );
}
