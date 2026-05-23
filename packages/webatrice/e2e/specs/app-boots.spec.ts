import { expect, test } from '@playwright/test';

// Test 1: app-boots & renders.
//
// Loads the production bundle in a real browser and asserts it mounts
// without crashing. This catches bundle regressions, broken chunk loads,
// and other "the app simply does not start" problems that no jsdom test
// can. No Servatrice interaction; this spec passes whether or not the
// container is reachable.

test('the app boots and mounts the root', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });

  await page.goto('/');

  // Whichever screen Webatrice settles on (Initialize splash / FeatureDetection
  // redirect / Login), the React tree must mount: the layout chrome attaches
  // a body containing more than the empty <div id="root">.
  const root = page.locator('#root');
  await expect(root).toBeAttached();
  await expect(root).not.toBeEmpty();

  expect(errors, `unexpected page/console errors:\n${errors.join('\n')}`).toEqual([]);
});
