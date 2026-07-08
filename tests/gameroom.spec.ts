import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

const localChoiceName = /Speel op (één|een) computer/;

async function expectControlInViewport(page: import('@playwright/test').Page, name: string | RegExp) {
  const control = page.getByRole('button', { name });
  await expect(control).toBeVisible();

  const box = await control.boundingBox();
  expect(box, `${String(name)} should have a layout box`).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport, 'viewport should be available').not.toBeNull();
  if (!viewport) return;

  expect(box.x, `${String(name)} should not overflow left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${String(name)} should not overflow top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${String(name)} should not overflow right`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${String(name)} should not overflow bottom`).toBeLessThanOrEqual(viewport.height);
  expect(box.width, `${String(name)} should be tappable`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${String(name)} should be tappable`).toBeGreaterThanOrEqual(36);

  // Clipping-check: het midden van de control moet daadwerkelijk raakbaar
  // zijn (een door overflow:hidden afgeknipt element heeft wel een box,
  // maar vangt geen taps)
  const receivesTap = await control.evaluate((element, point) => {
    const topElement = document.elementFromPoint(point.x, point.y);
    return topElement === element || element.contains(topElement);
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(receivesTap, `${String(name)} should receive taps at its center`).toBe(true);
}

async function expectGameroomFramedCard(page: import('@playwright/test').Page) {
  const screenStyle = await page.locator('.gameRoomScreen').evaluate((element) => {
    const style = window.getComputedStyle(element);
    const backdrop = window.getComputedStyle(element, '::before');
    return {
      background: style.background,
      backdropBackgroundImage: backdrop.backgroundImage,
      backdropFilter: backdrop.filter,
    };
  });

  expect(screenStyle.background).not.toContain('rgb(17, 17, 17)');
  expect(screenStyle.backdropBackgroundImage).toContain('gameroom_new');
  expect(screenStyle.backdropFilter).toContain('blur');

  const stage = page.locator('.gameRoomStage');
  await expect(stage).toBeVisible();
  await stage.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const stageBox = await stage.boundingBox();
  expect(stageBox, 'gameroom stage should have a layout box').not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, 'viewport should be available').not.toBeNull();
  if (!stageBox || !viewport) return;

  const isMobilePortrait = viewport.width <= 700 && viewport.height > viewport.width;
  if (isMobilePortrait) {
    // Mobiel portret: stage vult het scherm zodat het formulier past
    expect(stageBox.height, 'stage should fill the viewport height').toBeGreaterThanOrEqual(viewport.height * 0.85);
  } else {
    expect(stageBox.width / stageBox.height).toBeCloseTo(16 / 9, 2);
  }
  expect(stageBox.x).toBeGreaterThanOrEqual(8);
  expect(stageBox.y).toBeGreaterThanOrEqual(8);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(viewport.height - 8);

  const stageStyle = await stage.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      borderTopColor: style.borderTopColor,
      borderTopWidth: style.borderTopWidth,
      borderRadius: style.borderTopLeftRadius,
      overflow: style.overflow,
    };
  });

  expect(stageStyle.borderTopColor).toBe('rgb(255, 255, 255)');
  expect(stageStyle.borderTopWidth).toBe('2px');
  expect(Number.parseFloat(stageStyle.borderRadius)).toBeGreaterThanOrEqual(18);
  expect(stageStyle.overflow).toBe('hidden');
}

test.describe('Gameroom Screen', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Go to the app with test=1 to bypass Auth and start_gameroom=1 to go directly to Gameroom.
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });
  });

  test('opens with a calm three-option menu', async ({ page }) => {
    // Check if the gameroom container is visible
    const gameroomContainer = page.locator('.gameRoomOverlay');
    await expect(gameroomContainer).toBeVisible();
    await expectGameroomFramedCard(page);

    await expect(page.getByRole('button', { name: 'Speluitleg' })).toBeVisible();
    await expect(page.getByRole('button', { name: localChoiceName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speel online' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Op 1 computer' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Online Spelen' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Jouw Naam')).toHaveCount(0);
    await expect(page.getByText('Game ID:')).toHaveCount(0);
    await expect(page.getByPlaceholder('Naam Speler 1')).toHaveCount(0);

    // Ensure it fits within the viewport.
    // Check if any element is overflowing horizontally
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    // Playwright test passes if the width fits inside the device window (no horizontal scrolling).
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  for (const viewport of viewports) {
    test(`keeps primary gameroom controls playable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });

      await expectGameroomFramedCard(page);
      await expectControlInViewport(page, 'Speluitleg');
      await expectControlInViewport(page, localChoiceName);
      await expectControlInViewport(page, 'Speel online');
    });

    test(`keeps local play controls playable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });
      await page.getByRole('button', { name: localChoiceName }).click();

      await expectGameroomFramedCard(page);
      await expectControlInViewport(page, 'Start Spel');
      await expectControlInViewport(page, 'Terug');
      await expect(page.getByRole('heading', { name: 'Online Spelen' })).toHaveCount(0);
    });

    test(`keeps online play controls playable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });
      await page.getByRole('button', { name: 'Speel online' }).click();

      await expectGameroomFramedCard(page);
      await expectControlInViewport(page, 'Terug');
      await expectControlInViewport(page, 'Host Game');
      await expectControlInViewport(page, 'Join ID');
      await expect(page.getByRole('heading', { name: 'Op 1 computer' })).toHaveCount(0);
    });
  }

  test('local and online panels return to the three-option menu', async ({ page }) => {
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });

    await page.getByRole('button', { name: localChoiceName }).click();
    await expect(page.getByRole('heading', { name: 'Op 1 computer' })).toBeVisible();
    await page.getByRole('button', { name: 'Terug' }).click();
    await expect(page.getByRole('button', { name: 'Speel online' })).toBeVisible();

    await page.getByRole('button', { name: 'Speel online' }).click();
    await expect(page.getByRole('heading', { name: 'Online Spelen' })).toBeVisible();
    await page.getByRole('button', { name: 'Terug' }).click();
    await expect(page.getByRole('button', { name: localChoiceName })).toBeVisible();
    await expect(page.getByPlaceholder('Jouw Naam')).toHaveCount(0);
  });

  test('keeps the toss screen inside the framed gameroom card', async ({ page }) => {
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });
    await page.getByRole('button', { name: localChoiceName }).click();
    await page.getByRole('button', { name: 'Start Spel' }).click();

    await expect(page.getByRole('heading', { name: 'De Toss' })).toBeVisible();
    await expectGameroomFramedCard(page);
    await expectControlInViewport(page, 'Gooi Dobbelstenen');
  });

  test('opens the game explanation from the gameroom', async ({ page }) => {
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });

    await page.getByRole('button', { name: 'Speluitleg' }).click();
    await expect(page.getByRole('heading', { name: 'Speluitleg' })).toBeVisible();
    await expect(page.getByText('Tric-Trac is een eeuwenoud bordspel')).toBeVisible();
  });
});
