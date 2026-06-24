import { test, expect } from '@playwright/test';

// Pré-requisito: backend + Postgres no ar e seed idempotente com um escalante
// (senha_hash local), uma lotação operacional e papel ESCALANTE nessa lotação.
// Credenciais via env (ver .env.example): E2E_CPF / E2E_SENHA.
const CPF = process.env.E2E_CPF ?? '00000000000';
const SENHA = process.env.E2E_SENHA ?? 'escalante123';

test('escalante: login → criar → editar dia → publicar', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByLabel('Usuário').fill(CPF);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/painel/);

  // Nova escala
  await page.goto('/escalas/nova');
  await page.getByLabel('Lotação').click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: /gerar escala/i }).click();

  // Detalhe → seleciona um dia no calendário → editor (Quadro de Escala)
  await page.getByText('15', { exact: true }).first().click();
  await expect(page.getByText(/quadro de escala/i)).toBeVisible();

  // Monta o dia e salva
  await page.getByRole('button', { name: 'Adicionar Guarnição' }).click();
  await page.getByRole('button', { name: /^salvar$/i }).click();
  await expect(page.getByText(/dia salvo/i)).toBeVisible();

  // Publica
  await page.getByRole('button', { name: /publicar escala/i }).click();
  await expect(page.getByText(/escala publicada/i)).toBeVisible();
});
