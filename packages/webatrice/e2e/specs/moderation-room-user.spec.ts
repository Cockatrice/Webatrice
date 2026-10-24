import type { Page } from '@playwright/test';

import type { RoomsPage } from '../pages';

import { expect, test } from '../fixtures/test';

import { E2E_MODERATOR, joinFirstRoomAs, registerAndJoinFirstRoom } from '../fixtures/flows';

async function openUserMenuEntry(page: Page, rooms: RoomsPage, userName: string, entry: string): Promise<void> {
  const row = await rooms.findPerson(userName);
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: entry }).click();
}

test('moderator warns a room user and reads their warn and ban history', async ({ newContext }) => {
  test.setTimeout(120_000);
  const targetCtx = await newContext();
  const moderatorCtx = await newContext();

  const targetPage = await targetCtx.newPage();
  const moderatorPage = await moderatorCtx.newPage();

  const { user: target } = await registerAndJoinFirstRoom(targetPage);
  const { rooms } = await joinFirstRoomAs(moderatorPage, E2E_MODERATOR);

  await openUserMenuEntry(moderatorPage, rooms, target.username, 'Warn user');
  const warnDialog = moderatorPage.getByRole('dialog', { name: 'Warn user for misconduct' });
  await expect(warnDialog).toBeVisible({ timeout: 15_000 });
  const reasons = warnDialog.getByRole('combobox');
  await expect(reasons.getByRole('option', { name: 'Flaming' })).toBeAttached();
  await reasons.selectOption('Spamming');
  await warnDialog.getByRole('button', { name: 'OK' }).click();
  await expect(warnDialog).toBeHidden();

  await openUserMenuEntry(moderatorPage, rooms, target.username, 'View user\'s warn history');
  const warnHistory = moderatorPage.getByRole('dialog', { name: 'Warning History' });
  await expect(warnHistory).toBeVisible({ timeout: 15_000 });
  const warning = warnHistory.getByRole('row').filter({ hasText: 'Spamming' });
  await expect(warning).toContainText(E2E_MODERATOR.username);
  await warnHistory.getByRole('button', { name: 'Close' }).last().click();
  await expect(warnHistory).toBeHidden();

  await openUserMenuEntry(moderatorPage, rooms, target.username, 'View user\'s ban history');
  const banHistory = moderatorPage.getByRole('dialog').filter({ hasText: 'User has never been banned.' });
  await expect(banHistory).toBeVisible({ timeout: 15_000 });
  await banHistory.getByRole('button', { name: 'OK' }).click();
});
