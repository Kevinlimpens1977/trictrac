import { test, expect } from '@playwright/test';

test.describe('Gameroom Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app with test=1 to bypass Auth and start_gameroom=1 to go directly to Gameroom.
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });
  });

  test('should render gameroom correctly without overflow', async ({ page }) => {
    // Check if the gameroom container is visible
    const gameroomContainer = page.locator('.gameRoomOverlay');
    await expect(gameroomContainer).toBeVisible();

    // Gameroom title
    const title = page.getByRole('heading', { name: 'Op 1 computer' });
    await expect(title).toBeVisible();

    // Ensure it fits within the viewport.
    // Check if any element is overflowing horizontally
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    // Playwright test passes if the width fits inside the device window (no horizontal scrolling).
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // The start match button
    const startMatchBtn = page.getByRole('button', { name: 'Start Spel' });
    await expect(startMatchBtn).toBeVisible();
  });
});
