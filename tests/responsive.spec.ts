import { test, expect } from '@playwright/test';

test('has title and renders AuthScreen', async ({ page }) => {
  await page.goto('/');

  // Expect a title "trictrac"
  await expect(page).toHaveTitle(/trictrac/i);

  // Expect the page to have the Auth Screen elements
  const loginTitle = page.getByRole('heading', { name: 'Spelen als' });
  await expect(loginTitle).toBeVisible();

  const googleBtn = page.getByRole('button', { name: /Doorgaan met Google/i });
  await expect(googleBtn).toBeVisible();
});
