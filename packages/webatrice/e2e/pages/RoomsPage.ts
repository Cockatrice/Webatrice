import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the rooms list view (`/server`) and an opened Room
// (`/room/:roomId`). The same instance is used either side of the room
// transition; `openRoom` navigates and `waitForRoomList` confirms the
// server view rendered.
//
// The Tailwind rewrite replaced the MUI `LeftNav` + rooms table +
// GameSelector with:
//   • TopBar   (a fixed top strip; pinned "Lobby" tab replaces the
//               LeftNav logo NavLink for jumping back to /server)
//   • RoomsList (Tailwind <table> under /server — column headers
//                Name/Description/Permissions/Players/Games, each row
//                has a single `Join`/`Open` button)
//   • GamesList (Tailwind <table> under /room/:id — rows are <tr>s
//                the user clicks to select, and a toolbar below
//                exposes Create / Join / Spectate / Judge buttons)
//
// The pre-redo `LeftNav-server__indicator` and `games__row` class hooks
// are gone; every selector below is grounded in the new DOM.

export interface CreateGameOptions {
  password?: string;
  maxPlayers?: number;
  startingLifeTotal?: number;
  spectatorsAllowed?: boolean;
}

export class RoomsPage {
  constructor(private readonly page: Page) {}

  // The Server (rooms) view is ready as soon as the RoomsList's <thead>
  // renders. `Name` is the first (unique) column header. Servatrice
  // auto-joins the "General room" for freshly-registered accounts, so
  // the caller usually lands on /room/:id (games list) instead of
  // /server (rooms list). Click the pinned Lobby tab first to force
  // the /server view before asserting.
  async waitForRoomList(): Promise<void> {
    const lobbyTab = this.page.getByRole('tab', { name: /^lobby$/i });
    await expect(lobbyTab).toBeVisible({ timeout: 30_000 });
    await lobbyTab.click();
    await expect(this.page.getByRole('columnheader', { name: /^name$/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  async openRoom(name: string): Promise<void> {
    const row = this.page.getByRole('row').filter({ hasText: new RegExp(name, 'i') });
    await expect(row).toBeVisible();
    // Each row has a single per-row button labelled "Join" (not-yet-
    // joined) or "Open" (already joined). Match both — order of test
    // runs shouldn't matter here.
    await row.getByRole('button', { name: /^(join|open)$/i }).click();
    await this.waitForGameList();
  }

  async waitForGameList(): Promise<void> {
    // GamesList header shows "Showing X / Y" (see GamesList.tsx) — this
    // caption is unique to the /room/:id view.
    await expect(this.page.getByText(/showing\s+\d+\s+\/\s+\d+/i)).toBeVisible({
      timeout: 15_000,
    });
  }

  async createGame(description: string, options: CreateGameOptions = {}): Promise<void> {
    // "Create" is a toolbar button inside the GamesList section.
    await this.page.getByRole('button', { name: /^create$/i }).click();
    // CreateGameDialog is still an MUI <Dialog> — role="dialog" with
    // a "Create Game" title. Match on that title so the Confirm dialog
    // spawn (also role="dialog") from other flows doesn't shadow it.
    const dialog = this.page.getByRole('dialog').filter({ hasText: /create game/i });
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
    // After Create the server replies with Event_GameJoined; the
    // GamesList's useReduxEffect routes to /game/:id. Wait for the
    // game-container testid to appear.
    await expect(this.page.getByTestId('game-container').or(this.page.getByRole('button', { name: /ready up/i }))).toBeVisible({
      timeout: 30_000,
    });
  }

  gameRow(description: string): Locator {
    // GamesList renders rows as plain <tr>s inside a <tbody>; select
    // via role=row filtered by description text.
    return this.page.getByRole('row').filter({ hasText: new RegExp(description, 'i') });
  }

  async joinGame(
    description: string,
    options: { spectator?: boolean; judge?: boolean; judgeSpectator?: boolean } = {},
  ): Promise<void> {
    const row = this.gameRow(description);
    await expect(row).toBeVisible({ timeout: 15_000 });
    // Selecting the row enables the toolbar's Join/Spectate buttons.
    await row.click();

    // Toolbar labels (GamesList.tsx):
    //   Join            → /^Join$/
    //   Spectate        → /^Spectate$/
    //   Judge           → /^Judge$/
    //   Judge · Spectate → /Judge.*Spectate/  (middle dot separator)
    const action = options.judgeSpectator
      ? /judge.*spectate/i
      : options.judge
        ? /^judge$/i
        : options.spectator
          ? /^spectate$/i
          : /^join$/i;
    const btn = this.page.getByRole('button', { name: action });
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.click();
    // Pre-start: GameLobby (Ready up button) mounts. Post-start:
    // GameBoard (game-container testid) mounts. Wait for either.
    await expect(
      this.page.getByTestId('game-container').or(this.page.getByRole('button', { name: /ready up/i })),
    ).toBeVisible({ timeout: 30_000 });
  }

  async sendChatMessage(text: string): Promise<void> {
    const input = this.page.getByLabel(/^chat$/i);
    await input.fill(text);
    await this.page.getByRole('button', { name: /^send$/i }).click();
  }

  async leaveRoom(): Promise<void> {
    // TopBar exposes a persistent "Lobby" tab that routes back to
    // /server without a full-page reload. Clicking it is the modern
    // equivalent of the pre-redo LeftNav logo NavLink.
    await this.page.getByRole('tab', { name: /^lobby$/i }).click();
    await this.waitForRoomList();
  }
}
