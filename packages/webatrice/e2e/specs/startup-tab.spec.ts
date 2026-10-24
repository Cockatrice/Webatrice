import { expect, test } from '../fixtures/test';
import { E2E_HOST_LABEL, registerAndReachRooms } from '../fixtures/flows';
import { LoginPage, navRailLink } from '../pages';

test('the startup tab opens once per launch; signing in again and reloading keep the page', async ({ page, context, browserName }) => {
  test.setTimeout(120_000);
  const { login, rooms, user } = await registerAndReachRooms(page);
  const userMenu = page.getByRole('button', { name: user.username });
  const replaysPage = page.getByRole('heading', { level: 1, name: /^replays$/i });
  const lobbyRooms = page.getByRole('heading', { name: /^rooms$/i });

  await navRailLink(page, /^settings$/i).click();
  await page.getByLabel(/^startup tab$/i).selectOption({ label: 'Game Replays' });
  await expect(page.getByRole('textbox', { name: /^room$/i })).toBeHidden();

  await rooms.waitForRoomList();
  await userMenu.click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(login.hostPicker).toBeVisible();
  await login.login(user.username, user.password);
  await expect(lobbyRooms).toBeVisible({ timeout: 30_000 });
  await expect(replaysPage).toBeHidden();

  if (browserName === 'firefox') {
    test.info().annotations.push({ type: 'skipped step', description: 'reload: Playwright Firefox reports it as navigate' });
  } else {
    await page.reload();
    await expect(login.hostPicker).toBeVisible();
    await login.selectHost(E2E_HOST_LABEL);
    await login.login(user.username, user.password);
    await expect(lobbyRooms).toBeVisible({ timeout: 30_000 });
    await expect(replaysPage).toBeHidden();
  }

  const launch = await context.newPage();
  const launchLogin = new LoginPage(launch);
  await launchLogin.goto();
  await launchLogin.selectHost(E2E_HOST_LABEL);
  await launchLogin.login(user.username, user.password);
  await expect(launch.getByRole('heading', { level: 1, name: /^replays$/i })).toBeVisible({ timeout: 30_000 });
});
