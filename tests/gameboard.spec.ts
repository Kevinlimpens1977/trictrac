import { test, expect } from '@playwright/test';

test.describe('Gameboard and Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app with test=1 and start_pva=1 to bypass Firebase Auth and the MenuScreen.
    await page.goto('/?test=1&start_pva=1', { waitUntil: 'load' });
  });

  test('should render the gameboard correctly', async ({ page }) => {
    // Wait for the gameboard to exist
    const board = page.locator('.game-board');
    await board.waitFor({ state: 'attached', timeout: 10000 });
    await expect(board).toBeVisible();

    // Verify the game started by checking the HUD turn label
    await expect(page.locator('text=Speler 1 is aan zet').first()).toBeVisible();
  });

  test('should allow clicking to roll dice if it is the players turn', async ({ page }) => {
    // Let's check for the dice container by looking for the roll dice button.
    const rollButton = page.locator('button:has-text("Gooi Dobbelstenen")');
    await expect(rollButton).toBeVisible();
  });
});
