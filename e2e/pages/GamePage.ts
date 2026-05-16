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
    await expect(this.page.locator('.game__board-inner')).toBeVisible({ timeout: 30_000 });
    // MUI Dialog renders above the board and aria-hides its siblings, so
    // role-based locators inside turn-controls would return nothing while
    // DeckSelectDialog is still up. Gate on dialog dismissal (= game.started
    // && local readyStart per useGame.ts:85-91) before allowing callers to
    // drive endTurn/leaveGame/etc.
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
    const deckStack = this.page.locator('[data-testid^="zone-stack-deck"]').first();
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
    const board = this.page.locator('.game__board-inner');
    const card = board.locator('[data-testid="card-slot"]', { hasText: cardName }).first();
    await expect(card).toBeVisible();
    await card.dblclick();
  }

  async endTurn(): Promise<void> {
    // CSS locator + force click: DeckSelectDialog can reopen mid-game
    // (suspected webclient state-reset) and its aria-hidden subtree masks
    // role-based queries. CSS searches the DOM directly; force bypasses
    // the modal backdrop's pointer-events block.
    const passTurn = this.turnControls.locator('button', { hasText: /pass turn/i });
    await expect(passTurn).toBeEnabled({ timeout: 10_000 });
    await passTurn.click({ force: true });
  }

  async leaveGame(): Promise<void> {
    // Same CSS-locator + force-click rationale as endTurn — the in-game
    // Leave Game button must remain clickable even if DeckSelectDialog
    // reopens between endTurn and here.
    const leave = this.turnControls.locator('button', { hasText: /leave game/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click({ force: true });
    await expect(this.container).toBeHidden({ timeout: 30_000 });
  }

  async isSpectator(): Promise<boolean> {
    return (await this.spectatingTag.count()) > 0;
  }
}
