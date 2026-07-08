import { test, expect } from '@playwright/test';

test('has title and renders AuthScreen', async ({ page }) => {
  await page.goto('/');

  // Expect the Tric-Trac title
  await expect(page).toHaveTitle(/tric-trac/i);

  // Expect the page to have the Auth Screen elements without an extra heading in the card
  await expect(page.getByRole('heading', { name: 'Spelen als' })).toHaveCount(0);

  const googleBtn = page.getByRole('button', { name: /Doorgaan met Google/i });
  await expect(googleBtn).toBeVisible();
});

const authBackgroundCases = [
  { name: 'mobile portrait', width: 390, height: 844, expected: 'bg916vs2.png', ratio: 9 / 16 },
  { name: 'mobile landscape', width: 844, height: 390, expected: 'bg169vs2.png', ratio: 16 / 9 },
  { name: 'desktop landscape', width: 1366, height: 768, expected: 'bg169vs2.png', ratio: 16 / 9 },
  { name: 'ultrawide desktop', width: 2560, height: 720, expected: 'bg169vs2.png', ratio: 16 / 9 },
];

for (const viewport of authBackgroundCases) {
  test(`uses the correct auth background on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const backgroundFrame = await page.locator('.auth-art-card').evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        rect: {
          top: Number.parseFloat(style.top),
          left: Number.parseFloat(style.left),
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height),
        },
        borderTopLeftRadius: style.borderTopLeftRadius,
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
      };
    });

    expect(backgroundFrame.backgroundImage).toContain(viewport.expected);
    expect(backgroundFrame.backgroundSize).toBe('contain');
    expect(backgroundFrame.rect.width / backgroundFrame.rect.height).toBeCloseTo(viewport.ratio, 2);
    expect(backgroundFrame.rect.width).toBeLessThanOrEqual(viewport.width - 16);
    expect(backgroundFrame.rect.height).toBeLessThanOrEqual(viewport.height - 16);
    expect(backgroundFrame.rect.top).toBeGreaterThanOrEqual(8);
    expect(backgroundFrame.rect.left).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(backgroundFrame.borderTopLeftRadius)).toBeGreaterThanOrEqual(18);
    expect(backgroundFrame.borderTopColor).toBe('rgb(229, 231, 235)');
    expect(backgroundFrame.borderTopWidth).toBe('2px');

    const cardBox = await page.locator('.auth-card').boundingBox();
    const viewportSize = page.viewportSize();
    expect(cardBox).not.toBeNull();
    expect(viewportSize).not.toBeNull();
    if (!cardBox || !viewportSize) return;

    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.y).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewportSize.width);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewportSize.height);
    expect(cardBox.height).toBeLessThanOrEqual(140);

    const cardStyle = await page.locator('.auth-card').evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
      };
    });

    expect(cardStyle.backgroundColor).toContain('rgba(255, 255, 255,');
    expect(cardStyle.borderTopColor).toBe('rgb(229, 231, 235)');
    expect(cardStyle.borderTopWidth).toBe('2px');
  });
}

test('animates a responsive logo overlay without moving the login card', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const artCard = page.locator('.auth-art-card');
  const overlay = page.locator('.trictrac-logo-overlay');
  const shine = page.locator('.trictrac-logo-shine');
  const loginCard = page.locator('.auth-card');

  await expect(artCard).toBeVisible();
  await expect(overlay).toBeVisible();
  await expect(shine).toBeVisible();

  const artBox = await artCard.boundingBox();
  const overlayBox = await overlay.boundingBox();
  const cardBefore = await loginCard.boundingBox();
  expect(artBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  expect(cardBefore).not.toBeNull();
  if (!artBox || !overlayBox || !cardBefore) return;

  const overlayTop = (overlayBox.y - artBox.y) / artBox.height;
  const overlayHeight = overlayBox.height / artBox.height;
  const overlayWidth = overlayBox.width / artBox.width;

  expect(overlayTop).toBeGreaterThanOrEqual(0);
  expect(overlayTop).toBeLessThanOrEqual(0.08);
  expect(overlayHeight).toBeGreaterThanOrEqual(0.25);
  expect(overlayHeight).toBeLessThanOrEqual(0.34);
  expect(overlayWidth).toBeCloseTo(1, 1);

  const animation = await overlay.evaluate((element) => {
    const overlayStyle = window.getComputedStyle(element);
    const shineStyle = window.getComputedStyle(element.querySelector('.trictrac-logo-shine')!);
    return {
      overlayAnimationName: overlayStyle.animationName,
      shineAnimationName: shineStyle.animationName,
      pointerEvents: overlayStyle.pointerEvents,
    };
  });

  expect(animation.overlayAnimationName).toContain('tricTracLogoIntro');
  expect(animation.shineAnimationName).toContain('tricTracShineSweep');
  expect(animation.pointerEvents).toBe('none');

  await page.waitForTimeout(900);
  const cardAfter = await loginCard.boundingBox();
  expect(cardAfter).not.toBeNull();
  if (!cardAfter) return;

  expect(cardAfter.x).toBeCloseTo(cardBefore.x, 0);
  expect(cardAfter.y).toBeCloseTo(cardBefore.y, 0);
  expect(cardAfter.width).toBeCloseTo(cardBefore.width, 0);
  expect(cardAfter.height).toBeCloseTo(cardBefore.height, 0);
});

test('disables logo intro motion for reduced motion users', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const motion = await page.locator('.trictrac-logo-overlay').evaluate((element) => {
    const overlayStyle = window.getComputedStyle(element);
    const shineStyle = window.getComputedStyle(element.querySelector('.trictrac-logo-shine')!);
    return {
      overlayAnimationName: overlayStyle.animationName,
      shineAnimationName: shineStyle.animationName,
    };
  });

  expect(motion.overlayAnimationName).toBe('none');
  expect(motion.shineAnimationName).toBe('none');
});
