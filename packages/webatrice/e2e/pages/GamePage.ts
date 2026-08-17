import { expect, type Locator, type Page } from '@playwright/test';

import { DeckSelectPage } from './DeckSelectPage';
import { dragTo } from '../fixtures/dnd';

// Page object for the game view (`/game/:gameId`). Covers the entry
// sequence (deck-select → ready → board) and a small set of in-game
// actions.
//
// DOM CONTRACT (as of the PlayerBox monolith rewrite):
//   • Board scaffolding still exposes `data-testid`s:
//       - `game-container`, `game-empty` (Game.tsx)
//       - `right-panel`, `spectating-tag` (BattlefieldSidebar.tsx)
//       - `.game__board-grid`, `.game__board-cell`,
//         `.game__board-cell--mirrored` (GameBoardCell.tsx)
//   • Per-seat rendering is the PlayerBox monolith. It does NOT emit
//     `data-testid`. Selectable structure:
//       - `.game__board-cell` — one per seat. `--mirrored` modifier is
//         absent ONLY on the local seat (useGameBoardLayout guarantees
//         `mirrored=false` iff local seat, in every N-player layout).
//       - Zone piles (Library / Graveyard / Exile) are `<div>`s carrying
//         `title="Library — 60"` (or with " (top: X)" suffix). They live
//         inside the `.game__board-cell` — one per seat — and are the
//         entry point for the pile context menu (right-click) and
//         drag-to-move (pointerdown).
//       - Battlefield scroll container is `[data-battlefield-owner]`;
//         cards are `[data-card][data-zone="battlefield"]`, and hand
//         cards are `[data-card][data-zone="hand"]`. Card DOM wraps a
//         `<Card>` whose outer div carries `title="{cardName}"`.
//       - PlayerBox context menus are portal-rendered `<div>`s tagged
//         `[data-card-context-menu]` (per-card) or `[data-context-menu]`
//         (per-zone/player). Items are plain `<button>` elements (no
//         `role="menuitem"`).
//   • Pile-view popup: opening the Library / Graveyard / Exile view
//     from PlayerBox's context menu mounts `LibrarySearchDialog`, not
//     the OG ZoneViewDialog. LibrarySearchDialog renders an `<h2>` with
//     the pile title ("Graveyard — <name>", "Exile — <name>", or
//     "<name>'s library") and cards keyed by `[data-card][data-card-id]`.
//
// Two intent-preserving shims: `zoneName` values like `'deck' | 'grave'
// | 'rfg'` (Cockatrice wire names, still passed by specs) are mapped to
// human titles for pile lookups. Card menu items like "Send to
// Graveyard" (spec regex) are mapped to the "Move to → Graveyard"
// submenu path.

// Map `zoneName` (spec-level, Cockatrice wire strings) → PlayerBox pile
// title prefix. PlayerBox draws the pile as a `<div title="Library — N">`
// (with an optional " (top: X)" suffix when a face-up top card is
// showing). Anchoring on the `— ` separator keeps us safe against both
// count changes and the top-card suffix.
const ZONE_TITLE_PREFIX: Record<string, string> = {
  deck: 'Library — ',
  grave: 'Graveyard — ',
  rfg: 'Exile — ',
};

// Card-menu translation for spec regexes like `/send to graveyard/i`.
// PlayerBox's buildCardContextMenu places these under "Move to →
// {Graveyard|Hand|Exile|Table|Top of library in random order|...}".
// The POM opens the submenu when the requested item lives under it.
interface MoveViaSubmenu {
  submenu: RegExp;
  item: RegExp;
}
function resolveCardMenuItem(request: RegExp): RegExp | MoveViaSubmenu {
  const src = request.source.toLowerCase();
  // Card menu items live under "Move to → {Graveyard|Hand|Exile|Table|
  // Top of library ...}". The label-span filter used by
  // `menuItemButton` isolates each item's label, so an exact match on
  // the label works cleanly.
  if (src.includes('send to graveyard')) {
    return { submenu: /^move to$/i, item: /^graveyard$/i };
  }
  if (src.includes('send to hand')) {
    return { submenu: /^move to$/i, item: /^hand$/i };
  }
  if (src.includes('send to exile')) {
    return { submenu: /^move to$/i, item: /^exile$/i };
  }
  if (src.includes('send to battlefield') || src.includes('send to table')) {
    return { submenu: /^move to$/i, item: /^table$/i };
  }
  return request;
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

  // ---- Card actions ----

  async drawCard(): Promise<void> {
    // PlayerBox library pile: right-click → "Draw card" (ports the
    // Cockatrice LibraryMenu order). No `zone-context-menu` testid on
    // the new menu — it's a plain `<div data-context-menu>` portal.
    const deckStack = this.zoneStack('deck');
    await deckStack.click({ button: 'right' });
    // Label span contains just "Draw card" (no shortcut); anchor
    // exactly so "Draw cards..." doesn't win.
    await this.clickContextMenuItem(/^Draw card$/i);
  }

  async playCardFromHand(cardName: string): Promise<void> {
    // Hand cards are `[data-card][data-zone="hand"]` whose inner Card
    // carries `title="{cardName}"`. Filter by that title to pick the
    // right one — hand cards have no direct text descendant.
    const handCard = this.localBoard
      .locator('[data-card][data-zone="hand"]')
      .filter({ has: this.page.locator(`[title="${cardName}"]`) })
      .first();
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

  // End turn via keyboard shortcut. PlayerBox / useGameShortcuts binds
  // `game.endTurn` to Ctrl+Enter (defaults.ts), matching Cockatrice
  // desktop's aNextTurn. There's no visible "End Turn" button in the
  // Tailwind rewrite — the phase track pill is display-only.
  async endTurn(): Promise<void> {
    await this.page.keyboard.press('Control+Enter');
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

  // Locate a pile (library / graveyard / exile) by its `title` attribute.
  // PlayerBox's CardBackZone / LargeZoneBox both set
  // `title="{Label} — {count}"` (with an optional " (top: X)" suffix),
  // so anchoring on the shared prefix picks the pile regardless of the
  // current count or top-card state.
  zoneStack(zoneName: string, board: Locator = this.localBoard): Locator {
    const prefix = ZONE_TITLE_PREFIX[zoneName];
    if (!prefix) {
      throw new Error(`Unknown zoneName '${zoneName}' — expected 'deck' | 'grave' | 'rfg'.`);
    }
    return board.locator(`[title^="${prefix}"]`).first();
  }

  // Battlefield row 0 for the given seat. Rows aren't individually
  // addressable after the PlayerBox rewrite, but `BattlefieldSlotOverlay`
  // renders one absolutely-positioned `<div>` per snap slot (see the
  // overlay in PlayerBox.tsx). Return the first slot div (row 0, col 0
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

  // Parse the numeric count from the pile's title attribute
  // ("Library — 60" / "Graveyard — 2 (top: Forest)").
  async zoneStackCount(zoneName: string, board: Locator = this.localBoard): Promise<number> {
    const title = await this.zoneStack(zoneName, board).getAttribute('title');
    if (title == null) return 0;
    // Grab the digit(s) right after " — " — accepts both bare
    // "Label — N" and "Label — N (top: ...)".
    const match = title.match(/—\s*(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  // Pile-view popup — LibrarySearchDialog. Not a `role="dialog"` node,
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
  // LibrarySearchDialog's header is the first-child div under the
  // dialog panel; it hosts the pile title `<h2>` and owns the
  // pointerdown drag handler.
  zoneViewHeader(dialog: Locator): Locator {
    return dialog.locator('> div').first();
  }

  // Open a pile view. Left-click on the PlayerBox pile does nothing
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
  async openZoneView(zoneName: string, zoneLabel: RegExp): Promise<Locator> {
    const openItem: RegExp = zoneName === 'deck'
      ? /^view library$/i
      : zoneName === 'grave'
        ? /^view graveyard$/i
        : zoneName === 'rfg'
          ? /^view exile$/i
          : /^view/i;
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

  // Right-click a card and pick a move item from its context menu.
  // The card context menu is a portal `<div data-card-context-menu>`
  // whose items are plain `<button>` elements — no MUI menuitem role.
  // Handles the "Move to" submenu path: specs pass regexes like
  // `/send to graveyard/i` that resolve to "Move to → Graveyard".
  //
  // Hand-source shim: PlayerBox's hand row does NOT wire per-card
  // right-clicks (right-clicking a hand card opens the HAND-level menu
  // — View hand, Sort hand, etc. — not a card-move menu). Callers that
  // ask for "send to graveyard" on a hand card actually mean "get this
  // card into the graveyard"; the interaction the user would perform
  // now is drag-onto-graveyard, so we do that in POM.
  async moveViaCardMenu(card: Locator, item: RegExp): Promise<void> {
    const zone = await card.getAttribute('data-zone');
    const resolved = resolveCardMenuItem(item);

    // Shim #1: hand cards no longer expose a per-card context menu
    // in PlayerBox (right-click bubbles to the HAND-level menu, which
    // only has View hand / Sort hand). Emulate the intended move by
    // dragging onto the target pile.
    //
    // Shim #2: cards inside a pile-view popup (`data-zone` is null
    // because the popup card wrapper doesn't set `data-zone`) also
    // lack move items in their context menu — the pile card menu only
    // has Draw arrow / Clone / Select. Emulate by dragging onto the
    // target pile (or the local hand pile via the hand button).
    if (!(resolved instanceof RegExp)) {
      const label = resolved.item.source.replace(/^\^|\$$/g, '').toLowerCase();
      const isPileCard = zone == null; // pile-view cards omit data-zone
      const isHandSource = zone === 'hand';
      if (isHandSource || isPileCard) {
        const targetZone: string | null =
          label === 'graveyard' ? 'grave'
            : label === 'exile' ? 'rfg'
              : null;
        if (targetZone) {
          // For a hand card, keep the source seat as the drop owner;
          // for a pile-view card, the popup is anchored to the local
          // player's own pile, so drop on the local seat's target.
          const board = isHandSource
            ? card.locator('xpath=ancestor::div[contains(@class, "game__board-cell")][1]')
            : this.localBoard;
          await dragTo(this.page, card, this.zoneStack(targetZone, board));
          return;
        }
        if (label === 'hand') {
          // Send-to-hand from a pile-view card: drag onto the local
          // hand button (top-left of the local seat), which
          // `useGameDnd`'s hit-test routes to `{ zone: "hand" }`.
          const handButton = this.localBoard.locator('button[title^="Hand — "]').first();
          await dragTo(this.page, card, handButton);
          return;
        }
      }
    }

    await card.click({ button: 'right' });
    if (resolved instanceof RegExp) {
      await this.clickCardContextMenuItem(resolved);
    } else {
      // Hover the parent item so the submenu opens (PlayerBox opens
      // submenus on hover, matching desktop). Click the leaf.
      await this.hoverCardContextMenuItem(resolved.submenu);
      await this.clickCardContextMenuItem(resolved.item);
    }
  }

  // Rubber-band select every card on the local battlefield. The
  // battlefield area is `[data-battlefield-owner]`; pointerdown on
  // empty space starts a box-select (the useGameBoxSelect hook skips
  // when the target is a `[data-card]`). Drag corner-to-corner over
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

  // ---- Internal: PlayerBox context-menu helpers ----

  // Zone / player context menu (`<div data-context-menu>`). Items are
  // plain `<button>` whose label lives in a `<span class="flex-1">`
  // sibling to a `<span>{shortcut}</span>`. We match against the label
  // span alone so shortcut hints (rendered adjacent with no whitespace,
  // so `textContent` reads "Draw cardCtrl+D") don't interfere.
  private menuItemButton(menu: Locator, name: RegExp): Locator {
    return menu.locator('button').filter({
      has: this.page.locator('span.flex-1').filter({ hasText: name }),
    });
  }

  private async clickContextMenuItem(name: RegExp): Promise<void> {
    const menu = this.page.locator('[data-context-menu]').last();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await this.menuItemButton(menu, name).first().click();
  }

  // Card context menu (`<div data-card-context-menu>`). Same shape.
  private async clickCardContextMenuItem(name: RegExp): Promise<void> {
    // Card menu opens as a portal and a submenu is a SECOND portal.
    // When clicking a leaf we want to hit the most-recently-opened one
    // (submenu wins over parent), so grab `.last()`.
    const menu = this.page.locator('[data-card-context-menu]').last();
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await this.menuItemButton(menu, name).first().click();
  }

  // Hover a card-menu item to open its submenu (PlayerBox opens
  // submenus on hover — see CardContextMenuPopup.renderItems). Waits
  // for the submenu portal to mount so the next click hits its leaf.
  private async hoverCardContextMenuItem(name: RegExp): Promise<void> {
    const parentMenu = this.page.locator('[data-card-context-menu]').first();
    await expect(parentMenu).toBeVisible({ timeout: 5_000 });
    const before = await this.page.locator('[data-card-context-menu]').count();
    await this.menuItemButton(parentMenu, name).first().hover();
    await expect
      .poll(() => this.page.locator('[data-card-context-menu]').count(), { timeout: 5_000 })
      .toBeGreaterThan(before);
  }
}
