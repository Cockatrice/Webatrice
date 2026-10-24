import { expect, test } from '../fixtures/test';

import { registerAndReachRooms } from '../fixtures/flows';
import { navRailLink } from '../pages';

test('deck folders, undo/redo and autosave round-trip through Servatrice', async ({ page }) => {
  test.setTimeout(120_000);
  await registerAndReachRooms(page);

  await navRailLink(page, 'Decks').click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Decks' })).toBeVisible();

  const folders = page.getByRole('navigation', { name: 'Folders' });
  const tournament = folders.getByRole('button', { name: /^Tournament/ });
  await folders.getByRole('button', { name: 'New folder' }).click();
  await page.getByRole('textbox', { name: 'Name of new folder:' }).fill('Tournament');
  await page.getByRole('button', { name: 'Create' }).click();
  await tournament.click();
  await expect(tournament).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 2, name: 'Tournament' })).toBeVisible();

  await page.getByRole('button', { name: /New deck/ }).first().click();
  const createDialog = page.getByRole('dialog', { name: 'Create a deck' });
  await createDialog.getByPlaceholder('Untitled Deck').fill('E2E Brew');
  await createDialog.getByRole('button', { name: 'Create' }).click();
  const name = page.getByRole('textbox', { name: 'Deck name' });
  await expect(name).toHaveValue('E2E Brew', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();

  await name.fill('E2E Brew v2');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(name).toHaveValue('E2E Brew');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

  const format = page.getByRole('combobox', { name: 'Format' });
  await format.selectOption('legacy');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  await expect(format).toHaveValue('commander');
  await page.keyboard.press('Control+y');
  await expect(format).toHaveValue('legacy');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

  const deckTile = page.getByRole('article', { name: 'E2E Brew' });
  await navRailLink(page, 'Decks').click();
  await tournament.click();
  await expect(deckTile).toBeVisible({ timeout: 15_000 });

  await deckTile.getByRole('button', { name: 'More actions for E2E Brew' }).click();
  await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
  await page.getByRole('combobox', { name: 'To folder' }).selectOption({ label: 'Server deck storage' });
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByText('This folder is empty.')).toBeVisible({ timeout: 15_000 });

  await folders.getByRole('button', { name: /^All decks/ }).click();
  await expect(deckTile).toBeVisible();

  await tournament.click();
  await page.getByRole('button', { name: 'Folder actions for Tournament' }).click();
  await page.getByRole('menuitem', { name: 'Delete folder' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(tournament).toHaveCount(0, { timeout: 15_000 });
});
