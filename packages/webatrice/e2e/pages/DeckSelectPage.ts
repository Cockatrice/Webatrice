import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the deck-select dialog (`DeckSelectDialog.tsx`). The
// dialog mounts inside `/game/:gameId` whenever the local player is
// seated, the game has not started, and they have not yet readied up.
//
// The dialog exposes:
//   - A hidden `<input type="file" aria-label="deck file">` triggered by
//     a "Choose .cod file" button.
//   - A `<textarea aria-label="deck list">` for pasted XML.
//   - "Submit Deck" + "Ready"/"Unready" buttons; Submit unlocks Ready
//     once the server returns a deck hash.

export class DeckSelectPage {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.locator('.DeckSelectDialog');
  }

  async waitForOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
  }

  async pasteDeck(xml: string): Promise<void> {
    const textarea = this.page.getByLabel(/deck list/i);
    await textarea.fill(xml);
  }

  async loadDeckFile(filePath: string): Promise<void> {
    const fileInput = this.page.getByLabel(/deck file/i);
    await fileInput.setInputFiles(filePath);
  }

  async submitDeck(): Promise<void> {
    const submit = this.page.getByRole('button', { name: /submit deck/i });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(this.page.locator('.deck-select-dialog__hash')).not.toContainText('—', {
      timeout: 15_000,
    });
  }

  async setReady(): Promise<void> {
    const ready = this.page.getByRole('button', { name: /^ready$/i });
    await expect(ready).toBeEnabled({ timeout: 15_000 });
    await ready.click();
    // The "Ready" locator stops matching either way: button toggles to
    // "Unready" (first-to-ready) or the dialog unmounts (second-to-ready).
    await expect(ready).toBeHidden({ timeout: 15_000 });
  }

  async setUnready(): Promise<void> {
    const unready = this.page.getByRole('button', { name: /^unready$/i });
    await expect(unready).toBeEnabled();
    await unready.click();
  }

  // Leave the game from the deck-select state. The dialog's own "Leave Game"
  // button is the only reachable exit while it is open — the LeftNav and the
  // in-game turn-controls are behind the MUI modal backdrop.
  async leaveGame(): Promise<void> {
    const leave = this.dialog.getByRole('button', { name: /leave game/i });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();
  }
}
