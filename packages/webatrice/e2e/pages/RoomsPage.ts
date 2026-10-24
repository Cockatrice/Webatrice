import { expect, type Locator, type Page } from '@playwright/test';

import { homeLink } from './TopBar';

// Page object for the Home view (`/server`, reached from the rail's logo
// link) with its Rooms panel, and an opened Room (`/room/:roomId`). The
// same instance is used either side of the room transition.
//
//   • Rooms panel (a section under the "Rooms" heading on Home; each
//                  room is a list item with an "Open <room>" or
//                  "Join <room>" button)
//   • GamesList (role=grid under /room/:id — rows are focusable
//                role=rows the user clicks or arrows to select, Enter
//                joins, every row has its own Spectate / Join buttons
//                and a More menu with the judge options, and a
//                quick-filter bar sits above the grid)
//   • Create game (a button in the room header that opens the
//                  preset dialog "Create a game in <room>", with its
//                  Advanced section open)

export interface CreateGameOptions {
  password?: string;
  maxPlayers?: number;
  startingLifeTotal?: number;
  spectatorsAllowed?: boolean;
}

export class RoomsPage {
  constructor(private readonly page: Page) {}

  get roomsPanel(): Locator {
    return this.page
      .getByRole('main')
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: /^rooms$/i, level: 2 }) });
  }

  // Servatrice auto-joins the "General room" for freshly-registered
  // accounts; that opens the room without switching to it, so login lands
  // on Home. The rail's logo also brings Home back from a room or game.
  async waitForRoomList(): Promise<void> {
    const home = homeLink(this.page);
    await expect(home).toBeVisible({ timeout: 30_000 });
    await home.click();
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(this.roomsPanel.getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });
  }

  async openRoom(name: string): Promise<void> {
    await this.roomsPanel.getByRole('button', { name: new RegExp(`^(join|open) ${name}$`, 'i') }).click();
    await this.waitForGameList();
  }

  // The quick-filter bar shows "X of Y games" (QuickFilterBar.tsx) —
  // this caption is unique to the /room/:id view.
  get gameListCaption(): Locator {
    return this.page.getByText(/^\d+\s+of\s+\d+\s+games?$/i);
  }

  async waitForGameList(): Promise<void> {
    await expect(this.gameListCaption).toBeVisible({
      timeout: 15_000,
    });
  }

  async createGame(description: string, options: CreateGameOptions = {}): Promise<void> {
    await this.page.getByRole('main').getByRole('button', { name: /^create game$/i }).first().click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: /create a game in/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^description$/i).fill(description);
    if (options.password) {
      await dialog.getByLabel(/^password/i).fill(options.password);
    }
    await expect(dialog.getByRole('button', { name: /^advanced/i })).toHaveAttribute('aria-expanded', 'true');
    if (options.maxPlayers != null) {
      await dialog.getByLabel(/^seats$/i).fill(String(options.maxPlayers));
    }
    if (options.startingLifeTotal != null) {
      await dialog.getByLabel(/^starting life$/i).fill(String(options.startingLifeTotal));
    }
    if (options.spectatorsAllowed === false) {
      const canWatch = dialog.getByRole('switch', { name: /^can watch$/i });
      await canWatch.click();
      await expect(canWatch).toHaveAttribute('aria-checked', 'false');
    }

    await dialog.getByRole('button', { name: /^create game$/i }).click();
    // After Create the server replies with Event_GameJoined and the room
    // routes to /game/:id: the lobby before start, the board after.
    await expect(this.page.getByTestId('game-container').or(this.page.getByTestId('game-lobby'))).toBeVisible({
      timeout: 30_000,
    });
  }

  gameRow(description: string): Locator {
    return this.page.getByRole('row').filter({ hasText: new RegExp(description, 'i') });
  }

  async joinGame(
    description: string,
    options: { spectator?: boolean; judge?: boolean; judgeSpectator?: boolean } = {},
  ): Promise<void> {
    const row = this.gameRow(description);
    await expect(row).toBeVisible({ timeout: 15_000 });
    if (options.judge || options.judgeSpectator) {
      await row.getByRole('button', { name: /^more for /i }).click();
      const item = this.page.getByRole('menuitem', { name: options.judgeSpectator ? /spectate as judge/i : /join as judge/i });
      await expect(item).toBeEnabled({ timeout: 10_000 });
      await item.click();
    } else {
      const btn = row.getByRole('button', { name: options.spectator ? /^spectate /i : /^join /i });
      await expect(btn).toBeEnabled({ timeout: 10_000 });
      await btn.click();
    }
    // Pre-start: GameLobby (game-lobby testid) mounts. Post-start:
    // GameBoard (game-container testid) mounts. Wait for either.
    await expect(
      this.page.getByTestId('game-container').or(this.page.getByTestId('game-lobby')),
    ).toBeVisible({ timeout: 30_000 });
  }

  // The room's people column folds "Everyone in <room>" behind a preview;
  // searching opens every section that has a match.
  async findPerson(name: string): Promise<Locator> {
    await this.page.getByRole('searchbox', { name: 'Find a player' }).fill(name);
    const person = this.page
      .getByRole('list', { name: /^People in / })
      .getByRole('link', { name: new RegExp(`^${name}( |$)`) })
      .first();
    await expect(person).toBeVisible({ timeout: 15_000 });
    return person;
  }

  async sendChatMessage(text: string): Promise<void> {
    const input = this.page.getByLabel(/^chat$/i);
    await input.fill(text);
    await this.page.getByRole('button', { name: /^send$/i }).click();
  }

  async leaveRoom(): Promise<void> {
    await this.waitForRoomList();
  }
}
