import { expect, type Locator, type Page } from '@playwright/test';

import { DeckSelectPage } from './DeckSelectPage';

// Page object for the game view (`/game/:gameId`). Covers the entry
// sequence (deck-select → ready → board) and a small set of in-game
// actions: draw a card from the library, play a card from hand by
// double-click (`Game.tsx` wires double-click on a CardSlot to
// `arrows.handleCardDoubleClick`, which plays from hand), end turn via
// the TurnControls "Pass Turn" button, and leave.
//
// Production exposes several `data-testid`s that we can rely on:
//   - `game-container`, `game-empty`
//   - `turn-controls`, `right-panel`, `spectating-tag`
//   - `card-slot`, `zone-stack-<zoneName>`, `hand-zone`,
//     `player-board-<playerId>`
//
// "Attack with" is intentionally a simplification: in Cockatrice attack
// is just toggling the card's `attacking` flag via right-click → Tap+set
// attacking, which the desktop client maps to a double-click on a
// battlefield creature. We expose `attackWith(cardName)` for parity with
// the planned API; it taps the named creature's slot via double-click on
// the battlefield.

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

  get turnControls(): Locator {
    return this.page.getByTestId('turn-controls');
  }

  get spectatingTag(): Locator {
    return this.page.getByTestId('spectating-tag');
  }

  async waitForBoard(): Promise<void> {
    await expect(this.container).toBeVisible({ timeout: 30_000 });
    await expect(this.rightPanel).toBeVisible();
    await expect(this.page.locator('.game__board-grid')).toBeVisible({ timeout: 30_000 });
    // DeckSelectDialog (a MUI modal) aria-hides its siblings while open, so
    // locators inside turn-controls match nothing until it is dismissed. Gate
    // on dismissal (= game.started && local readyStart, per useGame.ts
    // deckSelectOpen) before callers drive endTurn/leaveGame.
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
    const localBoard = this.page.locator('[data-local-player]');
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

  async endTurn(): Promise<void> {
    // Runs after waitForBoard: game started, DeckSelectDialog closed.
    const passTurn = this.turnControls.locator('button', { hasText: /pass turn/i });
    await expect(passTurn).toBeEnabled({ timeout: 10_000 });
    await passTurn.click();
  }

  async leaveGame(): Promise<void> {
    // In-game leave via the turn-controls panel. Valid only while the game is
    // still started (DeckSelectDialog closed). Once a started game drops to
    // one player it reverts to lobby state and DeckSelectDialog re-opens over
    // the board — the last remaining player must leave via LeftNavPage.
    const leave = this.turnControls.locator('button', { hasText: /leave game/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();
    await expect(this.container).toBeHidden({ timeout: 30_000 });
  }

  async isSpectator(): Promise<boolean> {
    return (await this.spectatingTag.count()) > 0;
  }

  // ---- Zones / cards / popups (added for the popup-drag + zone-move specs) ----

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

  // First battlefield row of a board — the drop target for a card move/give.
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

  // The ZoneViewDialog is a role="dialog" whose aria-label is
  // "<player> <ZoneLabel> (<count>)", so match by the zone label text.
  zoneView(zoneLabel: RegExp): Locator {
    return this.page.getByRole('dialog', { name: zoneLabel });
  }

  zoneViewCards(dialog: Locator): Locator {
    return dialog.locator('[data-testid^="zone-view-card-"]');
  }

  // Click the local zone stack to open its popup, then wait for the dialog.
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
}
