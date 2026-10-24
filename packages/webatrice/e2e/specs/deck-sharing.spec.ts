import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { E2E_HOST, E2E_HOST_LABEL, registerAndJoinFirstRoom, registerAndReachRooms } from '../fixtures/flows';
import { randomSuffix, randomUser } from '../fixtures/users';
import { LoginPage, navRailLink } from '../pages';

// Deck share links and public decks (Cockatrice 3.1, #7241) against a real
// Servatrice: one user shares or publishes a deck, another opens it read-only
// and imports a copy, and a revoked link stops opening.
//
// Needs a 3.1 server. Run against Cockatrice master with
//   SERVATRICE_IMAGE=webatrice-local/servatrice:master-add65ca npm run test:e2e
// Against the pinned 3.0 release the spec checks that sharing stays hidden.
const SERVER_IS_3_1 = /master|3\.1/.test(process.env.SERVATRICE_IMAGE ?? '');

async function createDeck(page: Page, name: string): Promise<void> {
  await navRailLink(page, 'Decks').click();
  await page.getByRole('button', { name: /New deck/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create a deck' });
  await dialog.getByPlaceholder('Untitled Deck').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue(name, { timeout: 15_000 });
  await navRailLink(page, 'Decks').click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Decks' })).toBeVisible();
}

async function openDeckMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('article', { name }).getByRole('button', { name: `More actions for ${name}` }).click();
}

async function expectImported(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Import to my decks' }).click();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue(name, { timeout: 15_000 });
}

test.describe('on a 3.1 server', () => {
  test.skip(!SERVER_IS_3_1, 'deck sharing needs Servatrice 3.1 (SERVATRICE_IMAGE=…master…)');

  test('a published deck is listed in the owner\'s public decks and can be imported', async ({ newContext }) => {
    test.setTimeout(150_000);
    const ownerPage = await (await newContext()).newPage();
    const viewerPage = await (await newContext()).newPage();
    const owner = await registerAndJoinFirstRoom(ownerPage);
    const viewer = await registerAndJoinFirstRoom(viewerPage);

    const deckName = `Public ${randomSuffix()}`;
    await createDeck(ownerPage, deckName);
    await openDeckMenu(ownerPage, deckName);
    await ownerPage.getByRole('menuitem', { name: 'Make public' }).click();
    await expect(ownerPage.getByRole('article', { name: deckName }).getByText('Public', { exact: true }))
      .toBeVisible({ timeout: 15_000 });

    await (await viewer.rooms.findPerson(owner.user.username)).click({ button: 'right' });
    await viewerPage.getByRole('menuitem', { name: 'View this user\'s public decks' }).click();
    await expect(viewerPage.getByRole('heading', { name: `Public decks of ${owner.user.username}` })).toBeVisible();
    await viewerPage.getByRole('button', { name: `Open ${deckName}` }).click({ timeout: 15_000 });
    await expect(viewerPage.getByRole('region', { name: deckName })).toBeVisible({ timeout: 15_000 });
    await expectImported(viewerPage, deckName);
  });

  test('a share link opens after login, imports, and stops working once revoked', async ({ newContext }) => {
    test.setTimeout(150_000);
    const ownerPage = await (await newContext()).newPage();
    const viewerPage = await (await newContext()).newPage();
    await registerAndReachRooms(ownerPage);

    const deckName = `Shared ${randomSuffix()}`;
    await createDeck(ownerPage, deckName);
    await openDeckMenu(ownerPage, deckName);
    await ownerPage.getByRole('menuitem', { name: 'Share link…' }).click();
    await ownerPage.getByRole('textbox', { name: 'Share name:' }).fill('For a friend');
    await ownerPage.getByRole('button', { name: 'Create share link' }).click();
    const shareDialog = ownerPage.getByRole('dialog', { name: 'Share deck' });
    const linkField = shareDialog.getByRole('textbox', { name: 'Share link' });
    await expect(linkField).toHaveValue(/#share=/, { timeout: 15_000 });
    const link = await linkField.inputValue();
    expect(new URL(link).search).toBe('');
    expect(new URLSearchParams(new URL(link).hash.slice(1)).get('hostname')).toBe(E2E_HOST.host);
    await shareDialog.getByRole('button', { name: 'Close', exact: true }).click();

    await viewerPage.goto(link);
    const login = new LoginPage(viewerPage);
    await expect(login.hostPicker).toBeVisible();
    expect(viewerPage.url()).not.toContain('share=');
    await login.addHost(E2E_HOST_LABEL, E2E_HOST.host, E2E_HOST.port);
    await login.selectHost(E2E_HOST_LABEL);
    const viewer = randomUser();
    await login.register(viewer.username, viewer.password, { hostLabel: E2E_HOST_LABEL });

    await expect(viewerPage.getByRole('heading', { name: 'Open shared decks' })).toBeVisible({ timeout: 15_000 });
    await expect(viewerPage.getByText('Share: For a friend')).toBeVisible({ timeout: 15_000 });
    await viewerPage.getByRole('button', { name: `Open ${deckName}` }).click();
    await expect(viewerPage.getByRole('region', { name: deckName })).toBeVisible({ timeout: 15_000 });
    await expectImported(viewerPage, deckName);

    await ownerPage.getByRole('navigation', { name: 'Sharing' }).getByRole('button', { name: 'Share links' }).click();
    const links = ownerPage.getByRole('dialog', { name: 'My share links' });
    await links.getByRole('button', { name: 'Revoke For a friend' }).click({ timeout: 15_000 });
    await links.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(links.getByText('You have no active share links.')).toBeVisible({ timeout: 15_000 });

    await navRailLink(viewerPage, 'Decks').click();
    await viewerPage.getByRole('navigation', { name: 'Sharing' }).getByRole('button', { name: 'Open shared deck' }).click();
    await viewerPage.getByRole('textbox', { name: 'Share link:' }).fill(link);
    await viewerPage.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(viewerPage.getByText('The shared deck could not be found or has expired')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('on a 3.0 server', () => {
  test.skip(SERVER_IS_3_1, 'checks the 3.0 fallback');

  test('deck sharing stays hidden', async ({ page }) => {
    test.setTimeout(90_000);
    await registerAndReachRooms(page);
    const deckName = `Plain ${randomSuffix()}`;
    await createDeck(page, deckName);
    await expect(page.getByRole('navigation', { name: 'Sharing' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share links' })).toHaveCount(0);

    await openDeckMenu(page, deckName);
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Open in editor' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^Share link/ })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: /^Make (public|private)$/ })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Open in editor' }).click();
    await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue(deckName, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Share deck...' })).toHaveCount(0);
  });
});
