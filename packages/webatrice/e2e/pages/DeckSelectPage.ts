import { expect, type Locator, type Page } from '@playwright/test';

// Page object for pre-game deck selection.
//
// The current app has TWO distinct deck-select surfaces (see
// GameLobby.tsx and DeckSelectDialog.tsx):
//
//   1. `GameLobby` — a full-page Tailwind view rendered by Game.tsx
//      whenever the game exists but hasn't started. This is where every
//      player picks a deck the FIRST time. It exposes:
//        • A hidden `<input type="file" accept=".cod,...">` triggered
//          by the "Choose .cod file" button. Selecting a file directly
//          dispatches `deckSelect(gameId, { deck: xml })` — there is no
//          separate "Submit" step in this view.
//        • A "Ready up" button that toggles to "Unready" once pressed.
//        • A "Leave game" button.
//
//   2. `DeckSelectDialog` — an MUI modal that only mounts once the
//      game has been started and then reverts to lobby state (e.g. an
//      opponent leaves and drops the seat count below the minimum).
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

  // Full-page GameLobby's Ready button, unique to that surface.
  get lobbyReadyButton(): Locator {
    return this.page.getByRole('button', { name: /^(ready up|unready)$/i });
  }

  // Either surface counts as "open". Waits until the local player can
  // interact with either the lobby's Ready button or the fallback
  // dialog — whichever the app is currently showing.
  async waitForOpen(): Promise<void> {
    await expect(this.lobbyReadyButton.or(this.dialog)).toBeVisible({ timeout: 30_000 });
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
  // `aria-label="deck file"` — same input scoping picks it up too.
  async loadDeckFile(filePath: string): Promise<void> {
    // Prefer the lobby's Ready button as the "am I in the lobby?" signal;
    // the lobby's file input has no aria-label so we target it by its
    // `accept=".cod"` attribute (see GameLobby.tsx handleFilePicked).
    const lobbyOpen = await this.lobbyReadyButton.isVisible();
    if (lobbyOpen) {
      const fileInput = this.page.locator('input[type="file"][accept*=".cod"]');
      await fileInput.setInputFiles(filePath);
      return;
    }
    // Fallback: MUI dialog surface. Its <input> has aria-label="deck file".
    const dialogInput = this.dialog.getByLabel(/deck file/i);
    await dialogInput.setInputFiles(filePath);
  }

  // Only meaningful for the MUI dialog surface — the lobby has no
  // "Submit" step (file pick fires deckSelect immediately). No-op in
  // the lobby so callers can keep the pre-redo (loadDeckFile→submit)
  // sequence without branching.
  async submitDeck(): Promise<void> {
    if (await this.lobbyReadyButton.isVisible()) {
      // Lobby's deckSelect fires on file pick; nothing to submit here.
      // Just wait for the local player's deckHash to make Ready enabled.
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
    if (await this.lobbyReadyButton.isVisible()) {
      // Lobby: single toggle button labelled "Ready up" (unready state)
      // or "Unready" (ready state). The DOM node isn't recreated on
      // toggle — only its text changes — so the "Ready up" role-name
      // lookup stops matching once the label flips. Waiting for
      // `readyUp` to disappear signals either an in-place text swap or
      // the lobby unmounting entirely (second-to-ready → game starts).
      const readyUp = this.page.getByRole('button', { name: /^ready up$/i });
      await expect(readyUp).toBeEnabled({ timeout: 15_000 });
      await readyUp.click();
      await expect(readyUp).toHaveCount(0, { timeout: 30_000 });
      return;
    }
    // Dialog surface (revert-to-lobby).
    const ready = this.dialog.getByRole('button', { name: /^ready$/i });
    await expect(ready).toBeEnabled({ timeout: 15_000 });
    await ready.click();
    await expect(ready).toBeHidden({ timeout: 15_000 });
  }

  async setUnready(): Promise<void> {
    // Both surfaces expose an "Unready" affordance while ready.
    const unready = this.page.getByRole('button', { name: /^unready$/i });
    await expect(unready).toBeEnabled();
    await unready.click();
  }

  // Leave the game from either surface. GameLobby has a "Leave game"
  // button; the MUI dialog has a "Leave Game" button. `leaveGame(gameId)`
  // is dispatched directly by both — no confirm dialog.
  async leaveGame(): Promise<void> {
    if (await this.lobbyReadyButton.isVisible()) {
      const leave = this.page.getByRole('button', { name: /^leave game$/i });
      await expect(leave).toBeEnabled({ timeout: 10_000 });
      await leave.click();
      return;
    }
    const leave = this.dialog.getByRole('button', { name: /leave game/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();
  }
}
