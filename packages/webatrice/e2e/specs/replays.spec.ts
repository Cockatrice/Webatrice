import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { GamePage, topBarTab } from '../pages';
import { ReplaysPage } from '../pages/ReplaysPage';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { expect, test } from '../fixtures/test';
import { randomSuffix } from '../fixtures/users';

// Replay parity (LONG-001..004): play a short real game, find it in the
// server replay storage, exercise the remote actions, then watch it and step
// through the timeline. Needs the e2e Servatrice to store replays
// (`store_replays=true` in docker/servatrice/servatrice-e2e.ini).
//
// Set REPLAY_FIXTURE_OUT to a path to keep the downloaded .cor (that is how
// src/services/replay/__mocks__/two-player-game.cor was captured).

const DECK_PATH = resolve(__dirname, '..', 'fixtures', 'decks', 'forest-60.cod');

test('a finished game can be found, managed and watched from the replays tab', async ({ newContext }) => {
  test.setTimeout(240_000);
  const hostCtx = await newContext({ acceptDownloads: true });
  const joinerCtx = await newContext();

  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();
  const [host, joiner] = await Promise.all([
    registerAndJoinFirstRoom(hostPage),
    registerAndJoinFirstRoom(joinerPage),
  ]);

  const gameName = `replay-${randomSuffix()}`;
  await host.rooms.createGame(gameName, { maxPlayers: 2 });
  const hostGame = new GamePage(hostPage);
  await joiner.rooms.joinGame(gameName);
  const joinerGame = new GamePage(joinerPage);
  await Promise.all([hostGame.loadDeck(DECK_PATH), joinerGame.loadDeck(DECK_PATH)]);
  await Promise.all([hostGame.setReady(), joinerGame.setReady()]);
  await Promise.all([hostGame.waitForBoard(), joinerGame.waitForBoard()]);
  await hostGame.drawCard();
  await hostGame.endTurn();
  await hostGame.leaveGame();
  await joinerGame.deckSelect.waitForOpen();
  await joinerGame.deckSelect.leaveGame();
  await expect(joinerGame.container).toBeHidden({ timeout: 30_000 });

  const replays = new ReplaysPage(hostPage);
  await replays.open();
  const match = await replays.selectMatch(gameName);
  await expect(match).toContainText(host.user.username);
  await expect(match).toContainText(joiner.user.username);

  const download = await replays.downloadSelected();
  expect(download.suggestedFilename()).toMatch(/^replay_\d+\.cor$/);
  if (process.env.REPLAY_FIXTURE_OUT) {
    await copyFile(await download.path(), process.env.REPLAY_FIXTURE_OUT);
  }

  await replays.detailAction('Keep').click();
  await expect(replays.detailAction('Kept')).toHaveAttribute('aria-pressed', 'true');
  await expect(match).toContainText('Kept');

  await replays.detailAction('Share code').click();
  const shareDialog = hostPage.getByRole('dialog').filter({ hasText: 'Replay Share Code' });
  await expect(shareDialog.getByTestId('replay-share-code')).toHaveText(/\S+/);
  await shareDialog.getByRole('button', { name: 'OK' }).click();

  await replays.detailAction('Save to library').click();
  await expect(replays.detailAction('In library')).toBeDisabled({ timeout: 30_000 });
  await expect(match).toContainText(new RegExp(`Saved in \\d+_${gameName}`));
  await replays.sourceFilter('On this device').click();
  await expect(match).toBeVisible();
  await expect(replays.detailAction('Delete from this browser')).toBeVisible();
  await replays.sourceFilter('All').click();

  await replays.loadPreview();
  await expect(replays.previewTime).toHaveText(/^0:00 \/ \d+:\d\d$/);
  for (let i = 0; i < 3; i++) {
    await hostPage.getByRole('button', { name: 'Forward 10 seconds' }).click();
  }
  await expect(replays.previewLog).toContainText(`${joiner.user.username} has joined the game.`);
  await expect(replays.previewTime).not.toHaveText(/^0:00 /);
  const previewAt = (await replays.previewTime.textContent())!.split(' / ')[0];
  await expect(replays.watchFrom).toHaveText(`Watch from ${previewAt}`);

  await replays.watchFrom.click();
  await expect(replays.controls).toBeVisible({ timeout: 30_000 });
  await expect(replays.log).toContainText('You are watching a replay of game #');
  await expect(replays.time).toHaveText(new RegExp(`^${previewAt} / \\d+:\\d\\d$`));

  await replays.open();
  await expect(replays.controls).toBeHidden();
  await topBarTab(hostPage, new RegExp(gameName)).click();
  await expect(replays.controls).toBeVisible();

  await replays.seekToFraction(0);
  await expect(replays.time).toHaveText(/^0:00 /);
  await expect(replays.log).not.toContainText('has joined the game.');

  await hostPage.getByRole('button', { name: /^Fast forward/ }).click();
  await hostPage.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(replays.log).toContainText('The game has been closed.', { timeout: 60_000 });
  await expect(hostPage.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await hostGame.rightPanel.getByRole('button', { name: /^close$/i }).click();
  await expect(replays.list).toBeVisible();

  await replays.selectMatch(gameName);
  await replays.detailAction('Delete from server').click();
  const confirm = hostPage.getByRole('dialog').filter({ hasText: 'Delete remote replay' });
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(replays.matchRow(gameName)).toHaveCount(0);
});
