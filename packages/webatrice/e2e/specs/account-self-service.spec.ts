import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { E2E_HOST_LABEL, registerAndReachRooms } from '../fixtures/flows';
import { topBarTab } from '../pages';

async function openAccount(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: userName }).click();
  await page.getByRole('menuitem', { name: /^account$/i }).click();
  await expect(topBarTab(page, /^account/i)).toHaveAttribute('aria-current', 'page');
}

test('edit profile and change password, then log in with the new password', async ({ page }) => {
  test.setTimeout(90_000);
  const { login, rooms, user } = await registerAndReachRooms(page);
  await openAccount(page, user.username);

  await page.getByRole('button', { name: /^edit$/i }).click();
  const edit = page.getByRole('dialog', { name: /edit user profile/i });
  await edit.getByLabel(/real name/i).fill('E2E Tester');
  await edit.getByLabel(/^email$/i).fill(`${user.username}@example.com`);
  await edit.getByLabel(/current password/i).fill(user.password);
  await edit.getByRole('button', { name: /^ok$/i }).click();
  await expect(page.getByText('User information updated.')).toBeVisible();
  await expect(edit).toBeHidden();
  await expect(page.getByText('Real Name: E2E Tester')).toBeVisible();

  const newPassword = 'password456';
  await page.getByRole('button', { name: /change password/i }).click();
  const change = page.getByRole('dialog', { name: /change password/i });
  await change.getByLabel(/old password/i).fill('not-my-password');
  await change.getByLabel(/^new password$/i).fill(newPassword);
  await change.getByLabel(/confirm new password/i).fill(newPassword);
  await change.getByRole('button', { name: /^ok$/i }).click();
  await expect(change.getByRole('alert')).toHaveText('The old password is incorrect.');

  await change.getByLabel(/old password/i).fill(user.password);
  await change.getByRole('button', { name: /^ok$/i }).click();
  await expect(page.getByText('Password changed.')).toBeVisible();
  await expect(change).toBeHidden();

  await page.getByRole('button', { name: user.username }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(login.hostPicker).toBeVisible();
  await login.selectHost(E2E_HOST_LABEL);
  await login.login(user.username, newPassword);
  await rooms.waitForRoomList();
});
