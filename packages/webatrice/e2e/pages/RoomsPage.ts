import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the rooms list view (`/server`) and an opened Room
// (`/room/:roomId`). The same instance is used either side of the room
// transition; `openRoom` navigates and `waitForRoomList` confirms the list
// rendered.
//
// `RoomsList.tsx` renders a `<table>` whose body rows expose a `Join`
// button per row. Joining navigates to `/room/:roomId` (via the JOIN_ROOM
// redux effect in `Server.tsx`). Inside a Room, the GameSelector toolbar
// exposes `Create`, `Join`, `Join as Spectator`, etc.
//
// Game-create dialog (`CreateGameDialog.tsx`) is a real `<Dialog>` with a
// `Description` text field, `Password`, `Max players`, `Starting life
// total`, and a `Create` submit button. We expose a small subset.

export interface CreateGameOptions {
  password?: string;
  maxPlayers?: number;
  startingLifeTotal?: number;
  spectatorsAllowed?: boolean;
}

export class RoomsPage {
  constructor(private readonly page: Page) {}

  // AppShell uses MemoryRouter, so window.location never tracks app
  // navigation — page.waitForURL would hang. Wait on visible destination
  // content instead.
  async waitForRoomList(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /^name$/i })).toBeVisible({ timeout: 60_000 });
  }

  async openRoom(name: string): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: new RegExp(name, 'i') });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^join$/i }).click();
    await this.waitForGameList();
  }

  async waitForGameList(): Promise<void> {
    await expect(this.page.getByText(/games shown:/i)).toBeVisible({ timeout: 15_000 });
  }

  async createGame(description: string, options: CreateGameOptions = {}): Promise<void> {
    await this.page.getByRole('button', { name: /^create$/i }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/description/i).fill(description);
    if (options.password) {
      await dialog.getByLabel(/^password$/i).fill(options.password);
    }
    if (options.maxPlayers != null) {
      await dialog.getByLabel(/max players/i).fill(String(options.maxPlayers));
    }
    if (options.startingLifeTotal != null) {
      await dialog.getByLabel(/starting life total/i).fill(String(options.startingLifeTotal));
    }
    if (options.spectatorsAllowed === false) {
      await dialog.getByLabel(/allow spectators/i).uncheck();
    }

    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(this.page.getByTestId('game-container')).toBeVisible({ timeout: 30_000 });
  }

  gameRow(description: string): Locator {
    return this.page
      .locator('.games__row')
      .filter({ hasText: new RegExp(description, 'i') });
  }

  async joinGame(description: string, options: { spectator?: boolean } = {}): Promise<void> {
    const row = this.gameRow(description);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const action = options.spectator ? /join as spectator/i : /^join$/i;
    const btn = this.page.getByRole('button', { name: action });
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.click();
    await expect(this.page.getByTestId('game-container')).toBeVisible({ timeout: 30_000 });
  }

  async sendChatMessage(text: string): Promise<void> {
    const input = this.page.getByLabel(/^chat$/i);
    await input.fill(text);
    await this.page.getByRole('button', { name: /^send$/i }).click();
  }

  async leaveRoom(): Promise<void> {
    // MemoryRouter: `page.goto('/server')` would full-page-reload the SPA and
    // drop the WS connection. Click the LeftNav logo NavLink instead — it
    // routes to RouteEnum.SERVER via React Router without reloading.
    await this.page.getByAltText('logo').click();
    await this.waitForRoomList();
  }
}
