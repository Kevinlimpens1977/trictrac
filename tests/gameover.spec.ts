import { test, expect } from '@playwright/test';

test.describe('Game Over Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app with test=1 to bypass Auth and start_gameover=1 to go directly to Game Over.
    await page.goto('/?test=1&start_gameover=1', { waitUntil: 'load' });
  });

  test('should render game over screen correctly', async ({ page }) => {
    // Check if the game over overlay is visible (Title has WIT WINT!)
    const title = page.getByRole('heading', { name: 'WIT WINT!' });
    await expect(title).toBeVisible({ timeout: 10000 });

    // Stats should be visible
    await expect(page.locator('text=Gooide 4x dubbel')).toBeVisible();
    await expect(page.locator('text=Aantal stenen geslagen: 3')).toBeVisible();

    // Verify 'Speel Opnieuw' button exists
    const replayBtn = page.getByRole('button', { name: 'Neem Revanche' });
    await expect(replayBtn).toBeVisible();
  });
});
