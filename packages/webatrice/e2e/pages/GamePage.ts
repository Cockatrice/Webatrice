import { expect, type Locator, type Page } from '@playwright/test';

import { DeckSelectPage } from './DeckSelectPage';
import { dragTo } from '../fixtures/dnd';
import { t } from '../fixtures/i18n';

// Page object for the game view (`/game/:gameId`). Covers the entry
// sequence (deck-select → ready → board) and a small set of in-game
// actions.
//
// DOM CONTRACT (the PlayerBoard seat):
//   • Board scaffolding still exposes `data-testid`s:
//       - `game-container`, `game-empty` (Game.tsx)
//       - `right-panel`, `spectating-tag` (GameDock.tsx: the right dock,
//         tabs `[data-dock-tab]` "log" (Chat & log), "players" (with the
//         game menu) and "spectators")
//       - `board-tray-seat` (BoardTray.tsx: the local hand, with its
//         Library / Graveyard / Exile piles and quick actions)
//       - `.game__board-grid`, `.game__board-cell`,
//         `.game__board-cell--mirrored` (GameBoardCell.tsx)
//   • Per-seat rendering is PlayerBoard and its regions. It does NOT emit
//     `data-testid`. Selectable structure:
//       - `.game__board-cell` — one per seat. `--mirrored` modifier is
//         absent ONLY on the local seat (useGameBoardLayout guarantees
//         `mirrored=false` iff local seat, in every N-player layout).
//       - Zone piles (Library / Graveyard / Exile) expose a translated
//         accessible name containing the count and optional top card. The
//         local seat's piles live in the tray, opponents' inside their
//         `.game__board-cell`; they are the entry point for the pile
//         context menu (right-click) and drag-to-move (pointerdown).
//       - Battlefield scroll container is `[data-battlefield-owner]`;
//         cards are `[data-card][data-zone="battlefield"]`, and (tray)
//         hand cards are `[data-card][data-zone="hand"]`. Card DOM wraps a
//         `<Card>` whose outer div carries `title="{cardName}"`.
//       - The seat context menus (card, pile, hand, player) are the
//         shared `Menu`: portal-rendered `[role="menu"]`, one per open
//         level, with `role="menuitem"` buttons.
//   • Pile-view popup: opening the Library / Graveyard / Exile view
//     from the seat's context menu mounts a ZoneViewDialog, which
//     lists the zone through ZoneViewPanel. That renders an `<h2>` with
//     the pile title ("Graveyard — <name>", "Exile — <name>", or
//     "<name>'s library") and cards keyed by `[data-card][data-card-id]`.
//
export type PileZone = 'deck' | 'grave' | 'rfg';
export type CardMoveZone = Exclude<PileZone, 'deck'> | 'hand' | 'table';

const PILE_LABEL_KEYS: Record<PileZone, string> = {
  deck: 'ZoneStack.library',
  grave: 'ZoneStack.graveyard',
  rfg: 'ZoneStack.exile',
};

const CARD_MOVE_LABEL_KEYS: Record<CardMoveZone, string> = {
  grave: 'ZoneLabel.title.grave',
  rfg: 'ZoneLabel.title.rfg',
  hand: 'ZoneLabel.title.hand',
  table: 'CardMenu.table',
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class GamePage {
  readonly deckSelect: DeckSelectPage;

  constructor(private readonly page: Page) {
    this.deckSelect = new DeckSelectPage(page);
  }

  // ---- Top-level board scaffolding (unchanged testids) ----

  get container(): Locator {
    return this.page.getByTestId('game-container');
  }

  get rightPanel(): Locator {
    return this.page.getByTestId('right-panel');
  }

  get spectatingTag(): Locator {
    return this.page.getByTestId('spectating-tag');
  }

  dockTab(tab: 'log' | 'players' | 'spectators'): Locator {
    return this.rightPanel.locator(`[data-dock-tab="${tab}"]`);
  }

  async selectDockTab(tab: 'log' | 'players' | 'spectators'): Promise<void> {
    await this.dockTab(tab).click();
    await expect(this.dockTab(tab)).toHaveAttribute('aria-selected', 'true');
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

  // ---- Per-seat locators ----

  // Local seat: `useGameBoardLayout` guarantees `mirrored=false` iff
  // this cell is the local player's seat, in every N-player layout
  // (see useGameBoardLayout.spec.ts). GameBoardCell only adds the
  // `--mirrored` modifier when `cell.mirrored` is true, so the absence
  // of the modifier uniquely identifies the local seat.
  get localBoard(): Locator {
    return this.page.locator('.game__board-cell:not(.game__board-cell--mirrored)');
  }

  // First opponent seat (`.game__board-cell--mirrored`). Sufficient for
  // 2-player specs; multi-opponent specs would want a targeted variant.
  get opponentBoard(): Locator {
    return this.page.locator('.game__board-cell.game__board-cell--mirrored').first();
  }

  // The tray under the board: the card preview pane, then the local
  // seat's hand, piles and quick actions (portalled into `localTray`).
  get tray(): Locator {
    return this.page.getByTestId('board-tray');
  }

  get localTray(): Locator {
    return this.page.getByTestId('board-tray-seat');
  }

  // ---- Card actions ----

  async drawCard(): Promise<void> {
    const deckStack = this.zoneStack('deck');
    await deckStack.click({ button: 'right' });
    await this.clickContextMenuItem(t('ShortcutsTab.action.game.drawCard'));
  }

  async playCardFromHand(cardName: string): Promise<void> {
    // Hand cards are `[data-card][data-zone="hand"]` whose inner Card
    // carries `title="{cardName}"`. Filter by that title to pick the
    // right one — hand cards have no direct text descendant.
    const handCard = this.handCard(cardName);
    await expect(handCard).toBeVisible();
    await handCard.dblclick();
  }

  async attackWith(cardName: string): Promise<void> {
    const card = this.localBoard
      .locator('[data-card][data-zone="battlefield"]')
      .filter({ has: this.page.locator(`[title="${cardName}"]`) })
      .first();
    await expect(card).toBeVisible();
    await card.dblclick();
  }

  // End turn via keyboard shortcut. useGameShortcuts binds
  // `game.endTurn` to Ctrl+Enter (defaults.ts), matching Cockatrice
  // desktop's aNextTurn. There's no visible "End Turn" button in the
  // Tailwind rewrite — the phase track pill is display-only.
  async endTurn(): Promise<void> {
    await this.page.keyboard.press('Control+Enter');
  }

  // Leave the in-progress game via the dock's Leave button. That opens
  // the "Leave game" ConfirmDialog (Game.tsx wires the dock's
  // onRequestLeave → dialogs.openLeaveConfirm), which we then confirm to
  // actually dispatch `leaveGame(gameId)`.
  async leaveGame(): Promise<void> {
    const leave = this.rightPanel.getByRole('button', {
      name: t('GameDock.leave'),
      exact: true,
    });
    await expect(leave).toBeEnabled({ timeout: 10_000 });
    await leave.click();

    const confirm = this.page.getByRole('dialog', {
      name: t('ShortcutsTab.action.game.leaveGame'),
    });
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.getByRole('button', {
      name: t('GameLink.yes'),
      exact: true,
    }).click();
    // After leaving: the local session drops out of the game. Route may
    // stay on `/game/:id` (empty state) or revert; the container is
    // what upstream tests assert against.
    await expect(this.container).toBeHidden({ timeout: 30_000 });
  }

  async clickGameMenuItem(key: `GameMenu.item.${string}`): Promise<void> {
    const menuName = t('GameMenu.button');
    await this.selectDockTab('players');
    await this.rightPanel.getByRole('button', { name: menuName, exact: true }).click();
    const menu = this.page.getByRole('menu', { name: menuName, exact: true });
    const item = menu.getByRole('menuitem', { name: t(key), exact: true });
    await expect(item).toBeEnabled({ timeout: 10_000 });
    await item.click();
    await expect(menu).toBeHidden();
    await this.selectDockTab('log');
  }

  async canAdvancePhase(): Promise<boolean> {
    const button = this.page.getByTestId('phase-bar').locator('button[data-phase="1"]');
    return (await button.getAttribute('aria-disabled')) !== 'true';
  }

  logLine(text: string | RegExp): Locator {
    return this.rightPanel.getByText(text);
  }

  async isSpectator(): Promise<boolean> {
    return (await this.spectatingTag.count()) > 0;
  }

  // ---- Zones / cards / popups ----

  zoneStack(zoneName: PileZone, board: Locator = this.localTray): Locator {
    const zone = t(PILE_LABEL_KEYS[zoneName]);
    return board.getByLabel(new RegExp(`^${escapeRegex(zone)},`)).first();
  }

  // Battlefield row 0 for the given seat. Rows aren't individually
  // addressable after the seat rewrite, but `BattlefieldSlotOverlay`
  // renders one absolutely-positioned `<div>` per snap slot (see the
  // overlay in Battlefield.tsx). Return the first slot div (row 0, col 0
  // in display coords) so `.boundingBox()` lands on a card-sized rect
  // instead of the whole play area — matches the intent of the legacy
  // `[data-testid="battlefield-row-0"]` selector so specs computing
  // drop points from `battlefieldRow().boundingBox()` still land on a
  // valid, popup-free part of the surface. Drops on this rect route
  // into the battlefield via dnd-kit's rectIntersection.
  battlefieldRow(board: Locator = this.localBoard): Locator {
    return board.locator('[data-battlefield-content] > div:first-child > div').first();
  }

  cardsOnBoard(board: Locator = this.localBoard): Locator {
    return board.locator('[data-card][data-zone="battlefield"]');
  }

  async zoneStackCount(zoneName: PileZone, board: Locator = this.localTray): Promise<number> {
    return Number(await this.zoneStack(zoneName, board).getAttribute('data-pile-count'));
  }

  // Pile-view popup — ZoneViewPanel. Not a `role="dialog"` node,
  // so we anchor on its `<h2>` (unique text: "<player>'s library" for
  // deck, "Graveyard — <name>" / "Exile — <name>" for grave/exile) and
  // walk up to the nearest `.resize.overflow-hidden` ancestor (the
  // outer panel — resize handle is unique to the pile-view dialog).
  // Returning the panel div lets callers `.boundingBox()` and locate
  // descendants (cards, header, close button).
  zoneView(zoneLabel: RegExp): Locator {
    return this.page
      .getByRole('heading', { name: zoneLabel })
      .locator('xpath=ancestor::div[contains(@class, "resize")][1]');
  }

  zoneViewCards(dialog: Locator): Locator {
    return dialog.locator('[data-card][data-card-id]');
  }

  // Draggable header of a pile-view popup (drag it to reposition).
  // ZoneViewPanel's header is the first-child div under the
  // dialog panel; it hosts the pile title `<h2>` and owns the
  // pointerdown drag handler.
  zoneViewHeader(dialog: Locator): Locator {
    return dialog.locator('> div').first();
  }

  // Open a pile view. Left-click on the seat's pile does nothing
  // (LargeZoneBox / CardBackZone have no onClick — pointerdown starts
  // a drag), so we open via right-click → "View library" / "View
  // graveyard" / "View exile", matching Cockatrice's pile-menu path.
  //
  // For the library ("deck") flow, "View library" fires
  // Command_DumpZone and opens the dialog synchronously; the dialog
  // is visible before the server response arrives, so the initial
  // card list is empty. Wait for at least one card to land before
  // returning so the caller's `zoneViewCards(...).count()` doesn't
  // race the wire. Graveyard / exile have pre-populated Redux
  // contents (no wire needed), so callers that open an empty pile
  // are fine — only wait when the caller-supplied label is `library`.
  async openZoneView(zoneName: PileZone, zoneLabel: RegExp): Promise<Locator> {
    const openItem = t({
      deck: 'ShortcutsTab.action.game.viewLibrary',
      grave: 'ShortcutsTab.action.game.viewGraveyard',
      rfg: 'ZoneMenu.viewExile',
    }[zoneName]);
    await this.zoneStack(zoneName).click({ button: 'right' });
    await this.clickContextMenuItem(openItem);
    const dialog = this.zoneView(zoneLabel);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    if (zoneName === 'deck') {
      await expect
        .poll(() => this.zoneViewCards(dialog).count(), { timeout: 15_000 })
        .toBeGreaterThan(0);
    }
    return dialog;
  }

  async moveViaCardMenu(card: Locator, target: CardMoveZone): Promise<void> {
    const zone = await card.getAttribute('data-zone');

    // Cards inside a pile-view popup (`data-zone` is null
    // because the popup card wrapper doesn't set `data-zone`) also
    // lack move items in their context menu — the pile card menu only
    // has Draw arrow / Clone / Select. Emulate by dragging onto the
    // target pile (or the local hand pile via the hand button).
    const isPileCard = zone == null;
    const isHandSource = zone === 'hand';
    if (isHandSource || isPileCard) {
      if (target === 'grave' || target === 'rfg') {
        await dragTo(this.page, card, this.zoneStack(target));
        return;
      }
      if (target === 'hand') {
        const handButton = this.localTray.getByRole('button', {
          name: new RegExp(`^${escapeRegex(t('HandZone.menu'))} `),
        }).first();
        await dragTo(this.page, card, handButton);
        return;
      }
    }

    await card.click({ button: 'right' });
    await this.hoverCardContextMenuItem(t('CardMenu.moveTo'));
    await this.clickCardContextMenuItem(t(CARD_MOVE_LABEL_KEYS[target]));
  }

  handCard(cardName: string): Locator {
    return this.localTray
      .locator('[data-card][data-zone="hand"]')
      .filter({ has: this.page.locator(`[title="${cardName}"]`) })
      .first();
  }

  async chooseCardMenuPath(card: Locator, ...path: string[]): Promise<void> {
    await card.click({ button: 'right' });
    for (const [i, label] of path.entries()) {
      if (i < path.length - 1) {
        const menu = this.page.locator('[role="menu"]').last();
        await expect(menu).toBeVisible({ timeout: 5_000 });
        const before = await this.page.locator('[role="menu"]').count();
        await this.menuItemButton(menu, label).first().hover();
        await expect
          .poll(() => this.page.locator('[role="menu"]').count(), { timeout: 5_000 })
          .toBeGreaterThan(before);
      } else {
        await this.clickCardContextMenuItem(label);
      }
    }
  }

  // Rubber-band select every card on the local battlefield. The
  // battlefield area is `[data-battlefield-owner]`; pointerdown on
  // empty space starts the seat's marquee (useSeatMarquee skips a press
  // on a `[data-card]`). Drag corner-to-corner over
  // the battlefield content — use the whole battlefield rect, not the
  // per-row locator from `battlefieldRow`.
  async boxSelectBattlefield(): Promise<void> {
    const battlefield = this.localBoard.locator('[data-battlefield-owner]').first();
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

  private menuItemButton(menu: Locator, name: string): Locator {
    return menu.getByRole('menuitem', { name, exact: true });
  }

  private async clickContextMenuItem(name: string): Promise<void> {
    const menu = this.page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await this.menuItemButton(menu, name).first().click();
  }

  private async clickCardContextMenuItem(name: string): Promise<void> {
    // Card menu opens as a portal and a submenu is a SECOND portal.
    // When clicking a leaf we want to hit the most-recently-opened one
    // (submenu wins over parent), so grab `.last()`.
    const menu = this.page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await this.menuItemButton(menu, name).first().click();
  }

  // Hover a card-menu item to open its submenu (the seat opens
  // submenus after a pointer rest — see Menu's MenuSubmenu). Waits
  // for the submenu portal to mount so the next click hits its leaf.
  private async hoverCardContextMenuItem(name: string): Promise<void> {
    const parentMenu = this.page.locator('[role="menu"]').first();
    await expect(parentMenu).toBeVisible({ timeout: 5_000 });
    const before = await this.page.locator('[role="menu"]').count();
    await this.menuItemButton(parentMenu, name).first().hover();
    await expect
      .poll(() => this.page.locator('[role="menu"]').count(), { timeout: 5_000 })
      .toBeGreaterThan(before);
  }
}
