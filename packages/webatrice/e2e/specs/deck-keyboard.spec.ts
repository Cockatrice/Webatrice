import { expect, test } from '../fixtures/test';
import { tabTo } from '../fixtures/keyboard';
import { registerAndReachRooms } from '../fixtures/flows';
import { navRailLink } from '../pages';

// Audit rows D1–D6: the deck editor worked only with a mouse (an unnamed
// quick-add field, rows whose actions needed hover, no focus in dialogs or
// menus). This spec builds and shares a deck with the keyboard alone: create
// it, add a card from the card search dock, change its count from the deck
// list's grid, save, add to the sideboard from the dock, and share it.
// Account creation and opening My Decks are mouse-driven setup.
//
// Sharing needs a 3.1 server
// (SERVATRICE_IMAGE=webatrice-local/servatrice:master-add65ca); against the
// pinned 3.0 release the spec stops after the save.
const SERVER_IS_3_1 = /master|3\.1/.test(process.env.SERVATRICE_IMAGE ?? '');

test('create, fill, save and share a deck with the keyboard only', async ({ page }) => {
  test.setTimeout(120_000);
  await registerAndReachRooms(page);
  await navRailLink(page, 'Decks').click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Decks' })).toBeVisible();

  await tabTo(page, page.getByRole('button', { name: /New deck/ }).first());
  await page.keyboard.press('Enter');
  const createDialog = page.getByRole('dialog', { name: 'Create a deck' });
  await expect(createDialog.getByPlaceholder('Untitled Deck')).toBeFocused();
  await page.keyboard.type('Keyboard Brew');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Keyboard Brew', { timeout: 15_000 });

  const search = page.getByRole('textbox', { name: 'Search cards' });
  const results = page.getByRole('region', { name: 'Search results' });
  await tabTo(page, search);
  await page.keyboard.type('Fore');
  await expect(results.getByRole('listitem').filter({ hasText: 'Forest' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Forest highlighted')).toBeAttached();
  await page.keyboard.press('Enter');
  const forest = page.getByRole('row', { name: /× Forest$/ });
  await expect(forest).toHaveAccessibleName('1 × Forest');

  await tabTo(page, forest);
  await page.keyboard.press('Equal');
  await page.keyboard.press('Equal');
  await expect(forest).toHaveAccessibleName('3 × Forest');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(forest).toHaveAccessibleName('2 × Forest');
  await expect(forest).toBeFocused();

  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Actions for Forest' });
  await expect(menu.getByRole('menuitem', { name: /Add one/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(forest).toHaveAccessibleName('3 × Forest');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(forest).toBeFocused();

  await page.keyboard.press('Control+s');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

  await tabTo(page, search);
  await expect(search).toHaveValue('Fore');
  await expect(results.getByRole('listitem').filter({ hasText: 'Forest' })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Added Forest to the sideboard')).toBeAttached();
  await expect(page.getByRole('row', { name: '1 × Forest' })).toBeVisible();
  await expect(page.getByRole('row', { name: '3 × Forest' })).toBeVisible();

  if (!SERVER_IS_3_1) {
    return;
  }

  const shareButton = page.getByRole('button', { name: /^Share deck/ });
  await tabTo(page, shareButton);
  await page.keyboard.press('Enter');
  const shareDialog = page.getByRole('dialog', { name: 'Share deck' });
  await expect(shareDialog.getByRole('textbox', { name: /^Share name/ })).toBeFocused();
  await page.keyboard.press('Enter');
  const link = shareDialog.getByRole('textbox', { name: 'Share link' });
  await expect(link).toBeFocused({ timeout: 15_000 });
  await expect(link).toHaveValue(/share=/);
  await page.keyboard.press('Escape');
  await expect(shareDialog).toHaveCount(0);
  await expect(shareButton).toBeFocused();
});
