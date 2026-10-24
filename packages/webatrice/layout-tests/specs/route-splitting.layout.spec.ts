import { expect, test } from '@playwright/test';
import { openHarness, settle } from '../fixtures/harness';

for (const route of ['game', 'deck'] as const) {
  test(`${route} keeps shell geometry while loading and restores on reload`, async ({ page }) => {
    const file = route === 'game' ? 'game/Game' : 'decks/DeckEditor';
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route(`**/src/features/${file}.tsx*`, async request => {
      await gate;
      await request.continue();
    });
    const opening = openHarness(page, { route });
    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    const before = await page.locator('main').first().boundingBox();
    const railBefore = await page.locator('nav').first().boundingBox();
    release();
    await opening;
    const ready = route === 'game' ? page.locator('[data-battlefield-owner]').first() : page.getByRole('textbox', { name: 'Deck name' });
    await expect(ready).toBeVisible();
    await settle(page);
    expect(await page.locator('main').first().boundingBox()).toEqual(before);
    expect(await page.locator('nav').first().boundingBox()).toEqual(railBefore);
    const saved = await page.evaluate(() => localStorage.getItem('webatrice.lastRoute'));
    expect(saved).toBe(route === 'game' ? '/game/1' : '/deck/draft/layout');
    await page.reload();
    await expect(ready).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('webatrice.lastRoute'))).toBe(saved);
  });
}

test('a failed route import offers the new version message and recovers through Reload', async ({ page }) => {
  let attempts = 0;
  await page.route('**/src/features/game/Game.tsx*', async request => {
    attempts++;
    if (attempts === 1) {
      await request.abort('failed');
    } else {
      await request.continue();
    }
  });
  await page.goto('/layout-tests/harness.html?route=game');
  await expect(page.getByRole('alert')).toContainText('A new version is available');
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.locator('[data-battlefield-owner]').first()).toBeVisible();
  expect(attempts).toBe(2);
});
