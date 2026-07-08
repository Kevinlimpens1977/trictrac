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

async function expectHitboxReceivesClickInViewport(page: Page, label: string | RegExp) {
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
 * Sinds de UX-overhaul zijn de menuknoppen échte zichtbare knoppen:
 * - landscape/desktop: over de ingebakken videoknoppen heen (onderste band van de stage)
 * - mobiel portret (<=700px): als kolom ONDER de stage, volle breedte
 */
async function expectMenuButtonsPlacement(page: Page, viewport: { width: number; height: number }) {
  const stage = page.locator('.videoStage');
  const pvp = page.getByRole('button', { name: 'Start speler tegen speler' });
  const pvc = page.getByRole('button', { name: 'Start speler tegen computer' });

  const [stageBox, pvpBox, pvcBox] = await Promise.all([
    stage.boundingBox(),
    pvp.boundingBox(),
    pvc.boundingBox(),
  ]);

  expect(stageBox, 'menu stage should have a layout box').not.toBeNull();
  expect(pvpBox, 'pvp button should have a layout box').not.toBeNull();
  expect(pvcBox, 'pvc button should have a layout box').not.toBeNull();
  if (!stageBox || !pvpBox || !pvcBox) return;

  const isMobilePortrait = viewport.width <= 700 && viewport.height > viewport.width;

  if (isMobilePortrait) {
    // Kolom onder de stage, volle breedte, ruim tapbaar
    for (const [label, box] of [['pvp', pvpBox], ['pvc', pvcBox]] as const) {
      expect(box.y, `${label} button should sit below the stage`).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
      expect(box.width, `${label} button should span the layout width`).toBeGreaterThanOrEqual(stageBox.width * 0.95);
      // 0.5px epsilon voor subpixel-rendering (Firefox meet 48px als 47.99997)
      expect(box.height, `${label} button should be comfortably tappable`).toBeGreaterThanOrEqual(47.5);
    }
    expect(pvcBox.y, 'pvc below pvp').toBeGreaterThan(pvpBox.y);
    return;
  }

  const asStagePercent = (box: { x: number; y: number; width: number; height: number }) => ({
    left: (box.x - stageBox.x) / stageBox.width,
    top: (box.y - stageBox.y) / stageBox.height,
    right: (box.x + box.width - stageBox.x) / stageBox.width,
    bottom: (box.y + box.height - stageBox.y) / stageBox.height,
  });

  const pvpRect = asStagePercent(pvpBox);
  const pvcRect = asStagePercent(pvcBox);

  expect(pvpRect.left).toBeGreaterThanOrEqual(0.14);
  expect(pvpRect.left).toBeLessThanOrEqual(0.18);
  expect(pvpRect.right).toBeGreaterThanOrEqual(0.46);
  expect(pvpRect.right).toBeLessThanOrEqual(0.50);
  expect(pvcRect.left).toBeGreaterThanOrEqual(0.51);
  expect(pvcRect.left).toBeLessThanOrEqual(0.54);
  expect(pvcRect.right).toBeGreaterThanOrEqual(0.83);
  expect(pvcRect.right).toBeLessThanOrEqual(0.87);

  for (const [label, rect] of [['pvp', pvpRect], ['pvc', pvcRect]] as const) {
    expect(rect.top, `${label} button should start on the painted band`).toBeGreaterThanOrEqual(0.80);
    expect(rect.top, `${label} button should start on the painted band`).toBeLessThanOrEqual(0.90);
    expect(rect.bottom, `${label} button should end on the painted band`).toBeGreaterThanOrEqual(0.92);
    expect(rect.bottom, `${label} button should end on the painted band`).toBeLessThanOrEqual(1.01);
  }
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
  test(`menu video uses the login-style card background on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1', { waitUntil: 'load' });

    const screenStyle = await page.locator('.startScreen').evaluate((element) => {
      const style = window.getComputedStyle(element);
      const backdrop = window.getComputedStyle(element, '::before');
      return {
        background: style.background,
        backdropBackgroundImage: backdrop.backgroundImage,
        backdropFilter: backdrop.filter,
      };
    });

    expect(screenStyle.background).not.toBe('rgb(5, 5, 5) none repeat scroll 0% 0% / auto padding-box border-box');
    expect(screenStyle.backdropBackgroundImage).toContain('trictrachome');
    expect(screenStyle.backdropFilter).toContain('blur');

    const stage = page.locator('.videoStage');
    await expect(stage).toBeVisible();
    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();
    if (!stageBox) return;

    expect(stageBox.width / stageBox.height).toBeCloseTo(16 / 9, 2);
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
  });

  test(`menu start controls are playable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1', { waitUntil: 'load' });

    await expectHitboxReceivesClickInViewport(page, 'Start speler tegen speler');
    await expectHitboxReceivesClickInViewport(page, 'Start speler tegen computer');
    await expectMenuButtonsPlacement(page, viewport);
    await expect(page.getByRole('button', { name: 'Speluitleg' })).toHaveCount(0);
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

/* ─── Tap-target audit: alle zichtbare knoppen >=44px op elk kerndevice ─── */

const tapTargetViewports = [
  { name: 'mobile portrait', width: 375, height: 812 },
  { name: 'mobile landscape', width: 812, height: 375 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const viewport of tapTargetViewports) {
  test(`tap targets >=44px on menu (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/?test=1', { waitUntil: 'load' });
    await expectAllVisibleButtons44(page, 'menu');
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
