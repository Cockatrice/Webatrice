import { expect, test } from '../fixtures/test';

import { LoginPage } from '../pages';

const blank = (api: string) => {
  Object.defineProperty(window, api, { value: undefined, configurable: true, writable: true });
};

for (const [api, label] of [
  ['WebSocket', 'WebSockets, used to connect to the server'],
  ['ResizeObserver', 'Resize observers, used to lay out the game board'],
]) {
  test(`a browser without ${api} gets the unsupported screen and never loads the app`, async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') {
        scripts.push(new URL(request.url()).pathname);
      }
    });
    await page.addInitScript(blank, api);

    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('main').getByRole('heading', { name: 'Unsupported Browser' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveText([label]);
    await expect(page.locator('#root > *')).toHaveCount(1);
    expect(scripts).toContainEqual(expect.stringMatching(/^\/assets\/index-[\w-]+\.js$/));
    expect(scripts.filter((path) => /^\/assets\/(boot|vendor)/.test(path))).toEqual([]);
  });
}

test('a page without Web Crypto (plain http://) boots with a password-hashing notice', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });
  });

  const login = new LoginPage(page);
  await login.goto();

  await expect(login.hostPicker).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notifications' })
    .getByText('Some features are unavailable in this browser'))
    .toContainText('passwords are sent to the server unhashed instead');
});
