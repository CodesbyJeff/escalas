import { useState } from 'react';
import { useForm, zodResolver } from '@mantine/form';
import { Paper, Stack, TextInput, PasswordInput, Button, Title, Center, Alert } from '@mantine/core';
import { loginSchema, type LoginInput } from '@escalas/shared-schemas';

export function LoginForm({ onSubmit }: { onSubmit: (v: LoginInput) => Promise<void> }) {
  const [erro, setErro] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    initialValues: { cpf: '', senha: '' },
    validate: zodResolver(loginSchema),
  });
  const submit = form.onSubmit(async (values) => {
    setErro(null);
    try { await onSubmit(values); } catch (e) { setErro((e as Error).message); }
  });
  return (
    <Center mih="100vh" bg="gray.1">
      <Paper p="xl" w={380} radius="md" withBorder>
        <form onSubmit={submit}>
          <Stack>
            <Title order={3} ta="center" c="cbmrn.7">ESCALAS CBMRN</Title>
            {erro && <Alert color="red">{erro}</Alert>}
            <TextInput label="Usuário" placeholder="CPF (11 dígitos)" {...form.getInputProps('cpf')} />
            <PasswordInput label="Senha" {...form.getInputProps('senha')} />
            <Button type="submit" loading={form.submitting}>ENTRAR</Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
