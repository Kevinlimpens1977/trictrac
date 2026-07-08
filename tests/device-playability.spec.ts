import { test, expect, type Page } from '@playwright/test';

const viewports = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'samsung portrait', width: 384, height: 854 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'ultrawide desktop', width: 2560, height: 720 },
];

async function expectTappableInViewport(page: Page, label: string | RegExp) {
  const control = page.getByRole('button', { name: label });
  await expect(control).toBeVisible();

  const box = await control.boundingBox();
  expect(box, `${String(label)} should have a layout box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, 'viewport should be available').not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x, `${String(label)} should not overflow left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${String(label)} should not overflow top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${String(label)} should not overflow right`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${String(label)} should not overflow bottom`).toBeLessThanOrEqual(viewport.height);
  expect(box.width, `${String(label)} should be wide enough to tap`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${String(label)} should be tall enough to tap`).toBeGreaterThanOrEqual(36);

  const tapTargetReceivesClick = await control.evaluate((element, point) => {
    const topElement = document.elementFromPoint(point.x, point.y);
    return topElement === element || element.contains(topElement);
  }, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
  expect(tapTargetReceivesClick, `${String(label)} should receive taps at its center`).toBe(true);
}

/**
 * Tap-target audit: elke zichtbare knop moet minimaal 44x44 CSS-px zijn
 * (Apple HIG / WCAG 2.5.5). Allowlist is bewust leeg.
 */
async function expectAllVisibleButtons44(page: Page, context: string) {
  // offsetWidth/offsetHeight: layout-maat, onafhankelijk van transforms
  // (entry-animaties zoals popIn schalen tijdelijk via transform).
  const measure = () => page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .filter((b) => {
        const style = window.getComputedStyle(b);
        return b.offsetWidth > 0 && b.offsetHeight > 0 && style.visibility !== 'hidden';
      })
      .map((b) => ({
        label: (b.getAttribute('aria-label') || b.textContent || '?').trim().slice(0, 40),
        width: b.offsetWidth,
        height: b.offsetHeight,
      }));
  });

  // 0.5px epsilon: subpixel-rendering kan exact-44px targets als 43.99998 meten
  const MIN = 43.5;

  // Layout (dvh/clamp/fonts) kan onder parallelle testload nog even zetten;
  // meet opnieuw voordat we definitief falen.
  let buttons = await measure();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = buttons.length > 0 && buttons.every((b) => b.width >= MIN && b.height >= MIN);
    if (ok) break;
    await page.waitForTimeout(300);
    buttons = await measure();
  }

  expect(buttons.length, `${context}: at least one visible button expected`).toBeGreaterThan(0);
  for (const b of buttons) {
    expect(b.width, `${context}: "${b.label}" should be >=44px wide`).toBeGreaterThanOrEqual(MIN);
    expect(b.height, `${context}: "${b.label}" should be >=44px tall`).toBeGreaterThanOrEqual(MIN);
  }
}

for (const viewport of viewports) {
  test(`hub (gameroom) controls are playable after login on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1', { waitUntil: 'load' });

    // Na inloggen land je direct in de gameroom-hub
    await expectTappableInViewport(page, 'Speluitleg');
    await expectTappableInViewport(page, 'Speel tegen de computer');
    await expectTappableInViewport(page, /Speel op (één|een) computer/);
    await expectTappableInViewport(page, 'Speel online');
    await expectTappableInViewport(page, 'Uitloggen');
  });

  test(`game controls are playable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_pva=1', { waitUntil: 'load' });

    await expectTappableInViewport(page, /Gooi Dobbelstenen/);
    await expectTappableInViewport(page, 'Verlaat Spel');
  });

  test(`game board uses the shared framed card background on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_pva=1', { waitUntil: 'load' });

    const shellStyle = await page.locator('.game-shell').evaluate((element) => {
      const style = window.getComputedStyle(element);
      const backdrop = window.getComputedStyle(element, '::before');
      return {
        background: style.background,
        backdropBackgroundImage: backdrop.backgroundImage,
        backdropFilter: backdrop.filter,
      };
    });

    expect(shellStyle.background).not.toContain('rgb(0, 0, 0)');
    expect(shellStyle.backdropBackgroundImage).toContain('trictrachome');
    expect(shellStyle.backdropFilter).toContain('blur');

    const wrapper = page.locator('.board-wrapper');
    await expect(wrapper).toBeVisible();
    const wrapperBox = await wrapper.boundingBox();
    expect(wrapperBox).not.toBeNull();
    if (!wrapperBox) return;

    expect(wrapperBox.x).toBeGreaterThanOrEqual(8);
    expect(wrapperBox.y).toBeGreaterThanOrEqual(8);
    expect(wrapperBox.x + wrapperBox.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(wrapperBox.y + wrapperBox.height).toBeLessThanOrEqual(viewport.height - 8);

    const wrapperStyle = await wrapper.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        overflow: style.overflow,
      };
    });

    expect(wrapperStyle.borderTopColor).toBe('rgb(255, 255, 255)');
    expect(wrapperStyle.borderTopWidth).toBe('2px');
    expect(Number.parseFloat(wrapperStyle.borderRadius)).toBeGreaterThanOrEqual(18);
    expect(wrapperStyle.overflow).toBe('hidden');
  });

  test(`game over stays inside the shared framed card on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_gameover=1', { waitUntil: 'load' });

    const shellStyle = await page.locator('.game-shell').evaluate((element) => {
      const style = window.getComputedStyle(element);
      const backdrop = window.getComputedStyle(element, '::before');
      return {
        background: style.background,
        backdropBackgroundImage: backdrop.backgroundImage,
        backdropFilter: backdrop.filter,
      };
    });

    expect(shellStyle.background).not.toContain('rgb(0, 0, 0)');
    expect(shellStyle.backdropBackgroundImage).toContain('trictrachome');
    expect(shellStyle.backdropFilter).toContain('blur');

    const wrapper = page.locator('.board-wrapper');
    await expect(wrapper).toBeVisible();
    const wrapperStyle = await wrapper.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        overflow: style.overflow,
      };
    });

    expect(wrapperStyle.borderTopColor).toBe('rgb(255, 255, 255)');
    expect(wrapperStyle.borderTopWidth).toBe('2px');
    expect(Number.parseFloat(wrapperStyle.borderRadius)).toBeGreaterThanOrEqual(18);
    expect(wrapperStyle.overflow).toBe('hidden');
  });
}

/* ─── Regressie: statistieken-chip mag de menuknoppen niet verschuiven ───
   (de chip rendert alleen bij bestaande stats; verse testprofielen hebben
   die niet, dus we seeden localStorage vóór het laden) ─── */
test('stats chip renders inside the gameroom stage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tt-stats-test-user', JSON.stringify({
      played: 3, won: 1, lost: 2, doubles: 4, hits: 2, fastestWinMs: 300000,
    }));
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?test=1', { waitUntil: 'load' });

  await expect(page.locator('.menuStats')).toBeVisible();

  const stage = await page.locator('.gameRoomStage').boundingBox();
  const chip = await page.locator('.menuStats').boundingBox();
  expect(stage).not.toBeNull();
  expect(chip).not.toBeNull();
  if (!stage || !chip) return;

  expect(chip.y + chip.height, 'chip should stay inside the stage').toBeLessThanOrEqual(stage.y + stage.height + 1);
  expect(chip.y, 'chip should start inside the stage').toBeGreaterThanOrEqual(stage.y - 1);
});

/* ─── Tap-target audit: alle zichtbare knoppen >=44px op elk kerndevice ─── */

const tapTargetViewports = [
  { name: 'mobile portrait', width: 375, height: 812 },
  { name: 'mobile landscape', width: 812, height: 375 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const viewport of tapTargetViewports) {
  test(`tap targets >=44px on hub (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1', { waitUntil: 'load' });
    await expectAllVisibleButtons44(page, 'hub');
  });

  test(`tap targets >=44px in gameroom flows (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });

    await expect(page.getByRole('button', { name: 'Speel op één computer' })).toBeVisible();
    await expectAllVisibleButtons44(page, 'gameroom lobby');

    // Speluitleg-dialoog (sluitknop)
    await page.getByRole('button', { name: 'Speluitleg' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAllVisibleButtons44(page, 'gameroom help');
    await page.getByRole('button', { name: 'Sluit speluitleg' }).click();

    // Lokaal spelen (invoer + start/terug)
    await page.getByRole('button', { name: 'Speel op één computer' }).click();
    await expect(page.getByRole('button', { name: 'Start Spel' })).toBeVisible();
    await expectAllVisibleButtons44(page, 'gameroom local');

    // Toss-scherm
    await page.getByRole('button', { name: 'Start Spel' }).click();
    await expect(page.getByRole('button', { name: 'Gooi Dobbelstenen' })).toBeVisible();
    await expectAllVisibleButtons44(page, 'gameroom toss');
  });

  test(`tap targets >=44px in gameroom online panel (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_gameroom=1', { waitUntil: 'load' });

    await page.getByRole('button', { name: 'Speel online' }).click();
    await expect(page.getByRole('button', { name: 'Host Game' })).toBeVisible();
    await expectAllVisibleButtons44(page, 'gameroom online');
  });

  test(`tap targets >=44px in game + leave dialog (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_pva=1', { waitUntil: 'load' });

    await expect(page.getByRole('button', { name: /Gooi Dobbelstenen/ })).toBeVisible();
    await expectAllVisibleButtons44(page, 'game');

    await page.getByRole('button', { name: /Verlaat spel/i }).click();
    await expect(page.getByRole('button', { name: 'Annuleren' })).toBeVisible();
    await expectAllVisibleButtons44(page, 'game leave-dialog');
  });

  test(`tap targets >=44px on gameover (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1&start_gameover=1', { waitUntil: 'load' });

    await expect(page.getByRole('button', { name: 'Neem Revanche' })).toBeVisible({ timeout: 10_000 });
    await expectAllVisibleButtons44(page, 'gameover');
  });
}
