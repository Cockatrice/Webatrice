import { expect, test } from '../fixtures/test';
import { GamePage } from '../pages';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

test('shows another user\'s games and joins one from the list', async ({ newContext }) => {
  test.setTimeout(120_000);
  const hostCtx = await newContext();
  const viewerCtx = await newContext();

  const hostPage = await hostCtx.newPage();
  const viewerPage = await viewerCtx.newPage();

  const host = await registerAndJoinFirstRoom(hostPage);
  const viewer = await registerAndJoinFirstRoom(viewerPage);

  const gameDescription = `games-${randomSuffix()}`;
  await host.rooms.createGame(gameDescription, { maxPlayers: 2 });

  await (await viewer.rooms.findPerson(host.user.username)).click({ button: 'right' });
  await viewerPage.getByRole('menuitem', { name: /show this user's games/i }).click();

  const dialog = viewerPage.getByRole('dialog', { name: `${host.user.username}'s games` });
  await expect(dialog).toBeVisible();
  const row = dialog.getByRole('row').filter({ hasText: gameDescription });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.click();
  await dialog.getByRole('button', { name: /^join$/i }).click();

  const viewerGame = new GamePage(viewerPage);
  await viewerGame.deckSelect.waitForOpen();
  await expect(dialog).toBeHidden();

  await viewerGame.deckSelect.leaveGame();
  const hostGame = new GamePage(hostPage);
  await hostGame.deckSelect.waitForOpen();
  await hostGame.deckSelect.leaveGame();
});

test('a private chat keeps the draft when the partner goes offline', async ({ newContext }) => {
  test.setTimeout(120_000);
  const senderCtx = await newContext();
  const partnerCtx = await newContext();

  const senderPage = await senderCtx.newPage();
  const partnerPage = await partnerCtx.newPage();

  const sender = await registerAndJoinFirstRoom(senderPage);
  const partner = await registerAndJoinFirstRoom(partnerPage);
  const partnerName = partner.user.username;

  await (await sender.rooms.findPerson(partnerName)).click({ button: 'right' });
  await senderPage.getByRole('menuitem', { name: 'Private chat' }).click();
  const chat = senderPage.getByRole('region', { name: `Chat with ${partnerName}` });
  const presence = chat.getByRole('button', { name: `${partnerName}: show profile` });
  await expect(presence).toContainText(/online/i, { timeout: 15_000 });

  const composer = chat.getByPlaceholder(`Message ${partnerName}`);
  await expect(composer).toBeFocused();
  await composer.fill('hello there');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByText('hello there')).toBeVisible();

  await partnerCtx.close();

  await expect(chat.getByText(`${partnerName} has left the server.`)).toBeVisible({ timeout: 30_000 });
  await expect(presence).toContainText(/offline/i);

  await composer.fill('are you still there?');
  await expect(chat.getByText(`${partnerName} is offline; messages cannot be delivered.`)).toBeVisible();
  await expect(chat.getByRole('button', { name: 'Send' })).toBeDisabled();
  await composer.press('Enter');
  await expect(composer).toHaveValue('are you still there?');
});
