import { expect, type Locator, type Page } from '@playwright/test';

import { DeckSelectPage } from './DeckSelectPage';

// Page object for the game view (`/game/:gameId`). Covers the entry
// sequence (deck-select → ready → board) and a small set of in-game
// actions.
//
// The Tailwind rewrite dropped the old `turn-controls` panel entirely.
// The right rail is now `BattlefieldSidebar` (`data-testid="right-panel"`)
// which owns the Leave button (opens the "Leave this game?" ConfirmDialog)
// and hosts the spectator flag. There is no visible "Pass Turn" or
// in-panel "Leave Game" button anymore — leaving is: sidebar Leave →
// confirm.
//
// Production exposes these `data-testid`s that we rely on:
//   • `game-container`, `game-empty`
//   • `right-panel`, `spectating-tag`
//   • `card-slot`, `zone-stack-<zoneName>`, `hand-zone`,
//     `player-board-<playerId>`, `battlefield`, `battlefield-row-<row>`
//   • `card-context-menu`, `zone-context-menu`
//   • `zone-view-dialog`, `zone-view-card-<cardId>` (+ `.zone-view-dialog__header`)

export class GamePage {
  readonly deckSelect: DeckSelectPage;

  constructor(private readonly page: Page) {
    this.deckSelect = new DeckSelectPage(page);
  }

  get container(): Locator {
    return this.page.getByTestId('game-container');
  }

  get rightPanel(): Locator {
    return this.page.getByTestId('right-panel');
  }

  get spectatingTag(): Locator {
    return this.page.getByTestId('spectating-tag');
  }

  async waitForBoard(): Promise<void> {
    await expect(this.container).toBeVisible({ timeout: 60_000 });
    await expect(this.rightPanel).toBeVisible();
    await expect(this.page.locator('.game__board-grid')).toBeVisible({ timeout: 30_000 });
    // The lobby readies up and unmounts before the board renders. The
    // MUI DeckSelectDialog only shows in the "reverted to lobby" edge
    // case, so it's expected to stay hidden here.
    await expect(this.deckSelect.dialog).toBeHidden({ timeout: 30_000 });
  }

  async loadDeck(deckPath: string): Promise<void> {
    await this.deckSelect.waitForOpen();
    await this.deckSelect.loadDeckFile(deckPath);
    await this.deckSelect.submitDeck();
  }

  async loadDeckXml(xml: string): Promise<void> {
    await this.deckSelect.waitForOpen();
    await this.deckSelect.pasteDeck(xml);
    await this.deckSelect.submitDeck();
  }

  async setReady(): Promise<void> {
    await this.deckSelect.setReady();
  }

  async drawCard(): Promise<void> {
    const localBoard = this.localBoard;
    const deckStack = localBoard.locator('[data-testid="zone-stack-deck"]');
    await deckStack.click({ button: 'right' });
    const menu = this.page.getByTestId('zone-context-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: /draw a card/i }).click();
  }

  async playCardFromHand(cardName: string): Promise<void> {
    const handZone = this.page.getByTestId('hand-zone');
    await expect(handZone).toBeVisible();
    const card = handZone.locator('[data-testid="card-slot"]', { hasText: cardName }).first();
    await expect(card).toBeVisible();
    await card.dblclick();
  }

  async attackWith(cardName: string): Promise<void> {
    const board = this.page.locator('.game__board-grid');
    const card = board.locator('[data-testid="card-slot"]', { hasText: cardName }).first();
    await expect(card).toBeVisible();
    await card.dblclick();
  }

  // Leave the in-progress game via BattlefieldSidebar's Leave button.
  // That opens the "Leave this game?" ConfirmDialog (Game.tsx wires the
  // sidebar's onRequestLeave → dialogs.openLeaveConfirm), which we then
  // confirm to actually dispatch `leaveGame(gameId)`.
  async leaveGame(): Promise<void> {
    const leave = this.rightPanel.getByRole('button', { name: /^leave$/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();

    // ConfirmDialog is an MUI Dialog titled "Leave this game?" with a
    // destructive "Leave" button in DialogActions.
    const confirm = this.page.getByRole('dialog').filter({ hasText: /leave this game\?/i });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole('button', { name: /^leave$/i }).click();
    // After leaving: the local session drops out of the game. Route may
    // stay on `/game/:id` (empty state) or revert; the container is
    // what upstream tests assert against.
    await expect(this.container).toBeHidden({ timeout: 30_000 });
  }

  async isSpectator(): Promise<boolean> {
    return (await this.spectatingTag.count()) > 0;
  }

  // ---- Zones / cards / popups ----

  // The local player's board carries the `data-local-player` attribute
  // (PlayerBoard.tsx); opponents are the other `player-board-*` nodes.
  get localBoard(): Locator {
    return this.page.locator('[data-local-player]');
  }

  get opponentBoard(): Locator {
    return this.page.locator('[data-testid^="player-board-"]:not([data-local-player])').first();
  }

  zoneStack(zoneName: string, board: Locator = this.localBoard): Locator {
    return board.locator(`[data-testid="zone-stack-${zoneName}"]`);
  }

  // First battlefield row of a board — the drop target for a card
  // move/give. BattlefieldRow.tsx sets `data-testid="battlefield-row-<row>"`.
  battlefieldRow(board: Locator = this.localBoard): Locator {
    return board.locator('[data-testid^="battlefield-row-"]').first();
  }

  cardsOnBoard(board: Locator = this.localBoard): Locator {
    return board.locator('[data-testid="card-slot"]');
  }

  // Reads the numeric badge a ZoneStack renders (`.zone-stack__count`).
  async zoneStackCount(zoneName: string, board: Locator = this.localBoard): Promise<number> {
    const text = await this.zoneStack(zoneName, board).locator('.zone-stack__count').innerText();
    return Number(text.trim());
  }

  // ZoneViewDialog is a `div[role="dialog"]` whose aria-label is
  // "<player> <ZoneLabel> (<count>)", so match by the zone label text.
  zoneView(zoneLabel: RegExp): Locator {
    return this.page.getByRole('dialog', { name: zoneLabel });
  }

  zoneViewCards(dialog: Locator): Locator {
    return dialog.locator('[data-testid^="zone-view-card-"]');
  }

  // The draggable header of a zone-view popup (drag it to reposition
  // the popup).
  zoneViewHeader(dialog: Locator): Locator {
    return dialog.locator('.zone-view-dialog__header');
  }

  // Click the local zone stack to open its popup, then wait for the
  // dialog. For the local deck, left-click triggers a dumpZone in
  // addition to opening the popup (see useGameDialogs.handleZoneClick).
  async openZoneView(zoneName: string, zoneLabel: RegExp): Promise<Locator> {
    await this.zoneStack(zoneName).click();
    const dialog = this.zoneView(zoneLabel);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  // Right-click a card and pick a move item from its context menu.
  async moveViaCardMenu(card: Locator, item: RegExp): Promise<void> {
    await card.click({ button: 'right' });
    const menu = this.page.getByTestId('card-context-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: item }).click();
  }

  // Rubber-band select every card on the local battlefield. The
  // battlefield surface (`[data-testid="battlefield"]`,
  // `data-zone-box-select`) starts a box-select only on empty space —
  // a mousedown on a card begins a card interaction instead — so the
  // drag begins at the top-left corner and sweeps corner-to-corner
  // over the rows below.
  async boxSelectBattlefield(): Promise<void> {
    const battlefield = this.localBoard.locator('[data-testid="battlefield"]');
    const box = await battlefield.boundingBox();
    if (!box) {
      throw new Error('battlefield not visible');
    }
    const x0 = box.x + 4;
    const y0 = box.y + 4;
    const x1 = box.x + box.width - 4;
    const y1 = box.y + box.height - 4;
    await this.page.mouse.move(x0, y0);
    await this.page.mouse.down();
    await this.page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
    await this.page.mouse.move(x1, y1, { steps: 5 });
    await this.page.mouse.up();
  }
}
