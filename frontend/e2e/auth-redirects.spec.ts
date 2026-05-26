import { expect, test } from '@playwright/test';

test.describe('auth gating', () => {
  test('redirects unauthenticated visits to /me back to /login and renders the login UI', async ({
    page,
  }) => {
    // Sem cookies de sessão, o middleware deve redirecionar para /login.
    await page.goto('/me');

    await page.waitForURL(/\/login(\?.*)?$/);
    expect(new URL(page.url()).pathname).toBe('/login');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Entrar no Projeto1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continuar com Google' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continuar com GitHub' }),
    ).toBeVisible();
  });
});
