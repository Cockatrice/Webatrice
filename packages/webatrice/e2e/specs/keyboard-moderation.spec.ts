import { expect, test } from '../fixtures/test';

import { E2E_MODERATOR, joinFirstRoomAs, registerAndJoinFirstRoom } from '../fixtures/flows';

test('a moderator warns a user and reads the warning back without a pointer', async ({ newContext }) => {
  test.setTimeout(120_000);
  const targetPage = await (await newContext()).newPage();
  const moderatorPage = await (await newContext()).newPage();
  const { user: target } = await registerAndJoinFirstRoom(targetPage);
  const { rooms } = await joinFirstRoomAs(moderatorPage, E2E_MODERATOR);
  const { keyboard } = moderatorPage;

  const name = await rooms.findPerson(target.username);
  await name.focus();

  async function chooseFromUserMenu(entry: string): Promise<void> {
    await expect(name).toBeFocused();
    await keyboard.press('Shift+F10');
    const menu = moderatorPage.getByRole('menu');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    const item = menu.getByRole('menuitem', { name: entry });
    for (let step = 0; step < 20 && !(await item.evaluate((el) => el === document.activeElement)); step++) {
      await keyboard.press('ArrowDown');
    }
    await expect(item).toBeFocused();
    await keyboard.press('Enter');
    await expect(menu).toBeHidden();
  }

  await chooseFromUserMenu('Warn user');
  const warnDialog = moderatorPage.getByRole('dialog', { name: 'Warn user for misconduct' });
  await expect(warnDialog).toBeVisible({ timeout: 15_000 });
  const reasons = warnDialog.getByRole('combobox');
  await expect(reasons).toBeFocused();
  await keyboard.type('Spamming');
  await expect(reasons).toHaveValue('Spamming');

  for (let step = 0; step < 8; step++) {
    await keyboard.press('Shift+Tab');
    await expect(warnDialog.locator(':focus')).toHaveCount(1);
  }
  const ok = warnDialog.getByRole('button', { name: 'OK' });
  for (let step = 0; step < 12 && !(await ok.evaluate((el) => el === document.activeElement)); step++) {
    await keyboard.press('Tab');
  }
  await expect(ok).toBeFocused();
  await keyboard.press('Enter');
  await expect(warnDialog).toBeHidden();
  await expect(name).toBeFocused();

  await chooseFromUserMenu('View user\'s warn history');
  const warnHistory = moderatorPage.getByRole('dialog', { name: 'Warning History' });
  await expect(warnHistory).toBeVisible({ timeout: 15_000 });
  await expect(warnHistory.getByRole('row').filter({ hasText: 'Spamming' })).toContainText(E2E_MODERATOR.username);
  await keyboard.press('Escape');
  await expect(warnHistory).toBeHidden();
  await expect(name).toBeFocused();
});
