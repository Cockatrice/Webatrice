import { expect, type Locator, type Page } from '@playwright/test';

// Page object for pre-game deck selection.
//
// The current app has TWO distinct deck-select surfaces (see
// GameLobby.tsx and DeckSelectDialog.tsx):
//
//   1. `GameLobby` — a full-page view (data-testid="game-lobby") rendered
//      by Game.tsx whenever the game exists but hasn't started. It
//      follows desktop's DeckViewContainer states:
//        • deck-select: a hidden `<input type="file" accept=".cod,...">`
//          behind the "Choose .cod file" button. Selecting a file
//          dispatches `deckSelect(gameId, { deck: xml })` directly.
//        • deck-loaded (after the server returns the deck): the deck view
//          plus "Unload deck", "Ready to start" (toggle, aria-pressed),
//          "Sideboard locked"/"Sideboard unlocked" (toggle) and, for the
//          host, "Force start".
//        • a "Leave game" button in both states.
//
//   2. `DeckSelectDialog` — an MUI modal that only mounts on the board
//      route without a game id in the URL (the revert-to-lobby edge case).
//      Exposes the pre-redo "Choose .cod file" / paste-XML / "Submit
//      Deck" / "Ready" / "Leave Game" trio inside a role="dialog".
//
// The POM prefers the lobby surface when present and falls back to the
// dialog for the revert-to-lobby edge case.

export class DeckSelectPage {
  constructor(private readonly page: Page) {}

  // MUI dialog (revert-to-lobby only). The `.DeckSelectDialog` class is
  // set on the StyledDialog root by DeckSelectDialog.tsx.
  get dialog(): Locator {
    return this.page.locator('.DeckSelectDialog');
  }

  get lobby(): Locator {
    return this.page.getByTestId('game-lobby');
  }

  get lobbyReadyButton(): Locator {
    return this.lobby.getByRole('button', { name: /^ready to start$/i });
  }

  get deckView(): Locator {
    return this.page.getByTestId('lobby-deck-view');
  }

  async openLobbyGameInfo(): Promise<Locator> {
    await this.lobby.getByRole('button', { name: /^game info$/i }).click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: /who can join/i });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async waitForOpen(): Promise<void> {
    await expect(this.lobby.or(this.dialog)).toBeVisible({ timeout: 30_000 });
  }

  // MUI-dialog XML paste-path. Only meaningful when the dialog surface
  // is active; in the lobby the user drives deckSelect from a file.
  async pasteDeck(xml: string): Promise<void> {
    const textarea = this.dialog.getByLabel(/deck list/i);
    await textarea.fill(xml);
  }

  // Picks the hidden <input type="file"> in whichever surface is
  // currently open. GameLobby's input has no `aria-label`, so scope to
  // the `accept=".cod"` filter on the input. The dialog's input HAS
  // `aria-label="deck file"`.
  async loadDeckFile(filePath: string): Promise<void> {
    if (await this.lobby.isVisible()) {
      const fileInput = this.lobby.locator('input[type="file"][accept*=".cod"]');
      await fileInput.setInputFiles(filePath);
      return;
    }
    const dialogInput = this.dialog.getByLabel(/deck file/i);
    await dialogInput.setInputFiles(filePath);
  }

  async submitDeck(): Promise<void> {
    if (await this.lobby.isVisible()) {
      await expect(this.lobbyReadyButton).toBeEnabled({ timeout: 15_000 });
      return;
    }
    const submit = this.dialog.getByRole('button', { name: /submit deck/i });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(this.dialog.locator('.deck-select-dialog__hash')).not.toContainText('—', {
      timeout: 15_000,
    });
  }

  async setReady(): Promise<void> {
    if (await this.lobby.isVisible()) {
      const unpressed = this.lobby.getByRole('button', { name: /^ready to start$/i, pressed: false });
      await expect(unpressed).toBeEnabled({ timeout: 15_000 });
      await unpressed.click();
      await expect(unpressed).toHaveCount(0, { timeout: 30_000 });
      return;
    }
    // Dialog surface (revert-to-lobby).
    const ready = this.dialog.getByRole('button', { name: /^ready$/i });
    await expect(ready).toBeEnabled({ timeout: 15_000 });
    await ready.click();
    await expect(ready).toBeHidden({ timeout: 15_000 });
  }

  async setUnready(): Promise<void> {
    if (await this.lobby.isVisible()) {
      const pressed = this.lobby.getByRole('button', { name: /^ready to start$/i, pressed: true });
      await expect(pressed).toBeEnabled();
      await pressed.click();
      return;
    }
    const unready = this.page.getByRole('button', { name: /^unready$/i });
    await expect(unready).toBeEnabled();
    await unready.click();
  }

  async unlockSideboard(): Promise<void> {
    const locked = this.lobby.getByRole('button', { name: /^sideboard locked$/i });
    await expect(locked).toBeEnabled({ timeout: 15_000 });
    await locked.click();
    await expect(this.lobby.getByRole('button', { name: /^sideboard unlocked$/i })).toBeVisible({ timeout: 15_000 });
  }

  async moveDeckCard(cardName: string, from: 'main' | 'side'): Promise<void> {
    const to = from === 'main' ? 'side' : 'main';
    const row = this.page.getByTestId(`lobby-deck-${from}`).getByRole('button', { name: new RegExp(cardName, 'i') });
    await expect(row).toBeEnabled({ timeout: 15_000 });
    await row.click();
    await expect(this.page.getByTestId(`lobby-deck-${to}`).getByText(cardName, { exact: true })).toBeVisible();
  }

  async forceStart(): Promise<void> {
    await this.lobby.getByRole('button', { name: /^force start$/i }).click();
    const confirm = this.page.getByRole('dialog').filter({ hasText: /force start/i });
    await confirm.getByRole('button', { name: /^yes$/i }).click();
  }

  // Leave the game from either surface. GameLobby has a "Leave game"
  // button; the MUI dialog has a "Leave Game" button. `leaveGame(gameId)`
  // is dispatched directly by both — no confirm dialog.
  async leaveGame(): Promise<void> {
    if (await this.lobby.isVisible()) {
      const leave = this.lobby.getByRole('button', { name: /^leave game$/i });
      await expect(leave).toBeEnabled({ timeout: 10_000 });
      await leave.click();
      return;
    }
    const leave = this.dialog.getByRole('button', { name: /leave game/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();
  }
}
