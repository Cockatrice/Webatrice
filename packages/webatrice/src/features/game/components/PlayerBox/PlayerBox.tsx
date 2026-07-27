import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import { Heart, Skull, Sparkles } from "lucide-react";
import type { RoomMemberWithProfile, DeckCard } from "./mockTypes";
import type { MoveCardParams } from "@cockatrice/sockatrice/generated";
import { ZoneName } from "@cockatrice/sockatrice";
import { ManaSymbols } from "./ManaSymbols";
import {
  BATTLEFIELD_GAP_PX as BATTLEFIELD_GAP_PX_BASE,
  STACK_OFFSET_PX as STACK_OFFSET_PX_BASE,
  STACK_OFFSET_Y_PX as STACK_OFFSET_Y_PX_BASE,
  BATTLEFIELD_ROW_PADDING_PX as BATTLEFIELD_ROW_PADDING_PX_BASE,
  BATTLEFIELD_MARGIN_LEFT_PX as BATTLEFIELD_MARGIN_LEFT_PX_BASE,
  BATTLEFIELD_MARGIN_RIGHT_PX as BATTLEFIELD_MARGIN_RIGHT_PX_BASE,
  BATTLEFIELD_MARGIN_TOP_PX as BATTLEFIELD_MARGIN_TOP_PX_BASE,
  BATTLEFIELD_MIN_COLS,
  BATTLEFIELD_ROWS,
  computeCellWidths,
  columnLeftX,
  rowTopY,
  slotOriginPx,
  computeContentWidth,
  computeContentHeight,
  snapPxToSlot,
  type BattlefieldLayoutOpts,
  type BattlefieldSlot,
} from "./gameBattlefield";
import { useCardScale } from "./cardScale";
import {
  CARD_BACK_URL,
  CARD_CORNER_RADIUS,
  CARD_HEIGHT,
  CARD_SIDEWAYS_HEIGHT,
  CARD_SIDEWAYS_WIDTH,
  CARD_WIDTH,
} from "./cardSize";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import LibrarySearchDialog from "./LibrarySearchDialog";
import { useRegisterForeignDrag } from "./foreignDragContext";
import Card from "./Card";
import { useHoveredCard } from "./hoveredCard";
import { useViewportClampedPopup } from "./useViewportClampedPopup";
import ZoneRevealDialog from "./ZoneRevealDialog";
import { useGameDialogActions } from "../ui/GameDialogActionsContext";
import { useGameDialogsContext } from "../ui/GameDialogsContext";
import { buildArrowGeometry } from "../arrows/GameArrowOverlay/arrowPath";
import { ArrowColor, rgbaToCss } from "@app/types";
import { useSnapGridVisible } from "../../hooks/useSnapGridVisible";
import {
  lookupCard,
  lookupCards,
  type LookupCardFace,
  type LookupResult,
  type RelatedCardRef,
} from '../../../decks/cardLookup';

/**
 * A single instance of a card in the game. Deck rows have a `quantity` field
 * so one row can represent 4 copies; expanding a deck row into `quantity`
 * individual HandCards is how we track each physical card independently.
 */
export type HandCard = {
  id: string;
  name: string;
  scryfallId: string;
};

/** A card that has been placed on a battlefield, occupying a specific slot. */
export type BattlefieldCard = HandCard & {
  slot: BattlefieldSlot;
  /** Sub-slot inside the slot's stack column (0..2). Cockatrice packs
   *  up to 3 cards into one visual column via `wire_x % 3`; the render
   *  offsets each successive sub-slot diagonally so their names stay
   *  visible. Local optimistic drops always land at sub-slot 0. */
  subSlot: number;
  /** Tapped cards render rotated 90° (used, attacking, paying costs). */
  tapped: boolean;
  /** Face-down cards render as a card back (morph, manifest, etc.). */
  faceDown?: boolean;
  /** Server-side P/T override (via `AttrPT` on Command_SetCardAttr) or
   *  the initial P/T Cockatrice's `playCard` sends. Empty for cards
   *  the server hasn't tagged with a PT; renderer falls back to the
   *  base P/T from the Scryfall lookup cache. */
  pt?: string;
  /** True when Cockatrice's `AttrDoesntUntap` is set on the card —
   *  the card is skipped during the untap step. Marked visually so
   *  the owner remembers to untap it manually. */
  doesntUntap?: boolean;
  /** Free-form color string (e.g. "RG") set via `AttrColor` or on
   *  play. Preserved so cloning a card copies its color into the
   *  `Command_CreateToken` payload. */
  color?: string;
  /** Player-added text annotation. Preserved so clones carry it. */
  annotation?: string;
  /** Attach target — set when this card is attached to another card
   *  (Aura, Equipment, Fortification). `attachTargetCardId === -1`
   *  means unattached; matches Cockatrice's wire sentinels. Cross-
   *  player attach uses `attachTargetPlayerId` to identify the target
   *  card's owner; the render pins the child to its parent's rendered
   *  position when they share a PlayerBox. */
  attachTargetPlayerId?: number;
  attachTargetCardId?: number;
  /** Per-card counters as (slot id, count) pairs. Cockatrice supports 6
   *  slots (0..5) with color-coded circular badges — see COUNTER_COLORS.
   *  Zero-value counters are omitted (server strips them). Sourced from
   *  ServerInfo_Card.counterList. */
  counters?: readonly { id: number; value: number }[];
};

/** Which zone a drag was initiated from. Individual card identities are
 *  carried on the DragState itself (`cards[*].id`), so we don't need a
 *  discriminated union here anymore. */
type DragSourceZone =
  | "hand"
  | "battlefield"
  | "library"
  | "graveyard"
  | "exile"
  | "stack"
  | "sideboard";

/**
 * Where a dragged card is being dropped. Battlefield carries the snapped
 * slot; stack carries the insertion index (0 = top of pile, N = bottom);
 * everything else is just the zone.
 */
type DropTarget =
  // Battlefield carries the owner so drops can cross PlayerBoxes — the
  // viewer can gift a card onto an opponent's battlefield.
  | { zone: "battlefield"; slot: BattlefieldSlot; ownerId: string }
  // Hand carries the insertion index so drops can reorder cards within
  // the hand or drop cards into specific positions.
  | { zone: "hand"; index: number }
  // Library — `revealSlotIndex` is set when the drop landed on the
  // ZoneRevealDialog. Value is the reveal-list slot the user dropped
  // between; PlayerBox translates it to a library position (top-view =
  // direct, bottom-view = mirrored) and passes it as `x` on the wire.
  // Server routes via `Command_MoveCard(target=DECK, x=libraryPos)`,
  // same path Cockatrice's "Move to → X cards from the top of library"
  // uses — the only way Cockatrice supports arbitrary-position drops.
  | { zone: "library"; revealSlotIndex?: number }
  | { zone: "graveyard" }
  | { zone: "exile" }
  | { zone: "stack"; index: number }
  // Sideboard — HiddenZone like library. Drops on the sideboard-view
  // modal append (x=-1 sentinel handled by applyMove); we don't
  // currently support positional drops within the sideboard reveal.
  | { zone: "sideboard" };

/**
 * Live drag state. `cards` holds one entry for a single-card drag or many
 * for a group drag; drop logic iterates over it. `offsetX/Y` capture where
 * the pointer sat within the primary card so the ghost stays anchored and
 * the drop calculation uses the card's top-left, not the pointer position.
 */
type DragState = {
  cards: HandCard[];
  sourceZone: DragSourceZone;
  /** Player id the cards originate from. Undefined means "self" (the
   *  normal case — the drag started in the local player's own zones).
   *  Set to another player's id when we're dragging cards from a zone
   *  someone else lent us via Command_RevealCards(grant_write_access).
   *  Consumed by the wire path in `applyMove` — Command_MoveCard's
   *  `startPlayerId` gets this value instead of the local player's,
   *  and Servatrice's cmdMoveCard write-permission check
   *  (server_abstract_player.cpp:779) validates that we're in the
   *  lent zone's `playersWithWritePermission` set. */
  sourcePlayerId?: number;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  /** Pointer position where the drag was initiated. Used to distinguish
   *  drags from clicks — a release within a few pixels of the start is
   *  treated as a click and doesn't commit a drop, so double-clicks
   *  don't accidentally re-order stacks. */
  initialX: number;
  initialY: number;
  /** Flips true once the pointer has moved past the threshold. Gates all
   *  visual drag effects (ghost, source-card hiding, cursor override) so
   *  a click that never moves doesn't flash the drag UI. */
  moved: boolean;
};

/** Pointer must move at least this many pixels for a drop to fire. */
const DRAG_MOVEMENT_THRESHOLD_PX = 4;

/** A marquee selection is always within a single zone. */
type Selection = {
  zone: "hand" | "battlefield" | "stack";
  ids: Set<string>;
};

/** True when the browser is running on macOS — used to pick between
 *  ⌘ (Mac) and Ctrl (Windows/Linux) modifier labels in shortcut hints. */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Map a local drag zone name to the Cockatrice wire zone name. */
function wireZoneName(
  zone:
    | "battlefield"
    | "hand"
    | "library"
    | "graveyard"
    | "exile"
    | "stack"
    | "sideboard",
): string {
  switch (zone) {
    case "battlefield":
      return ZoneName.TABLE;
    case "hand":
      return ZoneName.HAND;
    case "library":
      return ZoneName.DECK;
    case "graveyard":
      return ZoneName.GRAVE;
    case "exile":
      return ZoneName.EXILE;
    case "stack":
      return ZoneName.STACK;
    case "sideboard":
      return ZoneName.SIDEBOARD;
  }
}

/** Classify a Scryfall type line into Cockatrice's `tableRow` values
 *  (as assigned by `oracle/src/oracleimporter.cpp`):
 *    • 0 → lands
 *    • 1 → non-creature permanents (artifacts / enchantments /
 *          planeswalkers / battles)
 *    • 2 → creatures
 *    • 3 → instants / sorceries (stack targets)
 *  Order matters: "artifact creature" must classify as creature, and
 *  "creature land" (Nissa, Vastwood Seer's back etc.) resolves to
 *  creature per Cockatrice's own convention. */
function typeLineToTableRow(typeLine: string): 0 | 1 | 2 | 3 {
  const t = typeLine.toLowerCase();
  if (t.includes("instant") || t.includes("sorcery")) return 3;
  if (t.includes("creature")) return 2;
  if (t.includes("land")) return 0;
  return 1;
}

/** Cockatrice's `TableZone::tableRowToGridY` — inverts the semantic
 *  row so wire y ∈ {0, 1, 2} lines up with owner-perspective visual
 *  rows (lands at top, creatures at bottom). tableRow=3 falls back
 *  to the non-creature-permanent row; if the target ends up on the
 *  stack that's picked separately via the target-zone selection. */
function tableRowToGridY(tableRow: number): number {
  const clamped = tableRow > 2 ? 1 : tableRow;
  return 2 - clamped;
}

// ---------- Card context menu (right-click on a battlefield card) ----------
//
// Mirrors Cockatrice desktop's card context menu layout — labels,
// order, dividers, and shortcut hints all match `menu_builder.cpp` /
// the desktop client's `TableZone::onCardContextMenu` render. Most
// items are placeholders for now: only Tap/Untap, Turn Over (flip),
// and the Move to → destinations dispatch real commands. The rest
// are visible but no-op until we wire the corresponding protocol
// (arrows, counters, attach, P/T, annotation, selection).

type CardMenuItem =
  | { divider: true }
  | {
      label: string;
      shortcut?: string;
      /** Small color swatch shown left of the label — used by the
       *  Card counters submenu to color-code the six counter slots. */
      swatch?: string;
      /** Renders a leading ✓ so the item reads as an active toggle
       *  (e.g. "Skip untapping" when the card already has
       *  `AttrDoesntUntap`). */
      checked?: boolean;
      submenu?: CardMenuItem[];
      onClick?: () => void;
    };

/** Cockatrice's six counter slot colors (A-F). Matches the desktop
 *  client's default palette in `settings_cache.cpp`. */
const COUNTER_COLORS: [string, string, string, string, string, string] = [
  "#ef4444", // A red
  "#eab308", // B yellow
  "#22c55e", // C green
  "#22d3ee", // D cyan
  "#3b82f6", // E blue
  "#ec4899", // F pink
];

interface BuildCardContextMenuArgs {
  faceDown: boolean;
  doesntUntap: boolean;
  onTapUntap: () => void;
  onFlip: () => void;
  onSkipUntapping: () => void;
  onClone: () => void;
  onSetAnnotation: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onMoveToTable: () => void;
  onMoveToHand: () => void;
  onMoveToGrave: () => void;
  onMoveToExile: () => void;
  /** "X cards from the top of library..." — opens a numeric prompt and
   *  moves the source card N positions from the top of its owner's
   *  library on submit. Ports Cockatrice's
   *  `actRequestMoveCardXCardsFromTopDialog` (player_actions.cpp:1220). */
  onMoveToXCardsFromTop: () => void;
  /** P/T submenu handlers. Each mirrors one entry in Cockatrice's
   *  `pt_menu.cpp`. Order: increase power / decrease power / flow P
   *  (P+1, T-1); increase toughness / decrease toughness / flow T
   *  (P-1, T+1); increase both / decrease both; set..., reset. */
  onIncP: () => void;
  onDecP: () => void;
  onFlowP: () => void;
  onIncT: () => void;
  onDecT: () => void;
  onFlowT: () => void;
  onIncPT: () => void;
  onDecPT: () => void;
  onSetPT: () => void;
  onResetPT: () => void;
  /** "Attach to card..." — enters pending-attach mode. The next click on
   *  a battlefield card resolves the attach; Escape or clicking the
   *  source card cancels. Ported behavior from Cockatrice's `actAttach`
   *  (player_actions.cpp:1493-1501). */
  onAttachToCard: () => void;
  /** Gates the "Unattach" menu item. True when the target card is
   *  currently attached to another card (has a valid `attachTargetCardId`).
   *  Cockatrice hides the item entirely when nothing is attached. */
  isAttached: boolean;
  /** "Unattach" — sends `Command_AttachCard` with no target so the
   *  server clears this card's `attachedTo` link. Ports
   *  `PlayerActions::actUnattach` (player_actions.cpp:1503-1517). */
  onUnattach: () => void;
  /** "Draw arrow..." — enters pending-arrow mode. The next click on
   *  a battlefield card OR player life-pill resolves the arrow;
   *  Escape or clicking the source cancels. Ports Cockatrice's
   *  `actDrawArrow` → `CardItem::drawArrow(Qt::red)`. */
  onDrawArrow: () => void;
  /** "Reduce life by power" — sums the power of every selected card
   *  (or just this card when there's no selection) and subtracts from
   *  the life total. Ports `PlayerActions::actReduceLifeByPower`
   *  (player_actions.cpp:1432-1455). */
  onReduceLifeByPower: () => void;
  /** "Select All" — marquees every card in this card's zone (the
   *  battlefield, since the menu is only reachable from the board).
   *  Ports `PlayerActions::actSelectAll` (player_actions.cpp:720-728). */
  onSelectAll: () => void;
  /** "Select Row" — marquees every battlefield card in the same visual
   *  row (`slot.row`) as this card. Ports `actSelectRow`
   *  (player_actions.cpp:730-741). */
  onSelectRow: () => void;
  /** "Add counter (X)" — increments the counter at slot `counterId` by
   *  1. Ports `PlayerActions::actAddCardCounter` (player_actions.cpp:1519). */
  onAddCardCounter: (counterId: number) => void;
  /** "Set counters (X)..." — opens a numeric modal to set the counter
   *  at slot `counterId` to an absolute value. Ports
   *  `actRequestSetCardCounterDialog` / `actSetCardCounter`. */
  onSetCardCounter: (counterId: number) => void;
  /** Pre-built "Token: …" items appended to the bottom of the menu.
   *  Cockatrice's addRelatedCardActions (card_menu.cpp:407-479)
   *  iterates the card's related + reverse-related lists and adds
   *  one QAction per entry; we do the same in the caller and hand
   *  the finished items in so this builder stays wire-agnostic
   *  (no Dexie / token lookups needed here). */
  tokenItems?: CardMenuItem[];
}

/**
 * Build "Token: …" menu items for a card's related list. Shared by
 * the own-card and opponent-card menu render sites so both branches
 * label / dispatch identically. Ports Cockatrice's
 * addRelatedCardActions (card_menu.cpp:407-479):
 *   - Label format:
 *       count omitted / count="1" → "Token: <pt> <name>"
 *       count="x"                 → "Token: X <pt> <name>"
 *       count=N (numeric > 1)     → "Token: Nx <pt> <name>"
 *   - `pt` is dropped from the label when the token's own Scryfall
 *     record has no power/toughness (spell tokens, transform-back
 *     non-creatures).
 *   - Item still renders when the token's Scryfall lookup is
 *     `unknown` — the parent card's `related` entry is enough to
 *     fire Command_CreateToken with just the name; a stale-image
 *     fallback is better than a missing item.
 *   - `count=N` fires N Command_CreateToken calls in a row
 *     (Cockatrice's actCreateRelatedCard loop). `count="x"` fires
 *     once — Cockatrice prompts the user for a number; that dialog
 *     is a follow-up. `persistent="persistent"` inverts the
 *     default destroy-on-zone-change (rare — most tokens vanish
 *     off the battlefield).
 */
function buildRelatedTokenItems(
  related: RelatedCardRef[],
  tokenMeta: Map<string, LookupResult>,
  onCreateToken: BattlefieldCardCreateTokenHandler | undefined,
): CardMenuItem[] {
  const out: CardMenuItem[] = [];
  for (const ref of related) {
    const tok = tokenMeta.get(ref.name);
    const tokPT = tok?.power != null && tok.toughness != null
      ? `${tok.power}/${tok.toughness}`
      : undefined;
    const tokColor = tok?.colors && tok.colors.length > 0
      ? tok.colors.length > 1
        ? 'm'
        : tok.colors[0].toLowerCase()
      : '';
    const tokProviderId = tok?.printings?.[0]?.scryfallId;
    const countPrefix = ref.count === 'x'
      ? 'X '
      : ref.count && /^\d+$/.test(ref.count) && Number(ref.count) > 1
        ? `${ref.count}x `
        : '';
    const ptPart = tokPT ? `${tokPT} ` : '';
    const fireCount =
      ref.count && /^\d+$/.test(ref.count) ? Number(ref.count) : 1;
    out.push({
      label: `Token: ${countPrefix}${ptPart}${ref.name}`,
      onClick: () => {
        if (!onCreateToken) {
          return;
        }
        for (let i = 0; i < fireCount; i++) {
          onCreateToken({
            name: tok?.name ?? ref.name,
            color: tokColor,
            pt: tokPT ?? '',
            annotation: '',
            destroyOnZoneChange: ref.persistent !== 'persistent',
            faceDown: false,
            providerId: tokProviderId,
          });
        }
      },
    });
  }
  return out;
}

// Signature match for PlayerBox's `onCreateToken` prop — extracted
// so `buildRelatedTokenItems` doesn't have to duplicate the args
// type. Kept next to the helper to keep the coupling obvious.
type BattlefieldCardCreateTokenHandler = (args: {
  name: string;
  color: string;
  pt: string;
  annotation: string;
  destroyOnZoneChange: boolean;
  faceDown: boolean;
  providerId?: string;
  targetCardId?: number;
  targetMode?: 'transform_into' | 'attach_to';
}) => void;

/**
 * Scryfall layouts we treat as transformable (present two physical
 * faces the user can flip between via Command_CreateToken.
 * TRANSFORM_INTO). Adventure / split / flip layouts DON'T qualify —
 * they have two "faces" in the data model but the physical card
 * doesn't flip in play. Reversible cards (Zendikar Rising) DO
 * qualify: both faces are legal at once and the player can decide
 * which one is "up."
 */
const TRANSFORMABLE_LAYOUTS = new Set(['transform', 'modal_dfc', 'reversible_card']);

/**
 * "Token: Transform into '<back-face>'" menu item for DFC-family
 * cards. Ports Cockatrice's addRelatedCardActions transform branch
 * (player_actions.cpp:1198-1206): fires Command_CreateToken with
 * target_card_id + target_mode=TRANSFORM_INTO, which the server
 * processes as "replace the source card with the new token."
 *
 * Returns [] when the card isn't a transformable layout, when the
 * Scryfall face data hasn't landed yet, or when the source card
 * has no numeric id (optimistic mock-id cards can't be targeted).
 * Otherwise returns exactly ONE item — the transform target is the
 * one non-front face.
 */
function buildTransformItems(
  parentMeta: { layout?: string; faces?: LookupCardFace[] } | undefined,
  sourceCardId: number | undefined,
  parentName: string,
  onCreateToken: BattlefieldCardCreateTokenHandler | undefined,
): CardMenuItem[] {
  if (!parentMeta || !sourceCardId || !onCreateToken) {
    return [];
  }
  if (!parentMeta.layout || !TRANSFORMABLE_LAYOUTS.has(parentMeta.layout)) {
    return [];
  }
  const faces = parentMeta.faces ?? [];
  if (faces.length < 2) {
    return [];
  }
  // Determine which face is currently showing. Simplest heuristic:
  // Scryfall's `card_faces[0]` is the front. The parent card's
  // display name here is `parentName` (whichever face the server
  // currently reports); if it matches the front-face name, target
  // the back. Otherwise target the front. Handles the case where
  // an already-transformed card should flip back.
  const front = faces[0];
  const back = faces[1];
  const target = parentName === front.name ? back : front;
  const targetPT = target.power != null && target.toughness != null
    ? `${target.power}/${target.toughness}`
    : undefined;
  const targetColor = target.colors && target.colors.length > 0
    ? target.colors.length > 1
      ? 'm'
      : target.colors[0].toLowerCase()
    : '';
  return [
    {
      label: `Token: Transform into "${target.name}"`,
      shortcut: 'Ctrl+Shift+T',
      onClick: () => {
        onCreateToken({
          name: target.name,
          color: targetColor,
          pt: targetPT ?? '',
          annotation: '',
          destroyOnZoneChange: false,
          faceDown: false,
          targetCardId: sourceCardId,
          targetMode: 'transform_into',
        });
      },
    },
  ];
}

function buildCardContextMenu(args: BuildCardContextMenuArgs): CardMenuItem[] {
  const counterItems: CardMenuItem[] = [];
  const letters: [string, string, string, string, string, string] = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
  ];
  const counterShortcuts: [
    [string, string],
    [string, string],
    [string, string],
    [string, string],
    [string, string],
    [string, string],
  ] = [
    ["Alt+.", "Alt+/"],
    ["Ctrl+.", "Ctrl+/"],
    ["`", "Ctrl+?"],
    ["", ""],
    ["", ""],
    ["", ""],
  ];
  letters.forEach((letter, i) => {
    if (i > 0) counterItems.push({ divider: true });
    counterItems.push({
      label: `Add counter (${letter})`,
      shortcut: counterShortcuts[i][0] || undefined,
      swatch: COUNTER_COLORS[i],
      onClick: () => args.onAddCardCounter(i),
    });
    counterItems.push({
      label: `Set counters (${letter})...`,
      shortcut: counterShortcuts[i][1] || undefined,
      swatch: COUNTER_COLORS[i],
      onClick: () => args.onSetCardCounter(i),
    });
  });

  return [
    { label: "Tap / Untap", onClick: args.onTapUntap },
    {
      label: "Skip untapping",
      shortcut: "Alt+U",
      checked: args.doesntUntap,
      onClick: args.onSkipUntapping,
    },
    {
      label: args.faceDown ? "Turn Over (face up)" : "Turn Over",
      shortcut: "Alt+F",
      onClick: args.onFlip,
    },
    { divider: true },
    { label: "Clone", shortcut: "Ctrl+J", onClick: args.onClone },
    {
      label: "Move to",
      submenu: [
        {
          label: "Top of library in random order",
          onClick: args.onMoveToTop,
        },
        { label: "X cards from the top of library...", onClick: args.onMoveToXCardsFromTop },
        {
          label: "Bottom of library in random order",
          shortcut: "Ctrl+B",
          onClick: args.onMoveToBottom,
        },
        { divider: true },
        { label: "Table", onClick: args.onMoveToTable },
        { label: "Hand", onClick: args.onMoveToHand },
        { divider: true },
        {
          label: "Graveyard",
          shortcut: "Ctrl+Del",
          onClick: args.onMoveToGrave,
        },
        { label: "Exile", onClick: args.onMoveToExile },
      ],
    },
    { divider: true },
    { label: "Attach to card...", shortcut: "Ctrl+Alt+A", onClick: args.onAttachToCard },
    // Cockatrice hides "Unattach" for cards that aren't attached — only
    // include the item when there's actually something to detach.
    ...(args.isAttached
      ? [{ label: "Unattach", shortcut: "Ctrl+Alt+U", onClick: args.onUnattach } as CardMenuItem]
      : []),
    { label: "Draw arrow...", shortcut: "Alt+A", onClick: args.onDrawArrow },
    { divider: true },
    {
      label: "Power / toughness",
      submenu: [
        { label: "Increase power", shortcut: "Ctrl++", onClick: args.onIncP },
        { label: "Decrease power", shortcut: "Ctrl+-", onClick: args.onDecP },
        { label: "Increase power and decrease toughness", onClick: args.onFlowP },
        { divider: true },
        { label: "Increase toughness", shortcut: "Alt++", onClick: args.onIncT },
        { label: "Decrease toughness", shortcut: "Alt+-", onClick: args.onDecT },
        { label: "Decrease power and increase toughness", onClick: args.onFlowT },
        { divider: true },
        { label: "Increase power and toughness", shortcut: "1", onClick: args.onIncPT },
        { label: "Decrease power and toughness", shortcut: "Ctrl+Alt+-", onClick: args.onDecPT },
        { divider: true },
        { label: "Set power and toughness...", shortcut: "Ctrl+P", onClick: args.onSetPT },
        { label: "Reset power and toughness", shortcut: "Ctrl+Alt+0", onClick: args.onResetPT },
      ],
    },
    {
      label: "Set annotation...",
      shortcut: "Alt+N",
      onClick: args.onSetAnnotation,
    },
    { divider: true },
    { label: "Reduce life by power", shortcut: "Ctrl+Shift+L", onClick: args.onReduceLifeByPower },
    { divider: true },
    { label: "Select All", shortcut: "Ctrl+A", onClick: args.onSelectAll },
    { label: "Select Row", shortcut: "Ctrl+Shift+X", onClick: args.onSelectRow },
    { divider: true },
    { label: "Card counters", submenu: counterItems },
    // "Token: …" items — mirrors Cockatrice's addRelatedCardActions
    // (card_menu.cpp:407-479). The parent caller resolves each token
    // name into a menu item (label + onClick) and passes them in as
    // a flat array; we tack them on after Card counters and prefix
    // with a divider when non-empty so the shape stays 1:1 with
    // desktop's menu. Empty when the card has no related list or
    // none of its related names resolve in the tokens table.
    ...(args.tokenItems && args.tokenItems.length > 0
      ? [{ divider: true } as CardMenuItem, ...args.tokenItems]
      : []),
  ];
}

interface CardContextMenuPopupProps {
  items: CardMenuItem[];
  anchorX: number;
  anchorY: number;
  disabled: boolean;
}

function CardContextMenuPopup({
  items,
  anchorX,
  anchorY,
  disabled,
}: CardContextMenuPopupProps) {
  const [openSubmenu, setOpenSubmenu] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const { ref: mainRef, pos: mainPos } = useViewportClampedPopup(
    anchorX,
    anchorY,
  );

  const renderItems = (
    list: CardMenuItem[],
    keyPrefix: string,
    onItemHover: (i: number, e: React.MouseEvent<HTMLButtonElement>) => void,
  ) =>
    list.map((item, i) => {
      if ("divider" in item) {
        return (
          <div
            key={`${keyPrefix}-d-${i}`}
            className="my-1 border-t border-border-subtle"
          />
        );
      }
      const hasSubmenu = !!item.submenu;
      return (
        <button
          key={`${keyPrefix}-i-${i}`}
          disabled={disabled && !hasSubmenu && !item.onClick}
          onMouseEnter={(e) => onItemHover(i, e)}
          onClick={item.onClick}
          className="w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left text-text-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {item.swatch !== undefined ? (
            <span
              className="inline-block rounded-full shrink-0"
              style={{
                width: 10,
                height: 10,
                background: item.swatch,
              }}
              aria-hidden
            />
          ) : (
            <span
              className="inline-block shrink-0 text-center text-accent"
              style={{ width: 10 }}
              aria-hidden
            >
              {item.checked ? "✓" : ""}
            </span>
          )}
          <span className="flex-1 truncate">{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-text-muted">{item.shortcut}</span>
          )}
          {hasSubmenu && (
            <span className="text-text-muted text-xs" aria-hidden>
              ▶
            </span>
          )}
        </button>
      );
    });

  return (
    <>
      <div
        ref={mainRef}
        data-card-context-menu
        // z-[1200] sits above the pile-view LibrarySearchDialog
        // (z-[1000]) so the pile-view per-card context menu is
        // actually visible. Prior z-[100] worked for the battlefield
        // menu but rendered BEHIND any open modal — the graveyard-
        // view menu opened silently. Everything else here
        // (battlefield, hand, etc.) has no modals above it, so the
        // bump is inert for the existing flows.
        className="fixed z-[1200] min-w-[220px] rounded-md border border-border-subtle bg-bg-surface shadow-glow py-1"
        style={{ left: mainPos.x, top: mainPos.y }}
      >
        {renderItems(items, "top", (i, e) => {
          const item = items[i];
          if ("divider" in item) return;
          if (item.submenu) {
            const rect = e.currentTarget.getBoundingClientRect();
            setOpenSubmenu({ index: i, x: rect.right, y: rect.top });
          } else {
            setOpenSubmenu(null);
          }
        })}
      </div>
      {openSubmenu !== null &&
        (() => {
          const parent = items[openSubmenu.index];
          if ("divider" in parent || !parent.submenu) return null;
          return (
            <CardContextSubmenu
              anchorX={openSubmenu.x}
              anchorY={openSubmenu.y}
            >
              {renderItems(parent.submenu, `sub-${openSubmenu.index}`, () => {
                /* nested submenus not used by any current menu */
              })}
            </CardContextSubmenu>
          );
        })()}
    </>
  );
}

/** Measures the ref's own rendered size after mount and clamps
 *  (anchorX, anchorY) into the viewport. If the popup would spill
 *  past the right edge it flips to open on the LEFT of the anchor
 *  (starts at `anchorX - width` — used by submenus that fall back to
 *  the parent item's left side). If it would spill past the bottom
 *  it shifts up so the popup bottom sits just inside the viewport;
 *  same at the top. Runs in useLayoutEffect so the correction
 *  applies before paint — no visible flicker. */
// `useViewportClampedPopup` was inlined here originally; extracted to
// its own module so ContextMenu.tsx (library / graveyard / exile menus)
// can share the same clamping behavior.

interface CardContextSubmenuProps {
  anchorX: number;
  anchorY: number;
  children: React.ReactNode;
}

function CardContextSubmenu({
  anchorX,
  anchorY,
  children,
}: CardContextSubmenuProps) {
  const { ref, pos } = useViewportClampedPopup(anchorX, anchorY);
  return (
    <div
      ref={ref}
      data-card-context-menu
      className="fixed z-[1201] min-w-[260px] rounded-md border border-border-subtle bg-bg-surface shadow-glow py-1"
      style={{ left: pos.x, top: pos.y }}
    >
      {children}
    </div>
  );
}

/** Max cards allowed in a single battlefield slot. Beyond this, dropped
 *  cards bump to the nearest slot with room. Keeps stacks small enough
 *  for every card's title to remain readable. */
const MAX_STACK_PER_SLOT = 3;

/** Synthetic drag payload for pulling the top of the library. The library
 *  is a HiddenZone — the client never knows which face is at deck[0]
 *  (that's the server's shuffle) so the drag carries no identity, and
 *  the wire path hardcodes `cardId: 0` (positional "top" per Cockatrice's
 *  HiddenZone convention). The id is a non-numeric sentinel so
 *  `Number(id) → NaN` correctly steers the wire past the numeric-id
 *  fast-path in `applyMove` and into the top-of-deck fallback. */
const LIBRARY_TOP_DRAG_PAYLOAD: HandCard = {
  id: '__library_top__',
  name: '',
  scryfallId: '',
};

/** How far each successive stack card advances downward, as a fraction of
 *  the card height. 0.35 leaves each card's title fully readable. */
const STACK_VERTICAL_STEP_FRACTION = 0.35;
/** Horizontal zig-zag offset (px). Alternates left/right by index so the
 *  pile visually "shares" the center rather than drifting one direction. */
const STACK_HORIZONTAL_OFFSET_PX = 8;

/**
 * Position each card of the stack within a container of the given size.
 * Index 0 is the top of the pile (resolves next); it renders highest in
 * the container. Cards are centered as a group and squished together if
 * the container can't fit the ideal spacing.
 */
function layoutStack(
  count: number,
  containerW: number,
  containerH: number,
  cardWPx: number = CARD_W_PX_BASE,
  cardHPx: number = CARD_H_PX_BASE,
  hOffsetPx: number = STACK_HORIZONTAL_OFFSET_PX,
): { x: number; y: number }[] {
  if (count === 0) return [];
  const idealStep = cardHPx * STACK_VERTICAL_STEP_FRACTION;
  const maxSpan = Math.max(0, containerH - cardHPx);
  const step =
    count > 1 ? Math.min(idealStep, maxSpan / (count - 1)) : 0;
  const totalSpan = (count - 1) * step;
  const startY = Math.max(0, (containerH - totalSpan - cardHPx) / 2);
  const cx = (containerW - cardWPx) / 2;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Single card sits dead center; zig-zag only applies once there's a
    // second card to share the middle with. Without this, a lone stack
    // card would render shifted 8px left of column center.
    const xOffset =
      count === 1 ? 0 : (i % 2 === 0 ? -1 : 1) * hOffsetPx;
    out.push({ x: cx + xOffset, y: startY + i * step });
  }
  return out;
}

/**
 * A single player's play-area box. Layout:
 *
 *   +-------+---------+--------------------+
 *   | Info  | CmdZone |                    |
 *   |       |         |    Battlefield     |
 *   |       | Stack   |                    |
 *   |       |         |                    |
 *   +       +---------+--------------------+
 *   |       |            Hand              |   (only for self)
 *   +-------+------------------------------+
 *
 * The info column spans both rows so the hand doesn't cut into it. Non-self
 * boxes skip the hand row entirely — opponents' hands are secret; only the
 * card count is shown in the info column.
 *
 * All zones are placeholders in this iteration — real card data lands with the
 * game-state wiring.
 */

type Props = {
  player: RoomMemberWithProfile;
  isSelf: boolean;
  /** True when it is this player's turn. Drives the accent border/glow
   *  around their box, so the whole table can see whose turn it is. */
  isActive: boolean;
  /** When true, the hand row sits above the play area instead of below.
   *  Used for players in the top row of a multi-row layout so their hand
   *  sits closer to the edge of the screen they're "facing". */
  handOnTop: boolean;
  /** When true, opponent hand card backs render rotated 180° — as if
   *  the opponent is holding them from their side of the table. On for
   *  layouts where opponents sit directly across (2 / 4+ player), off
   *  for 3-player where opponents are on the sides. No effect on the
   *  local (isSelf) hand. */
  flipHandCardBacks?: boolean;
  /** All cards from this player's selected deck. Feeds the library. */
  cards: DeckCard[];
  /** Optional controlled life counter. When provided, PlayerBox uses
   *  `value` as the displayed life total and calls `onDelta` for the
   *  hover +/- buttons and `onSet` for the numeric-edit input, instead
   *  of managing life via internal `useState`. Undefined during the
   *  pre-hydration transient before the player's counters are in
   *  Redux; PlayerBox falls back to a local-state life counter until
   *  it lands. */
  lifeControl?: {
    value: number;
    onDelta: (delta: number) => void;
    onSet: (value: number) => void;
  };
  /** Optional per-zone card counts sourced from Redux. When a value is
   *  present here, it overrides the local mock state's `.length` for
   *  that zone's displayed count badge — the actual local zone
   *  contents keep driving drag/drop behavior during this
   *  transitional wiring step. Undefined values fall through to the
   *  local mock counts (used during the pre-hydration transient
   *  before the zones land in Redux). */
  zoneCounts?: {
    deck?: number;
    grave?: number;
    rfg?: number;
    /** Hand card count from Redux. Set for BOTH self and opponents —
     *  own hand is a PrivateZone we can see fully, opponents' hands
     *  are private to them but the count is broadcast to everyone. */
    hand?: number;
  };
  /** Ordered graveyard/exile cards from Redux — used to drive the
   *  top-card art on each pile so it reflects the server's truth
   *  (correct card face for anyone at the table, including
   *  opponents). Empty arrays and undefined both fall back to the
   *  local pile — that covers the pre-hydration transient and the
   *  drop-to-ack window where a card is optimistically in the local
   *  pile before the server broadcasts it back. Last entry is the
   *  top. */
  graveCards?: HandCard[];
  exileCards?: HandCard[];
  /** Own sideboard cards from Redux — projected from
   *  `sideboardZone.revealedCards` (populated by Command_DumpZone).
   *  Sideboard is a HiddenZone so Servatrice sends only cardCount
   *  in the initial state (server_cardzone.cpp:343-361); we have
   *  to dump the zone to view its contents, same as View library. */
  sideboardCards?: HandCard[];
  /** Fires `Command_DumpZone(zone=SIDEBOARD, numberCards=-1)` to
   *  request the sideboard contents. Called when the sideboard view
   *  modal opens. Response populates `sideboardZone.revealedCards`. */
  onDumpSideboard?: () => void;
  /** Clears the sideboard's `revealedCards` snapshot when the modal
   *  closes so a subsequent open re-dumps fresh. */
  onClearRevealedSideboard?: () => void;
  /** Own hand cards from Redux — drives the face-up hand row for
   *  isSelf and provides real numeric card ids for hand-source
   *  drag-drops. Only meaningful for the local player: opponents'
   *  hands are private to them, so their `handCards` array stays
   *  empty and their card-back count comes from `zoneCounts.hand`
   *  instead. Undefined during the pre-hydration transient — the
   *  local mock hand takes over as a fallback. */
  handCards?: HandCard[];
  /** Battlefield cards from Redux (PublicZone — visible to every
   *  player). Includes slot (x/y) and tapped state. Drives the
   *  battlefield render for every seat and provides real numeric
   *  ids for battlefield-source drag-drops. Undefined during the
   *  pre-hydration transient — the local mock battlefield takes
   *  over as a fallback. */
  battlefieldCards?: BattlefieldCard[];
  /** Stack cards from Redux (PublicZone — visible to every player).
   *  Order runs bottom → top of the stack (last-in resolves first,
   *  matching MTG's "last on the stack resolves first"). Drives the
   *  stack render and provides real numeric ids for stack-source
   *  drag-drops. */
  stackCards?: HandCard[];
  /** Numeric Cockatrice player id for this seat. Used as the
   *  `start_player_id` / `target_player_id` on `Command_MoveCard`
   *  when `onMoveCard` is wired. `player.user_id` is a string
   *  (RoomMemberWithProfile carries the room-member id) so we can't
   *  reuse it for the wire command. */
  playerId?: number;
  /** Optional wire to send a `Command_MoveCard` for the OWN player's
   *  library drag drops. When provided, PlayerBox also fires the
   *  local mutation so the destination pile's top-card art picks up
   *  the moved card; the server broadcasts back an Event_MoveCard,
   *  the reducer updates the zone counts, and the wired `zoneCounts`
   *  prop re-reads them. Undefined only during the pre-hydration
   *  transient before the game id is known. */
  onMoveCard?: (params: MoveCardParams) => void;
  /** Optional wires for library-management commands. When provided,
   *  they fire alongside the existing local mock mutations so the
   *  server drives the actual hand contents (via Redux) while the
   *  local library shuffle keeps the count and draw animation
   *  consistent. Undefined during the pre-hydration transient. */
  onDrawCards?: (number: number) => void;
  onMulligan?: (number: number) => void;
  onShuffle?: () => void;
  /** Fires `Command_Shuffle(zone=DECK, start, end)` for the "Shuffle
   *  top N" / "Shuffle bottom N" submenu items. Cockatrice encodes the
   *  range as `[0, N-1]` for top-N and `[-N, -1]` for bottom-N — negative
   *  indices count from the end (player_actions.cpp:265-269, 296-299).
   *  Server responds with Event_Shuffle (clears the zone's known-card
   *  tracking via clearZoneKnownCards). Undefined only during the
   *  pre-hydration transient. */
  onShuffleRange?: (start: number, end: number) => void;
  /** Webatrice-specific "Open deck in deck editor" action. Diverges
   *  from Cockatrice desktop (which reconstructs the deck in-app) —
   *  we navigate to the same `/deck/:id` page a My Decks row-click
   *  opens. Only wired when the game's deck matches a My Deck by
   *  name — undefined disables the menu item (foreign decks,
   *  .cod-upload path, or backendDecks not yet fetched). */
  onOpenDeckInEditor?: () => void;
  /** Fires `Command_RevealCards(zone=<zoneName>, player_id=<target or
   *  unset>, card_id=[-2])`. `-2` is Servatrice's `RANDOM_CARD_FROM_ZONE`
   *  sentinel (server_abstract_player.cpp:1498-1508) — server picks a
   *  random card from the zone. Powers the graveyard menu's "Reveal
   *  random card to..." submenu. `targetPlayerId === -1` reveals to
   *  every player. Mirrors PlayerActions::actRevealRandomGraveyardCard
   *  (player_actions.cpp:1750-1758). */
  onRevealRandomFromZone?: (zoneName: string, targetPlayerId: number) => void;
  /** Zone-agnostic variant of `onRevealLibrary` — fires
   *  `Command_RevealCards(zone=<zoneName>, player_id=<target or unset>)`
   *  with no `card_id` list (server reveals every card in the zone).
   *  Powers the hand menu's "Reveal hand to..." flow; long-term this
   *  can absorb `onRevealLibrary` once the library menu is retrofitted.
   *  Same proto2 field-presence trap as reveal-library — omit playerId
   *  when target is -1 (All players). */
  onRevealZone?: (zoneName: string, targetPlayerId: number) => void;
  /** Undo the last draw — server pops the most-recently-drawn card
   *  back onto the top of the library. Wraps `Command_UndoDraw` (no
   *  payload). Ports Cockatrice's `PlayerActions::actUndoDraw`
   *  (player_actions.cpp:371-374). */
  onUndoDraw?: () => void;
  /** Wraps `Command_DumpZone` for the DECK zone. `numberCards > 0`
   *  fetches that many; `isReversed=true` pulls from the bottom. The
   *  server response populates `zone.revealedCards`, which comes back
   *  via `revealedDeckCards`. Ports Cockatrice's `actViewTopCards`
   *  / `actViewBottomCards`. */
  onDumpTopCards?: (numberCards: number, isReversed: boolean) => void;
  /** Clears the DECK zone's `revealedCards` snapshot — called on
   *  dialog close so a subsequent view triggers a fresh dump. Matches
   *  Cockatrice's `zoneViewCleared` on ZoneViewWidget close. */
  onClearRevealedDeck?: () => void;
  /** Other seated players in the game (self excluded). Feeds the
   *  "Reveal library to..." / "Lend library to..." submenus. Order
   *  matches seating so the menu reads the same to all participants. */
  revealTargets?: readonly { playerId: number; name: string }[];
  /** Fires `Command_RevealCards(zone=DECK, player_id=<target or -1>)`.
   *  `targetPlayerId === -1` reveals to every player at the table.
   *  Mirrors Cockatrice's `PlayerActions::actRevealLibrary`
   *  (player_actions.cpp:1712-1721). */
  onRevealLibrary?: (targetPlayerId: number) => void;
  /** Fires `Command_RevealCards(zone=DECK, player_id=<target>,
   *  grant_write_access=true)`. Same wire as reveal but sets the
   *  write-access flag — Servatrice tracks a per-zone
   *  `playersWithWritePermission` set and lets the target execute
   *  Command_MoveCard against the lent zone
   *  (server_abstract_player.cpp:1566, cmdMoveCard validation :779).
   *  Permission clears on any shuffle of the zone
   *  (server_cardzone.cpp:72). Never called with -1 — the Lend menu
   *  doesn't offer "All players" (library_menu.cpp:280-293). */
  onLendLibrary?: (targetPlayerId: number) => void;
  /** Fires `Command_RevealCards(zone=DECK, player_id=<target or unset>,
   *  top_cards=<count>, card_id=[0])`. Server reveals the top N cards
   *  (positions 0..count-1) — face-up card list to the target /
   *  originator, count-only summary to spectators. `card_id=[0]` is a
   *  backward-compat sentinel Cockatrice desktop sends
   *  (player_actions.cpp:1745). Mirrors PlayerActions::actRevealTopCards
   *  (player_actions.cpp:1735-1748). `targetPlayerId === -1` reveals to
   *  every player at the table (menu offers "All players" per
   *  library_menu.cpp:295-314). */
  onRevealTopCards?: (targetPlayerId: number, count: number) => void;
  /** Current zone-property flags for the DECK. Drive the checked
   *  state of the "Always reveal / look at top card" toggles.
   *  Populated from Redux `zone.alwaysRevealTopCard` /
   *  `zone.alwaysLookAtTopCard`, which the zonePropertiesChanged
   *  reducer keeps in sync with server broadcasts. */
  alwaysRevealTopCard?: boolean;
  alwaysLookAtTopCard?: boolean;
  /** Toggle "always reveal top card of library" for THIS player's
   *  deck. Fires `Command_ChangeZoneProperties(zone=DECK,
   *  always_reveal_top_card=<value>)`. Server broadcasts the change
   *  via Event_ChangeZoneProperties AND immediately emits an
   *  Event_RevealCards (via revealTopCardIfNeeded,
   *  server_abstract_player.cpp:558-565) so all players see the
   *  current top card's face. Mirrors
   *  PlayerActions::actAlwaysRevealTopCard (player_actions.cpp:199). */
  onSetAlwaysRevealTopCard?: (value: boolean) => void;
  /** Toggle "always look at top card of library" for THIS player's
   *  deck. Fires `Command_ChangeZoneProperties(zone=DECK,
   *  always_look_at_top_card=<value>)`. Similar to always-reveal but
   *  the server emits Event_RevealCards ONLY to the owner
   *  (server_abstract_player.cpp:567-580) — other players just see a
   *  count-only Event_DumpZone. Mirrors
   *  PlayerActions::actAlwaysLookAtTopCard (player_actions.cpp:207). */
  onSetAlwaysLookAtTopCard?: (value: boolean) => void;
  /** The currently-known top card of the DECK (from
   *  Event_RevealCards fired by the server's revealTopCardIfNeeded
   *  hook). Populated only when this player has always-reveal or
   *  always-look-at on; other players see it only when this player
   *  has always-reveal on. Rendered face-up on the library pile in
   *  place of the card back. */
  deckTopCard?: { name: string; scryfallId: string } | null;
  /** DECK zone's `revealedCards` (populated by Response_DumpZone) as
   *  HandCards. Consumed by the "View top cards" flow to show the
   *  server-authoritative card faces in the search dialog. Empty when
   *  no dump is in flight or after it's been cleared. */
  revealedDeckCards?: readonly HandCard[];
  /** Set the tapped state of one or more battlefield cards. Fires on
   *  double-click; GameBoardCell dispatches one Command_SetCardAttr
   *  per card id. Multi-id calls happen when the double-clicked card
   *  is part of the current marquee selection. */
  onSetCardTapped?: (cardIds: number[], tapped: boolean) => void;
  /** Flip a battlefield card face-up or face-down. */
  onFlipCard?: (cardId: number, faceDown: boolean) => void;
  /** Toggle the "doesn't untap during untap step" attribute
   *  (`AttrDoesntUntap`). Fired by the "Skip untapping" context
   *  menu item. */
  onSetCardDoesntUntap?: (cardId: number, doesntUntap: boolean) => void;
  /** Create a token that copies a battlefield card. Fired by the
   *  "Clone" context menu item — mirrors Cockatrice's `cmClone`,
   *  which is `Command_CreateToken` with the source card's name,
   *  provider id, color, P/T and `destroy_on_zone_change: true`. */
  onCloneCard?: (source: {
    name: string;
    providerId: string;
    color: string;
    pt: string;
    annotation: string;
    y: number;
  }) => void;
  /** Set a card's annotation text via `Command_SetCardAttr` with
   *  `AttrAnnotation`. Empty value clears it. */
  onSetAnnotation?: (cardId: number, annotation: string) => void;
  /** Batch power/toughness update via `Command_SetCardAttr` with
   *  `AttrPT`. Wired to every entry in the "Power / toughness"
   *  submenu (Inc/Dec P, T, PT, flow, Set..., Reset). PlayerBox
   *  computes the new PT string per card using its local card
   *  metadata (Cockatrice-canonical format) and passes the pre-batched
   *  list; the wire dispatches one command per entry. */
  onSetPT?: (items: { cardId: number; pt: string }[]) => void;
  /** Fires one `Command_DeleteArrow` per arrow that THIS player created.
   *  Bound to Ctrl/Cmd+R (matches Cockatrice's "Remove Local Arrows"
   *  shortcut). Only ever invoked on the isSelf PlayerBox — deletes the
   *  local player's arrows, never opponents'. */
  onClearOwnArrows?: () => void;
  /** Fires a `Command_AttachCard` for the "Attach to card..." card
   *  context-menu flow. `sourceCardId` is the card the menu was opened
   *  on; `target` is where the user clicked to resolve the pending
   *  attach. Matches Cockatrice's `PlayerActions::actAttach` →
   *  `ArrowAttachItem` → `attachCards` path (arrow_item.cpp:288-391),
   *  minus the mid-drag arrow visual. */
  onAttachCard?: (
    sourceCardId: number,
    target: { playerId: number; cardId: number },
  ) => void;
  /** Detach a card from whatever it's currently attached to. Sends
   *  `Command_AttachCard` with only `startZone + cardId` (no target) —
   *  Servatrice interprets that as unattach and clears the source's
   *  `attachedTo` link. Ports `PlayerActions::actUnattach`. */
  onUnattachCard?: (sourceCardId: number) => void;
  /** Fires a `Command_CreateArrow` from the "Draw arrow..." card
   *  context-menu flow. Target is either a specific card or a player
   *  target (life pill). `sourceZone` is the wire zone name the source
   *  card lives in — TABLE for battlefield-card arrows, GRAVE / EXILE
   *  for arrows dragged from a pile-view modal. Matches Cockatrice's
   *  `PlayerActions::actDrawArrow` → `CardItem::drawArrow(Qt::red)`
   *  → `ArrowDragItem::mouseReleaseEvent` path (arrow_item.cpp:225-285). */
  onCreateArrow?: (
    sourceCardId: number,
    sourceZone: string,
    target:
      | { kind: 'card'; playerId: number; cardId: number }
      | { kind: 'player'; playerId: number },
  ) => void;
  /** Set an absolute counter value on a card. Wraps
   *  `Command_SetCardCounter { zone, cardId, counterId, counterValue }`
   *  — matches Cockatrice's `PlayerActions::offsetCardCounter` /
   *  `actSetCardCounter`. Server clamps to [0, MAX_COUNTER_VALUE] so
   *  callers can pass raw sums; we still clamp defensively here. */
  onSetCardCounter?: (
    cardId: number,
    counterId: number,
    value: number,
  ) => void;
  /** Server-authoritative mana pool for this player. Keyed by the
   *  color symbol (W/U/B/R/G/C) with the counter's server-assigned id
   *  and current count. Servatrice pre-creates all six on seat, so
   *  once the player is hydrated the object always has all keys. */
  manaCounters?: Partial<
    Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O', { id: number; count: number }>
  >;
  /** Dispatch a `Command_IncCounter` with a signed delta. Wired to
   *  left / right click on the mana pips (+1 / -1) and to the life
   *  counter's ±1 controls; only fires for isSelf. */
  onModifyCounter?: (counterId: number, delta: number) => void;
  /** Absolute-value variant — fires `Command_SetCounter` with a
   *  clamped `value`. Used by the mana pool's "Set counter..." rows
   *  in the battlefield Counters submenu. Life has its own bespoke
   *  wire via `lifeControl.onSet`. */
  onSetPlayerCounter?: (counterId: number, value: number) => void;
  /** Batched card-counter setter — packs every entry into a single
   *  CommandContainer, mirroring Cockatrice's per-batch atomicity
   *  in actIncrementAllCardCounters (player_actions.cpp:1618-1620).
   *  Each entry carries its own `(cardId, counterId, value)` since
   *  every card+counter combo bumps to a different target value. */
  onBulkSetCardCounters?: (
    entries: readonly {
      cardId: number;
      counterId: number;
      value: number;
    }[],
  ) => void;
  /** Fires `Command_SetCardAttr(zone=TABLE, cardId=-1, AttrTapped='0')`
   *  — Servatrice's "cardId=-1" sentinel means "apply to every card
   *  in the zone" (server_player.cpp Server_Card::setAttribute with
   *  allCards=true). One wire untaps the whole battlefield. Mirrors
   *  Cockatrice's actUntapAll (player_actions.cpp) which sends
   *  Command_SetCardAttr without a card_id. Also skips cards flagged
   *  with `doesntUntap` server-side (server_card.cpp:70). */
  onUntapAll?: () => void;
  /** Fires `Command_RollDie(sides=2, count=1)` — a coin flip is just
   *  a d2 in Cockatrice's protocol. Mirrors actFlipCoin
   *  (player_actions.cpp:866-872). Server broadcasts Event_RollDie
   *  and the chat log renders the result. */
  onFlipCoin?: () => void;
  /** Fires `Command_CreateToken` with the supplied token info. Wire
   *  computes y from a Dexie tablerow lookup so the token lands in
   *  the correct row (matches Cockatrice's actCreateAnotherToken —
   *  player_actions.cpp:894-916). "Create token..." opens the modal
   *  in this box and submits through this prop; "Create another token"
   *  re-fires with the last submitted args. */
  onCreateToken?: (args: {
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
    /** Set together to fire a transform (Cockatrice's
     *  Command_CreateToken with target_mode=TRANSFORM_INTO,
     *  player_actions.cpp:1198-1206). The new token is created in
     *  place of the target card — server-side effect is that the
     *  target flips to the specified new face. Used by the
     *  "Token: Transform into '<back-face>'" menu item on DFC
     *  cards. Both fields must be provided together to trigger
     *  transform mode; a bare providerId with no targetCardId
     *  still creates a plain new token. */
    targetCardId?: number;
    targetMode?: 'transform_into' | 'attach_to';
  }) => void;
  /** Draw beacon from Redux. Increments on every `Event_DrawCards` and
   *  is paired with `lastDrawCount` to describe how many cards the last
   *  draw delivered. Watched by the library→hand flight animation so it
   *  fires ONLY for real draws (Command_DrawCards / Command_Mulligan)
   *  and not for zone→hand drags or reveal-to-hand paths. */
  drawSeq?: number;
  lastDrawCount?: number;
  /** Called when the viewer's marquee ends, distributing the highlight
   *  set to each PlayerBox by owner id. Pass an empty map to clear all
   *  foreign highlights. Only invoked from the viewer's PlayerBox. */
  broadcastBattlefieldSelection?: (byOwner: Map<string, Set<string>>) => void;
  /** Called by non-self PlayerBoxes on background pointerdown to forward
   *  a marquee-start to the viewer's PlayerBox. Battlefield.tsx wires
   *  this to the viewer's `startMarquee` imperative handle. */
  onMarqueeStart?: (x: number, y: number) => void;
};

/** Where a marquee started — one of the three selectable zones. A single
 *  marquee never bridges zones; for battlefield, the owning player id is
 *  part of the identity so different battlefields count as different
 *  zones. */
type MarqueeStartZone =
  | { zone: "battlefield"; ownerId: string }
  | { zone: "hand" }
  | { zone: "stack" };

/** Imperative handle exposed by every PlayerBox so a sibling box (via
 *  Battlefield's ref map) can push cards into this player's battlefield,
 *  highlight this player's battlefield cards as part of the viewer's
 *  cross-player marquee, or hand off a marquee-start event. */
export type PlayerBoxHandle = {
  receiveBattlefieldCards: (
    cards: HandCard[],
    intendedSlots: BattlefieldSlot[],
  ) => void;
  /** Set the highlighted card ids on THIS player's battlefield. Called
   *  by the viewer's marquee to show what they've selected on foreign
   *  boards. Only affects rendering — these cards remain non-draggable
   *  for anyone but their owner. Pass an empty set to clear. */
  receiveBattlefieldSelection: (ids: Set<string>) => void;
  /** Begin a marquee from the given viewport coordinates. Non-self
   *  PlayerBoxes call this via the Battlefield router so the viewer's
   *  marquee can start over any player's board — including opponents'
   *  battlefields, which the viewer can select-highlight but not drag. */
  startMarquee: (x: number, y: number) => void;
};

const MANA_COLORS: Array<{
  symbol: "W" | "U" | "B" | "R" | "G" | "C" | "O";
  label: string;
  tint: string;
}> = [
  { symbol: "W", label: "White",     tint: "#f9f1c8" },
  { symbol: "U", label: "Blue",      tint: "#3b82f6" },
  { symbol: "B", label: "Black",     tint: "#4b5563" },
  { symbol: "R", label: "Red",       tint: "#ef4444" },
  { symbol: "G", label: "Green",     tint: "#10b981" },
  { symbol: "C", label: "Colorless", tint: "#9ca3af" },
  // 7th slot — Cockatrice's server pre-creates a "storm" counter
  // (id=7) with orange makeColor(255, 150, 30) at server_player.cpp:102;
  // the desktop UI labels it "Other" and slots it after the colorless
  // pip. We mirror both the position and the tint so muscle memory
  // carries over.
  { symbol: "O", label: "Other",     tint: "#f97316" },
];

// Card dims in px at scale=1. Matches Cockatrice desktop's logical
// scene coords (CardDimensions::WIDTH / HEIGHT in card_dimensions.h), so
// scale=1 here corresponds to fitInView scale=1 in Cockatrice's view.
// Keep in sync with the CSS var fallbacks in cardSize.ts and the base
// dims applied by CardScaleProvider.
const CARD_W_PX_BASE = 72;
const CARD_H_PX_BASE = 102;

/**
 * Non-interactive overlay: dashed outline at every snap slot + the divider
 * marking the lands row. Grid is measured by the parent so slot outlines
 * line up exactly with cards rendered in the same layer.
 *
 * When `mirrored`, the vertical layout is flipped so top-row players (as
 * seen from the viewer sitting at the bottom) render "facing" the viewer:
 * their state row 0 sits at the visual bottom, their lands row (max row)
 * sits at the visual top near their hand.
 */
function BattlefieldSlotOverlay({
  cellWidths,
  colsByRow,
  layout,
  mirrored,
}: {
  cellWidths: ReturnType<typeof computeCellWidths>;
  /** Per-row column count (inclusive) to render outlines for. Rows with
   *  fewer occupied columns still fill up to the min-cols count so an
   *  empty battlefield shows a dashed grid of drop targets. */
  colsByRow: readonly number[];
  layout: BattlefieldLayoutOpts;
  mirrored: boolean;
}) {
  // Global toggle from the header — off by default (matches the "no
  // noisy grid" default) but the user can flip it on to see snap slots
  // when eyeballing layout.
  const showBorders = useSnapGridVisible();
  const rows = layout.rows ?? BATTLEFIELD_ROWS;
  const slots: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const cols = colsByRow[row];
    for (let col = 0; col < cols; col++) {
      slots.push({ row, col });
    }
  }
  return (
    <div className="absolute inset-0 pointer-events-none">
      {slots.map((slot) => {
        // Matches Cockatrice desktop's default (invertVerticalCoordinate
        // stays false). Wire y=0 (CREATURES per `oracleimporter.cpp` +
        // `tableRowToGridY`) renders at container top for the owner
        // (facing the opponent), y=2 (LANDS) at container bottom near
        // the owner's hand. Opponent boards flip via `mirrored` so
        // their creatures still face our creatures at center and their
        // lands sit near their own hand at the top of the screen.
        const displayRow = mirrored ? rows - 1 - slot.row : slot.row;
        const { x, y } = slotOriginPx(
          { row: displayRow, col: slot.col, subSlot: 0 },
          cellWidths,
          layout,
        );
        return (
          <div
            key={`${slot.row}-${slot.col}`}
            // Dashed border toggled by the header "Snap grid" button
            // (useSnapGridVisible). Off by default; on = dashed outline
            // at every snap position so the user can eyeball layout.
            className={
              showBorders
                ? "absolute border border-dashed border-border-strong/40"
                : "absolute"
            }
            style={{
              width: `${layout.cardWidthPx}px`,
              height: `${layout.cardHeightPx}px`,
              left: `${x}px`,
              top: `${y}px`,
              borderRadius: CARD_CORNER_RADIUS,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Full-size zone box matching the Library footprint but WITHOUT the card back
 * image — for zones like Graveyard and Exile where a face-down card isn't the
 * right metaphor. Icon sits as a subtle watermark; count centered on top.
 *
 * Accepts a ref + onPointerDown so it can serve as both a drag source (grab
 * the top card) and a drop target (hit-testing uses the forwarded ref).
 */
const LargeZoneBox = forwardRef<
  HTMLDivElement,
  {
    icon: typeof Heart;
    label: string;
    count: number;
    /** Top card of the pile — its art fills the box so the zone visually
     *  represents what's on top of the physical pile. Null when empty. */
    topCard?: { name: string; scryfallId: string } | null;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    /** Wire owner + zone name, applied as `data-arrow-anchor-*` attrs
     *  so the arrow overlay can anchor arrows to the whole pile when
     *  the specific source card element isn't in the DOM (typical for
     *  arrows drawn from a grave / exile card — the card lives inside
     *  a portal-rendered pile-view modal that findCardEl can't reach,
     *  or the modal is closed entirely). See useGameArrowOverlay's
     *  `findCardEl` fallback path. */
    arrowAnchorPlayerId?: number;
    arrowAnchorZone?: string;
  }
>(function LargeZoneBox(
  {
    icon: Icon,
    label,
    count,
    topCard,
    onPointerDown,
    arrowAnchorPlayerId,
    arrowAnchorZone,
  },
  ref,
) {
  const draggable = !!onPointerDown;
  const { setHoveredCard } = useHoveredCard();
  return (
    <div className="flex justify-center">
      <div
        ref={ref}
        data-drag-source
        data-arrow-anchor-owner={
          arrowAnchorPlayerId != null ? String(arrowAnchorPlayerId) : undefined
        }
        data-arrow-anchor-zone={arrowAnchorZone}
        onPointerDown={onPointerDown}
        onMouseEnter={topCard ? () => setHoveredCard(topCard) : undefined}
        className="relative rounded-md border border-border-subtle bg-bg-base/60 overflow-hidden select-none"
        style={{
          width: CARD_SIDEWAYS_WIDTH,
          height: CARD_SIDEWAYS_HEIGHT,
          cursor: draggable ? "grab" : undefined,
          touchAction: draggable ? "none" : undefined,
        }}
        title={
          topCard ? `${label} — ${count} (top: ${topCard.name})` : `${label} — ${count}`
        }
      >
        {topCard && (
          <img
            // Mirror Card.tsx's fallback: Servatrice's Event_MoveCard
            // populates `new_card_provider_id` from the server-side card
            // DB (server_abstract_player.cpp:470,500), which returns
            // empty for cards not in Servatrice's cards.xml — hitting
            // `/cards/<empty>` returns 404 → broken image. Fall back to
            // `/cards/named?exact=<name>` so the graveyard/exile pile
            // still shows real art when only the name is known.
            src={
              topCard.scryfallId
                ? `https://api.scryfall.com/cards/${topCard.scryfallId}?format=image&version=large`
                : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(topCard.name)}&format=image&version=large`
            }
            alt=""
            draggable={false}
            className="pointer-events-none select-none absolute top-1/2 left-1/2"
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: CARD_CORNER_RADIUS,
              transform: "translate(-50%, -50%) rotate(-90deg)",
            }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-[0.35em] pointer-events-none">
          {!topCard && <Icon size="2.5em" className="text-text-muted shrink-0" />}
          <span
            className="text-white font-modern font-bold tabular-nums text-[3em]"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)" }}
          >
            {count}
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * Face-down sideways card representing a zone stack (library, hand, …).
 * Card back image rotated -90°, with a big count centered on top.
 */
const CardBackZone = forwardRef<
  HTMLDivElement,
  {
    label: string;
    count: number;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    /** When set, the pile renders the given card FACE UP in place of
     *  the card back. Drives the "Always reveal top card" /
     *  "Always look at top card" visualization — Cockatrice's
     *  desktop pile paints the top card face when the corresponding
     *  toggle is on (pile_zone.cpp:47-60). GameBoardCell only
     *  supplies this when the appropriate zone-property flag is
     *  active for the viewer. */
    topCard?: { name: string; scryfallId: string } | null;
  }
>(function CardBackZone({ label, count, onPointerDown, topCard }, ref) {
  const draggable = !!onPointerDown;
  return (
    <div className="flex justify-center">
      <div
        ref={ref}
        data-drag-source
        onPointerDown={onPointerDown}
        className="relative rounded-md overflow-hidden border border-border-strong shadow-inner select-none"
        style={{
          width: CARD_SIDEWAYS_WIDTH,
          height: CARD_SIDEWAYS_HEIGHT,
          cursor: draggable ? "grab" : undefined,
          touchAction: draggable ? "none" : undefined,
        }}
        title={topCard ? `${label} — ${count} (top: ${topCard.name})` : `${label} — ${count}`}
      >
        {topCard ? (
          // Face-up top card via the shared Card renderer (which reads
          // scryfallId / name → art URL). Rotated -90° to match the
          // sideways-pile layout of the card back below. Deliberately
          // NOT pointer-events-none — Card's onMouseEnter needs to
          // fire so the right-rail preview picks up the hovered face.
          // Pile-drag pointerdown still bubbles up to the parent
          // container's handler.
          <div
            className="select-none absolute top-1/2 left-1/2"
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              transform: "translate(-50%, -50%) rotate(-90deg)",
            }}
          >
            <Card name={topCard.name} scryfallId={topCard.scryfallId} />
          </div>
        ) : (
          <img
            src={CARD_BACK_URL}
            alt=""
            draggable={false}
            className="pointer-events-none select-none absolute top-1/2 left-1/2"
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              // ~7.5% of the card width matches the real MTG corner curve and
              // hides the white JPG background showing through the rounded card
              // corners without eating into meaningful art.
              borderRadius: CARD_CORNER_RADIUS,
              transform: "translate(-50%, -50%) rotate(-90deg)",
            }}
          />
        )}
        {/* Dimming overlay sits behind the count number so the big
            white digits stay readable against the busy card-back art.
            Skipped when a top card is showing — Cockatrice desktop
            renders that face fully un-dimmed, matching the visual
            expectation of a face-up card. */}
        {!topCard && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none" aria-hidden />
        )}
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-modern font-bold tabular-nums text-[3em] pointer-events-none"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)" }}
        >
          {count}
        </div>
      </div>
    </div>
  );
}
);

/**
 * Safely evaluate a basic arithmetic expression the user typed into
 * the set-life modal. Supports `+ - * / %` and parentheses.
 *
 * Input is character-filtered before hitting the Function constructor,
 * so nothing but digits, operators, parens, decimal points, and
 * whitespace can make it into the evaluated string. That means no
 * identifiers (letters), no property access, no function calls — the
 * evaluator can only compute against literal numbers.
 *
 * Returns the truncated integer result, or `null` when the input is
 * empty / non-arithmetic / doesn't produce a finite number.
 */
function evalLifeExpression(input: string): number | null {
  const stripped = input.replace(/\s+/g, '');
  if (stripped.length === 0) return null;
  if (!/^[-+*/%().0-9]+$/.test(stripped)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const result = new Function(`"use strict"; return (${stripped})`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return Math.trunc(result);
  } catch {
    return null;
  }
}

/**
 * Modal for setting the local player's life to an arbitrary value.
 * Portal-rendered by PlayerBox; opens via the Ctrl / Cmd + L
 * shortcut. Auto-focuses the input, Enter to save, Escape to cancel,
 * backdrop click to cancel.
 *
 * Accepts basic arithmetic — the user can type `40+10` or `20*2` and
 * the modal computes the value on save. Live preview under the input
 * shows what the current expression evaluates to.
 */
function SetLifeModal({
  currentLife,
  onCancel,
  onConfirm,
  title,
  subtitle,
  ariaLabel,
}: {
  currentLife: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
  /** Optional overrides so this modal can be reused for setting mana
   *  pool / storm counters (not just life). Defaults keep the
   *  original life-total labels. */
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(currentLife));
  const preview = evalLifeExpression(draft);
  // Whether the draft is a plain number (no arithmetic). Used to hide
  // the preview line when it would just duplicate the input.
  const isPlainNumber = /^-?\d+$/.test(draft.trim());

  // Escape closes the modal — bound at window level so the input's
  // native Esc handling isn't the only escape hatch (keeps behavior
  // consistent with clicking the backdrop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const commit = () => {
    if (preview != null) onConfirm(preview);
    else onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? "Set life total"}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-xs rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            {title ?? "Set life total"}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {subtitle ?? (
              <>
                Numbers or math (e.g.{" "}
                <span className="tabular-nums">40+10</span>)
              </>
            )}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          {/* `type="text"` (not "number") so `+`, `-`, `*`, `/`, `(`, `)`
              are allowed — the browser's number input would strip them. */}
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-lg tabular-nums text-text-primary text-center focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {/* Live preview — only shown when the input is an expression
              (skipped for a plain number since the preview would just
              echo what's already in the input). */}
          <div className="text-xs text-text-muted text-center h-4 tabular-nums">
            {preview == null
              ? draft.trim().length > 0
                ? '…'
                : ''
              : isPlainNumber
                ? ''
                : `= ${preview}`}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={preview == null}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Port of Cockatrice's `CardItem::parsePT`. The PT wire string is a
 *  '/'-separated list of tokens; a leading '+' or '-' marks the token
 *  as a signed integer, otherwise it stays a string. Empty input →
 *  empty list. Only used to feed applyPTDelta / applyPTSet below. */
function parsePT(pt: string): (number | string)[] {
  if (!pt) return [];
  // Leading '/' is a Cockatrice special-case: treat the rest as one
  // opaque string token. Preserves inputs like "/foo".
  if (pt.startsWith('/')) return [pt.slice(1)];
  return pt.split('/').map((item) => {
    if (item.length === 0) return '';
    if (item[0] === '+') return parseInt(item.slice(1), 10) || 0;
    if (item[0] === '-') return parseInt(item, 10) || 0;
    return item;
  });
}

/** Extracts the numeric value from a parsed PT token. String tokens like
 *  "2" parse as 2; opaque strings ("*") parse as 0. Mirrors Cockatrice
 *  which does the same via QVariant::toInt on the QVariantList. */
function ptTokenToInt(token: number | string): number {
  if (typeof token === 'number') return token;
  const n = parseInt(token, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Port of `PlayerActions::actIncPT(cards, deltaP, deltaT)`. Applies a
 *  per-card power/toughness delta and returns the resulting wire string.
 *  Matches Cockatrice's three cases: empty PT, single-token PT (power
 *  only), and multi-token PT (power/toughness). */
function applyPTDelta(currentPt: string, deltaP: number, deltaT: number): string {
  const list = parsePT(currentPt);
  const tSuffix = deltaT ? `/${deltaT}` : '';
  if (list.length === 0) {
    return `${deltaP}${tSuffix}`;
  }
  if (list.length === 1) {
    return `${ptTokenToInt(list[0]) + deltaP}${tSuffix}`;
  }
  return `${ptTokenToInt(list[0]) + deltaP}/${ptTokenToInt(list[1]) + deltaT}`;
}

/** Port of `PlayerActions::actSetPT(cards, pt)`. The input string is a
 *  mini-DSL: numeric tokens replace, `+N`/`-N` tokens adjust the same
 *  position on the current PT. Empty input clears the PT. */
function applyPTSet(currentPt: string, input: string): string {
  const inputList = parsePT(input);
  if (inputList.length === 0) return '';
  const oldList = parsePT(currentPt);
  return inputList
    .map((item, i) => {
      if (typeof item === 'number') {
        const old = i < oldList.length ? ptTokenToInt(oldList[i]) : 0;
        return String(old + item);
      }
      return item;
    })
    .join('/');
}

/** Mirrors Cockatrice desktop's `actRequestSetPTDialog` + `actSetPT`:
 *  a small modal pre-filled with the card's current PT. Free-form input
 *  is applied via `applyPTSet` so tokens like `+1/+1` behave the same as
 *  in the desktop client. Escape cancels; Enter submits. */
function SetPTModal({
  cardName,
  currentPT,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  currentPT: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [draft, setDraft] = useState(currentPT);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set power and toughness"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Set power and toughness
          </h2>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {cardName}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(draft);
          }}
        >
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="e.g. 3/4, +1/+1, or blank to clear"
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mirrors Cockatrice desktop's `actRequestViewTopCardsDialog`
 *  / `actRequestViewBottomCardsDialog` (player_actions.cpp:177-197):
 *  prompts for how many cards from the top/bottom of the library to
 *  reveal. Submit fires `Command_DumpZone(zone=DECK, numberCards=N,
 *  isReversed)` and the server response populates `revealedCards`. */
function ViewNCardsModal({
  isReversed,
  deckSize,
  initial,
  onCancel,
  onConfirm,
  titleOverride,
  submitLabel,
}: {
  isReversed: boolean;
  deckSize: number;
  initial: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
  /** Optional title override. When set, wins over the isReversed-derived
   *  default — useful for the "Reveal top cards to <player>" flow which
   *  shares this modal but wants "Reveal top N of library to Bob". */
  titleOverride?: string;
  /** Optional submit-button label. Defaults to "View" for the original
   *  view-top / view-bottom flow. The Top/Bottom-of-library submenus
   *  (Move N to grave/exile, Draw bottom N, Shuffle top/bottom N) reuse
   *  this modal with verb-appropriate labels ("Move", "Draw", "Shuffle"). */
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState(String(initial));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const parsed = parseInt(draft, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1;
  const title = titleOverride ??
    (isReversed
      ? 'View bottom cards of library'
      : 'View top cards of library');
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            {title}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Library size: {Math.max(0, deckSize)}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            const clamped = Math.min(parsed, Math.max(0, deckSize));
            if (clamped <= 0) return;
            onConfirm(clamped);
          }}
        >
          <label className="text-xs text-text-secondary">
            Number of cards
          </label>
          <input
            autoFocus
            type="number"
            min={1}
            max={Math.max(1, deckSize)}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || deckSize <= 0}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLabel ?? "View"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mirrors Cockatrice desktop's `actRequestDrawCardsDialog`
 *  (player_actions.cpp:356-361): prompts for how many cards to draw
 *  from the top of the library. Submit sends Command_DrawCards with
 *  the entered number. Escape cancels; Enter submits. */
function DrawCardsModal({
  deckSize,
  initial,
  onCancel,
  onConfirm,
}: {
  deckSize: number;
  initial: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(initial));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const parsed = parseInt(draft, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1;
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Draw cards"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Draw cards
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Library size: {Math.max(0, deckSize)}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            // Clamp to library size — Cockatrice's server also clamps,
            // but showing the clamped intent here avoids a "why did I
            // only draw 5 when I asked for 100" surprise.
            const clamped = Math.min(parsed, Math.max(0, deckSize));
            if (clamped <= 0) return;
            onConfirm(clamped);
          }}
        >
          <label className="text-xs text-text-secondary">
            Number of cards
          </label>
          <input
            autoFocus
            type="number"
            min={1}
            max={Math.max(1, deckSize)}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || deckSize <= 0}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Draw
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mirrors Cockatrice desktop's `actRequestSetCardCounterDialog`
 *  (player_actions.cpp:1555): prompts for a new counter value at a
 *  specific slot on a specific card. Submit sends
 *  Command_SetCardCounter. Escape cancels; Enter submits. */
function SetCardCounterModal({
  cardName,
  counterLetter,
  counterColor,
  currentValue,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  counterLetter: string;
  counterColor: string;
  currentValue: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(currentValue));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const parsed = parseInt(draft, 10);
  const valid = Number.isFinite(parsed) && parsed >= 0;
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Set counter ${counterLetter}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          {/* Color swatch chip so the user can immediately see which
              counter slot this dialog is editing (matches the menu
              swatch color). */}
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: counterColor }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-modern text-base font-semibold text-text-primary">
              Set counter {counterLetter}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {cardName}
            </p>
          </div>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onConfirm(parsed);
          }}
        >
          <input
            autoFocus
            type="number"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Tailwind port of Cockatrice's `DlgCreateToken` (dlg_create_token.cpp),
 *  invoked from actRequestCreateTokenDialog. Collects the free-form
 *  token identity fields; the parent snapshots the result into
 *  lastToken so "Create another token" can re-fire without reprompting
 *  (matches actCreateToken → actCreateAnotherToken flow,
 *  player_actions.cpp:878-916). Predefined-token chooser is intentionally
 *  omitted — that's a separate menu item still gated off. */
const CREATE_TOKEN_COLOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'w', label: 'White' },
  { value: 'u', label: 'Blue' },
  { value: 'b', label: 'Black' },
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'm', label: 'Multicolor' },
  { value: '', label: 'Colorless' },
];

// Server-side MAX_NAME_LENGTH is 0xff; free-text fields mirror that so
// the payload never trips the server's oversize rejection.
const CREATE_TOKEN_MAX_LEN = 255;

const CREATE_TOKEN_INPUT_CLASS =
  'w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm '
  + 'text-text-primary focus:outline-none focus:border-accent focus:ring-1 '
  + 'focus:ring-accent disabled:opacity-50';

function CreateTokenModal({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: {
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  } | null;
  onCancel: () => void;
  onConfirm: (args: {
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? 'w');
  const [pt, setPT] = useState(initial?.pt ?? '');
  const [annotation, setAnnotation] = useState(initial?.annotation ?? '');
  const [destroyOnZoneChange, setDestroyOnZoneChange] = useState(
    initial?.destroyOnZoneChange ?? true,
  );
  const [faceDown, setFaceDown] = useState(initial?.faceDown ?? false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const trimmed = name.trim();
  const valid = trimmed.length > 0;
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create token"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Create token
          </h2>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) {
              return;
            }
            const payload = {
              name: trimmed,
              color,
              pt: pt.trim(),
              annotation: annotation.trim(),
              destroyOnZoneChange,
              faceDown,
              ...(initial?.providerId && initial.name === trimmed
                ? { providerId: initial.providerId }
                : {}),
            };
            onConfirm(payload);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Name</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, CREATE_TOKEN_MAX_LEN))}
              disabled={faceDown}
              className={CREATE_TOKEN_INPUT_CLASS}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-text-secondary">Color</span>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={faceDown}
                className={CREATE_TOKEN_INPUT_CLASS + ' appearance-none'}
              >
                {CREATE_TOKEN_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-text-secondary">Power / toughness</span>
              <input
                type="text"
                placeholder="e.g. 3/3"
                value={pt}
                onChange={(e) => setPT(e.target.value.slice(0, CREATE_TOKEN_MAX_LEN))}
                disabled={faceDown}
                className={CREATE_TOKEN_INPUT_CLASS}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Annotation</span>
            <input
              type="text"
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value.slice(0, CREATE_TOKEN_MAX_LEN))}
              className={CREATE_TOKEN_INPUT_CLASS}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary select-none">
            <input
              type="checkbox"
              checked={destroyOnZoneChange}
              onChange={(e) => setDestroyOnZoneChange(e.target.checked)}
              className="accent-accent"
            />
            Destroy when it leaves the table
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary select-none">
            <input
              type="checkbox"
              checked={faceDown}
              onChange={(e) => setFaceDown(e.target.checked)}
              className="accent-accent"
            />
            Create face-down
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className={
                'px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary '
                + 'hover:text-text-primary hover:bg-bg-elevated transition-colors'
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className={
                'px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white '
                + 'hover:bg-accent-hover shadow-glow transition-colors '
                + 'disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mirrors Cockatrice desktop's `actRequestMoveCardXCardsFromTopDialog`
 *  (player_actions.cpp:1220-1225): prompts for how many cards from the
 *  top of the library to place the source card behind. Submit sends
 *  Command_MoveCard with x=N so the card lands at position N in the
 *  deck (0 = top, deckSize = bottom). Escape cancels; Enter submits. */
function MoveXCardsFromTopModal({
  cardName,
  deckSize,
  initial,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  deckSize: number;
  initial: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
}) {
  // Track as string so partial edits ("", "-") don't fight the input.
  // Clamped on submit.
  const [draft, setDraft] = useState(String(initial));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const parsed = parseInt(draft, 10);
  const valid = Number.isFinite(parsed) && parsed >= 0;
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Move X cards from the top of library"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Move X cards from the top of library
          </h2>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {cardName}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            // Clamp to library size — Cockatrice does the same at
            // actMoveCardXCardsFromTop (`if number > maxCards → maxCards`).
            const clamped = Math.min(parsed, Math.max(0, deckSize));
            onConfirm(clamped);
          }}
        >
          <label className="text-xs text-text-secondary">
            Place at position (0 = top, {Math.max(0, deckSize)} = bottom)
          </label>
          <input
            autoFocus
            type="number"
            min={0}
            max={Math.max(0, deckSize)}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Move
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mirrors Cockatrice desktop's `actRequestSetAnnotationDialog`: a
 *  small modal pre-filled with the card's current annotation. On
 *  submit the parent fires `Command_SetCardAttr` with
 *  `AttrAnnotation`; the server broadcasts the change and the pill
 *  on the card updates from Redux. Empty text clears the annotation.
 *  Escape cancels; Enter submits. */
function SetAnnotationModal({
  cardName,
  currentAnnotation,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  currentAnnotation: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [draft, setDraft] = useState(currentAnnotation);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set annotation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Set annotation
          </h2>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {cardName}
          </p>
        </div>
        <form
          className="px-4 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(draft);
          }}
        >
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Leave blank to clear"
            className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManaPip({
  symbol,
  label,
  count,
  tint,
  onIncrement,
  onDecrement,
}: {
  symbol: string;
  label: string;
  count: number;
  tint: string;
  /** Left-click handler. When present the pip becomes clickable and
   *  fires the Cockatrice canonical ±1 counter change on the server. */
  onIncrement?: () => void;
  /** Right-click handler; suppresses the browser context menu. */
  onDecrement?: () => void;
}) {
  const clickable = !!onIncrement || !!onDecrement;
  // Standard MTG mana symbols Scryfall has SVGs for at
  // https://svgs.scryfall.io/card-symbols/<X>.svg. The "Other" pool
  // slot (O → Cockatrice's `storm` counter) isn't a real mana symbol
  // and 404s from Scryfall; render a solid tinted circle for those
  // instead so we don't ship a broken-image icon.
  const hasScryfallSvg = /^[WUBRGCX]$/.test(symbol);
  // Pip size dropped from fancy's 2.75em to 2em so the 3-wide grid
  // fits inside the compact info column without widening it.
  return (
    <div
      className="relative"
      style={{
        width: "2em",
        height: "2em",
        cursor: clickable ? "pointer" : undefined,
      }}
      title={label}
      role={clickable ? "button" : undefined}
      onClick={onIncrement}
      onContextMenu={
        onDecrement
          ? (e) => {
              e.preventDefault();
              onDecrement();
            }
          : undefined
      }
    >
      {hasScryfallSvg ? (
        <ManaSymbols cost={`{${symbol}}`} size="2em" />
      ) : (
        // Solid tinted disc for symbols without a Scryfall SVG (e.g.
        // "O" = Cockatrice's Other/storm). Full-opacity fill with a
        // subtle dark ring reads as "physical pip" without needing
        // the ManaSymbols SVG underneath.
        <div
          className="absolute inset-0 rounded-full pointer-events-none border border-black/50"
          style={{ backgroundColor: tint }}
        />
      )}
      {/* 50% color wash sitting on top of the pip. Skipped for pips
          that already have a full-opacity disc (see above) so their
          color isn't washed out to 50%. */}
      {hasScryfallSvg && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ backgroundColor: tint, opacity: 0.5 }}
        />
      )}
      <span
        className="absolute inset-0 flex items-center justify-center text-white font-bold text-[0.75em] tabular-nums pointer-events-none"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)" }}
      >
        {count}
      </span>
    </div>
  );
}

function PlayerBox(
  {
    player,
    isSelf,
    isActive,
    handOnTop,
    flipHandCardBacks = false,
    cards,
    lifeControl,
    zoneCounts,
    graveCards,
    exileCards,
    sideboardCards,
    onDumpSideboard,
    onClearRevealedSideboard,
    handCards,
    battlefieldCards,
    stackCards,
    playerId,
    onMoveCard,
    onDrawCards,
    onMulligan,
    onShuffle,
    onShuffleRange,
    onOpenDeckInEditor,
    onRevealRandomFromZone,
    onRevealZone,
    onUndoDraw,
    onDumpTopCards,
    onClearRevealedDeck,
    revealedDeckCards,
    revealTargets,
    onRevealLibrary,
    onLendLibrary,
    onRevealTopCards,
    alwaysRevealTopCard,
    alwaysLookAtTopCard,
    onSetAlwaysRevealTopCard,
    onSetAlwaysLookAtTopCard,
    deckTopCard,
    onSetCardTapped,
    onFlipCard,
    onSetCardDoesntUntap,
    onCloneCard,
    onSetAnnotation,
    onSetPT,
    onClearOwnArrows,
    onAttachCard,
    onUnattachCard,
    onCreateArrow,
    onSetCardCounter,
    manaCounters,
    onModifyCounter,
    onSetPlayerCounter,
    onBulkSetCardCounters,
    onUntapAll,
    onFlipCoin,
    onCreateToken,
    drawSeq,
    lastDrawCount,
    broadcastBattlefieldSelection,
    onMarqueeStart,
  }: Props,
  ref: React.Ref<PlayerBoxHandle>,
) {
  const name = player.profile?.display_name ?? player.profile?.username ?? "Unknown";
  // Dialog-opening actions surfaced by the game-level provider. Used
  // by the battlefield right-click menu to fire the same Roll die /
  // Game info flows the sidebar buttons already trigger.
  const {
    onRequestRollDie,
    onRequestGameInfo,
    onRequestViewSideboard,
  } = useGameDialogActions();
  // Sideboard view state — mounted below in the modal render block
  // when isSelf. Both open triggers (right-sidebar button + battlefield
  // menu) dispatch through useGameDialogActions so this is the single
  // source of truth.
  const { viewSideboardOpen, closeViewSideboard } = useGameDialogsContext();
  // Fire Command_DumpZone(zone=SIDEBOARD) each time the modal opens.
  // Same pattern as View library: sideboard is a HiddenZone so we
  // don't have `byId`/`order` locally without a dump. Owner-only.
  useEffect(() => {
    if (isSelf && viewSideboardOpen) {
      onDumpSideboard?.();
    }
  }, [isSelf, viewSideboardOpen, onDumpSideboard]);

  // Scaled versions of the base card-related pixel constants. Every layout
  // computation in this component that measures against card size (grid
  // fit, hit-testing, stack layouts, gaps between cards) uses these so a
  // slider adjustment in the header immediately reshapes the play area.
  // Non-card UI (mana pips, life total, sidebar preview, etc.) is
  // unaffected because it doesn't reference these constants.
  const { scale } = useCardScale();
  const CARD_W_PX = CARD_W_PX_BASE * scale;
  const CARD_H_PX = CARD_H_PX_BASE * scale;
  const BATTLEFIELD_GAP_PX = BATTLEFIELD_GAP_PX_BASE * scale;
  const STACK_OFFSET_PX = STACK_OFFSET_PX_BASE * scale;
  const STACK_OFFSET_Y_PX = STACK_OFFSET_Y_PX_BASE * scale;
  const STACK_HOFFSET_PX = STACK_HORIZONTAL_OFFSET_PX * scale;
  const BATTLEFIELD_ROW_PADDING_PX = BATTLEFIELD_ROW_PADDING_PX_BASE * scale;
  const BATTLEFIELD_MARGIN_LEFT_PX = BATTLEFIELD_MARGIN_LEFT_PX_BASE * scale;
  const BATTLEFIELD_MARGIN_RIGHT_PX = BATTLEFIELD_MARGIN_RIGHT_PX_BASE * scale;
  const BATTLEFIELD_MARGIN_TOP_PX = BATTLEFIELD_MARGIN_TOP_PX_BASE * scale;
  // Shared layout options for every battlefield helper call in this
  // PlayerBox. All px values already include the card scale so the
  // helpers stay unit-agnostic — they just do sums and lookups.
  const battlefieldLayout: BattlefieldLayoutOpts = {
    cardWidthPx: CARD_W_PX,
    cardHeightPx: CARD_H_PX,
    gapXPx: BATTLEFIELD_GAP_PX,
    gapYPx: BATTLEFIELD_ROW_PADDING_PX,
    marginLeftPx: BATTLEFIELD_MARGIN_LEFT_PX,
    marginRightPx: BATTLEFIELD_MARGIN_RIGHT_PX,
    marginTopPx: BATTLEFIELD_MARGIN_TOP_PX,
    stackOffsetXPx: STACK_OFFSET_PX,
    stackOffsetYPx: STACK_OFFSET_Y_PX,
    minCols: BATTLEFIELD_MIN_COLS,
    rows: BATTLEFIELD_ROWS,
  };
  // Reserved room at the visual bottom of the battlefield so a fully
  // stacked bottom-row slot (up to MAX_STACK_PER_SLOT cards, each
  // offset by STACK_OFFSET_Y_PX from the last) doesn't clip past the
  // container edge.
  const stackExtPx = (MAX_STACK_PER_SLOT - 1) * STACK_OFFSET_Y_PX;

  // Preload every image in the viewer's deck the moment we have the deck
  // list, so drawing feels instant instead of waiting on Scryfall. Only for
  // the local player — opponents' hand cards never reveal their face, so
  // burning bandwidth on their images would be wasted.
  useEffect(() => {
    if (!isSelf || cards.length === 0) return;
    for (const c of cards) {
      if (c.category === "sideboard") continue;
      const img = new Image();
      img.src = `https://api.scryfall.com/cards/${c.card_scryfall_id}?format=image&version=large`;
    }
  }, [isSelf, cards]);

  // Prefetch every deck card's metadata (`type_line` for hand
  // double-click auto-routing + `power`/`toughness` for the P/T pill
  // on the battlefield). The .cod XML we upload doesn't carry either,
  // so we backfill from the Dexie card DB (Cockatrice XML import) and
  // fall back to Scryfall on miss. Cached by card name because that's
  // what both consumers have cheaply available.
  // Card metadata cache keyed by name. Consumed by:
  //   • Battlefield P/T pills (typeLine + pt).
  //   • Card context menu's currentPT fallback.
  //   • LibrarySearchDialog (backfills type_line / cmc / colors / power /
  //     toughness on DeckCards whose .cod source didn't ship metadata).
  // The .cod XML we upload doesn't carry these fields, so we backfill
  // from the Dexie card DB (Cockatrice XML import) and fall back to
  // Scryfall on miss.
  const [cardMetaByName, setCardMetaByName] = useState<
    Map<
      string,
      {
        typeLine: string;
        pt?: string;
        manaCost?: string;
        cmc?: number;
        colors?: string[];
        power?: string;
        toughness?: string;
        /** Names of tokens (and other related cards) this card
         *  references — powers the "Token: …" items at the bottom of
         *  the right-click menu, matching Cockatrice's
         *  addRelatedCardActions (card_menu.cpp:407-479). Undefined
         *  when the source doesn't carry relations (Scryfall) or the
         *  card genuinely has none. */
        related?: RelatedCardRef[];
        /** Scryfall layout ("transform", "modal_dfc", etc.) — gates
         *  the "Token: Transform into …" menu item. Undefined for
         *  cards.xml-only sources (Cockatrice XML doesn't carry
         *  layout info). */
        layout?: string;
        /** Face data for multi-faced cards. Populated from Scryfall
         *  `card_faces`. Powers the transform target lookup: the
         *  non-current face becomes the new-token payload for
         *  Command_CreateToken with target_mode=TRANSFORM_INTO. */
        faces?: LookupCardFace[];
      }
    >
  >(() => new Map());
  // Resolved token records (full LookupResult per token) keyed by
  // TOKEN name. Populated as battlefield cards' related lists land —
  // see the tokenMetaByName effect below. Tokens are just cards to
  // Scryfall, so we reuse `lookupCard` (which hits Dexie's
  // scryfallCache first, network second) to enrich them. The map
  // stores `LookupResult` so downstream can read power/toughness/
  // colors/printings directly.
  const [tokenMetaByName, setTokenMetaByName] = useState<
    Map<string, LookupResult>
  >(() => new Map());

  /**
   * Resolve the per-face image URL for a card whose current wire
   * name matches one face of a multi-faced record cached in
   * cardMetaByName. Returns undefined for single-face cards or when
   * the lookup effect hasn't populated the DFC yet — Card.tsx
   * gracefully falls back to its default scryfallId-composed URL in
   * that case.
   *
   * Motivation: after a DFC transform (Command_CreateToken with
   * target_mode=TRANSFORM_INTO, Cockatrice-style), the server sets
   * the new card's providerId to the SOURCE card's Scryfall id
   * (Cockatrice's player_actions.cpp:1204 keeps the source's
   * providerId). Scryfall's `/cards/<id>?format=image` for that id
   * always returns the FRONT face, so without a per-face override
   * the transformed card keeps rendering the front face's art.
   * This helper feeds `imageUri` into Card.tsx so the back-face
   * image loads.
   */
  const resolveFaceImageUri = (cardName: string): string | undefined => {
    const meta = cardMetaByName.get(cardName);
    if (!meta?.faces || meta.faces.length < 2) {
      return undefined;
    }
    return meta.faces.find((f) => f.name === cardName)?.imageUri;
  };
  useEffect(() => {
    if (!isSelf || cards.length === 0) return;
    let cancelled = false;
    // Include sideboard cards in the Scryfall metadata fetch —
    // the sideboard viewer's Group by Type / Sort by CMC / etc.
    // dropdowns need the same enrichment as the main deck view.
    // Sideboard cards were previously filtered out under the
    // assumption they wouldn't be inspected in-game.
    const uniqueNames = Array.from(
      new Set(cards.map((c) => c.name)),
    ).filter((name) => !cardMetaByName.has(name));
    if (uniqueNames.length === 0) return;
    void (async () => {
      const results = await Promise.all(
        uniqueNames.map(async (name) => {
          const r = await lookupCard(name);
          const pt =
            r.power != null && r.toughness != null
              ? `${r.power}/${r.toughness}`
              : undefined;
          return [
            name,
            {
              typeLine: r.typeLine ?? "",
              pt,
              manaCost: r.manaCost,
              cmc: r.cmc,
              colors: r.colors,
              power: r.power,
              toughness: r.toughness,
              related: r.related,
              layout: r.layout,
              faces: r.faces,
            },
          ] as const;
        }),
      );
      if (cancelled) return;
      setCardMetaByName((prev) => {
        const next = new Map(prev);
        for (const [name, meta] of results) next.set(name, meta);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // cardMetaByName intentionally omitted: we don't want an
    // "already-cached names" recomputation to re-enter the effect,
    // just want a re-run when the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf, cards]);

  // Fetch Scryfall metadata for cards currently on the battlefield
  // — runs for BOTH self and opponent PlayerBoxes. The initial deck-
  // driven lookup above (gated to `isSelf` because opponent decks
  // aren't wired) only ever populates the local player's own card
  // names, so opponent creatures had no printed-PT fallback and
  // rendered without their P/T pill. This effect closes that gap by
  // enriching whatever appears on the battlefield right now, so an
  // opponent's Grizzly Bears reads "2/2" the same as one you cast
  // yourself. Skipped when the deck-driven effect above already
  // covered the name (has-check).
  useEffect(() => {
    if (!battlefieldCards || battlefieldCards.length === 0) {
      return;
    }
    let cancelled = false;
    const uniqueNames = Array.from(
      new Set(battlefieldCards.map((c) => c.name)),
    ).filter((name) => name && !cardMetaByName.has(name));
    if (uniqueNames.length === 0) {
      return;
    }
    void (async () => {
      const results = await Promise.all(
        uniqueNames.map(async (name) => {
          const r = await lookupCard(name);
          const pt = r.power != null && r.toughness != null
            ? `${r.power}/${r.toughness}`
            : undefined;
          return [
            name,
            {
              typeLine: r.typeLine ?? '',
              pt,
              manaCost: r.manaCost,
              cmc: r.cmc,
              colors: r.colors,
              power: r.power,
              toughness: r.toughness,
              related: r.related,
              layout: r.layout,
              faces: r.faces,
            },
          ] as const;
        }),
      );
      if (cancelled) {
        return;
      }
      setCardMetaByName((prev) => {
        const next = new Map(prev);
        for (const [name, meta] of results) {
          next.set(name, meta);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // cardMetaByName intentionally omitted for the same reason as
    // the deck-driven effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlefieldCards]);

  // Resolve related-card metadata for every parent card that has a
  // related list. Powers the "Token: …" right-click menu items
  // (Cockatrice's addRelatedCardActions, card_menu.cpp:407-479).
  //
  // Tokens (and transform back-faces) are just cards to Scryfall —
  // `lookupCards` hits the persistent scryfallCache first and only
  // reaches the network for names we've never seen. Batched to keep
  // network traffic to at most one /cards/collection round-trip per
  // effect firing (75 identifiers per request, chunked internally).
  //
  // Runs whenever cardMetaByName grows (new card seen with related
  // list). Skips names already resolved so re-runs are cheap.
  useEffect(() => {
    const needed: string[] = [];
    for (const meta of cardMetaByName.values()) {
      if (!meta.related) {
        continue;
      }
      for (const ref of meta.related) {
        if (!tokenMetaByName.has(ref.name)) {
          needed.push(ref.name);
        }
      }
    }
    const uniqueNeeded = Array.from(new Set(needed));
    if (uniqueNeeded.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const results = await lookupCards(uniqueNeeded);
      if (cancelled) {
        return;
      }
      setTokenMetaByName((prev) => {
        const next = new Map(prev);
        // Always cache the answer (even `source: "unknown"`) so we
        // don't re-issue the lookup for a name we already tried.
        for (const name of uniqueNeeded) {
          const r = results.get(name);
          next.set(
            name,
            r ?? { found: false, source: 'unknown', name, printings: [] },
          );
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // tokenMetaByName intentionally omitted — its own updates would
    // otherwise re-enter the effect. Re-runs when cardMetaByName
    // gains new entries with related lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMetaByName]);

  const deckCount = zoneCounts?.deck ?? 0;

  // Refs for measuring the library card and hand zone positions so we can
  // animate a card back travelling between them.
  const libraryRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  // Ref to the search-library dialog while open. The dialog usually
  // floats over the play area's library pile, so drops landing on
  // the dialog need to resolve to the library zone too (otherwise
  // the user can drag cards out but not back in). Populated by the
  // dialog via a callback ref.
  const librarySearchDialogRef = useRef<HTMLDivElement | null>(null);
  // The zone-reveal dialog (used for "View top cards..." today, plus
  // graveyard/exile reveal flows later) needs a ref so the parent's
  // drop-detection can hit-test drops that land on the dialog and
  // resolve them to the source zone.
  const zoneRevealDialogRef = useRef<HTMLDivElement | null>(null);
  // Separate ref for the graveyard / exile view dialog. Same purpose
  // as `zoneRevealDialogRef` — drop-detection needs to hit-test the
  // modal so drops don't fall through to the battlefield behind it.
  // Kept distinct so a same-zone drop resolves to the pile that
  // opened the view (graveyard vs. exile) via `pileView.zone` in
  // detectDropTarget, rather than always assuming "library" like the
  // shared reveal-dialog ref does.
  const pileViewDialogRef = useRef<HTMLDivElement | null>(null);
  // Sideboard view dialog ref — same rationale as pileViewDialogRef
  // (drop-detection needs to hit-test the modal so drops resolve to
  // SIDEBOARD instead of falling through to the battlefield).
  const sideboardDialogRef = useRef<HTMLDivElement | null>(null);

  // In-flight draw animations. Purely visual: a card back tweens from
  // the library rect to the hand rect whenever this player's hand
  // count grows in Redux (a draw or mulligan just happened). Doesn't
  // touch any game state — the drawn card is already committed to
  // Redux by the time the animation starts; the flight is decoration
  // that fires alongside.
  const DRAW_ANIMATION_MS = 450;
  const flightIdCounterRef = useRef(0);
  const [flights, setFlights] = useState<
    { id: number; from: DOMRect; to: DOMRect; landed: boolean }[]
  >([]);
  // Tracks the last observed `drawSeq` from Redux so the effect only fires
  // when the beacon actually ticks — not on unrelated re-renders.
  const prevDrawSeqForFlightRef = useRef<number | null>(null);

  const MULLIGAN_TARGET = 7;
  const mulligan = () => {
    // Command_Mulligan handles it end-to-end: server puts hand back,
    // shuffles, and draws MULLIGAN_TARGET new cards. Redux picks up
    // the resulting Event_MoveCard / Event_DrawCards / Event_Shuffle.
    onMulligan?.(MULLIGAN_TARGET);
  };

  const draw = (n: number) => {
    // Server pops N off the top of the deck and broadcasts
    // Event_DrawCards; Redux updates hand + deck.cardCount from the
    // event, and the draw beacon triggers the library→hand flight
    // animation via the effect below.
    onDrawCards?.(n);
  };

  // Ctrl (Windows/Linux) / Cmd (Mac) shortcuts for the viewer's own actions:
  //   +M → mulligan (fires Command_Mulligan; server + Redux handle the rest)
  //   +L → open the set-life modal (overrides the browser's "focus URL bar")
  //   +R → clear this player's own arrows
  // Ctrl+D and Ctrl+S are handled by og's useGameShortcuts (they dispatch
  // Command_DrawCards / Command_Shuffle globally); no PlayerBox binding.
  // Only bound for the local player — you can't take actions on someone
  // else's zones.
  useEffect(() => {
    if (!isSelf) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        mulligan();
      } else if (key === "l") {
        e.preventDefault();
        setSetLifeModalOpen(true);
      } else if (key === "r") {
        // Cockatrice's "Remove Local Arrows" — clears every arrow THIS
        // player created via one Command_DeleteArrow per arrow. Never
        // touches other players' arrows. Preventing default swallows the
        // browser's Ctrl+R page reload while a game is active.
        e.preventDefault();
        onClearOwnArrows?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Zone display data (hand/battlefield/grave/exile/stack) all comes from
  // Redux via props — see the *DisplayList expressions below. Refs are
  // kept locally so the drag hit-tester can measure each zone's rect.
  const graveyardRef = useRef<HTMLDivElement>(null);
  const exileRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [stackSize, setStackSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setStackSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag state for the local player. Only self can drag — opponents' cards
  // are rendered read-only. Tracking pointer position here lets the portal
  // ghost follow the cursor smoothly.
  const [drag, setDrag] = useState<DragState | null>(null);

  // Marquee selection. Selection is single-zone — the marquee groups whatever
  // it touches by zone and picks the zone contributing the most cards.
  const [selection, setSelection] = useState<Selection | null>(null);
  // "View library" dialog (full-deck reveal). Opened via the library
  // context menu; fires Command_DumpZone(numberCards=-1) on open so
  // the dialog reads the server-authoritative revealed cards.
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  // Right-click card context menu — one shared popup keyed by the card
  // being acted on. Populated by onContextMenu on battlefield cards;
  // cleared by outside click / escape / after an item fires. Only
  // applies to the local player's cards (opponents' cards not owned).
  const [cardContextMenu, setCardContextMenu] = useState<
    { cardId: string; x: number; y: number } | null
  >(null);
  // Per-card context menu inside the pile-view modal (graveyard /
  // exile). Separate state from `cardContextMenu` (which is for
  // battlefield cards) — different item set (view-only actions: Draw
  // arrow, Clone, Select All/Column), and the anchor coords come
  // from the modal's card element, not the board. `zone` is the wire
  // zone name of the source pile (GRAVE / EXILE) so the Draw arrow
  // flow can set `sourceZone` on the pending-arrow state correctly.
  const [pileCardMenu, setPileCardMenu] = useState<
    { zone: string; cardId: string; cardName: string; x: number; y: number } | null
  >(null);
  useEffect(() => {
    if (!cardContextMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-card-context-menu]")) return;
      setCardContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCardContextMenu(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [cardContextMenu]);
  // Same close-on-outside-click / Escape handling for the pile-view
  // per-card menu. Kept separate so the two menus don't fight each
  // other over a shared close signal.
  useEffect(() => {
    if (!pileCardMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-card-context-menu]")) return;
      setPileCardMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPileCardMenu(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pileCardMenu]);
  // Whether the hand row is being hovered — controls the auto-expand
  // that reveals full-size cards over the play area without reflowing
  // the shell (same pattern the PhaseTrack uses on the left edge).
  const [handExpanded, setHandExpanded] = useState(false);
  // Cards on THIS player's battlefield that the viewer highlighted via a
  // cross-player marquee. Purely visual — these cards still aren't
  // draggable by anyone but their owner.
  const [receivedBattlefieldSelection, setReceivedBattlefieldSelection] =
    useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    startZone: MarqueeStartZone | null;
  } | null>(null);
  // PlayerBox root — used both to bound the marquee-start (only clicks
  // inside this box begin a marquee) and to query card elements when
  // finalizing the selection.
  const boxRef = useRef<HTMLDivElement>(null);

  // The battlefield has TWO refs now that it can scroll horizontally:
  //   - `scrollContainerRef`: the visible/scrollable viewport. Measured
  //     here so we know how many columns naturally fit on-screen.
  //   - `battlefieldRef`: the sized content div holding cards + slot
  //     outlines. Its explicit width grows past the viewport as the grid
  //     extends past the fit, triggering horizontal scroll.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const battlefieldRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setFitSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Battlefield source-of-truth for layout — Redux is the only source.
  // See the top-of-file note about local-mock removal.
  const battlefieldDisplayList = battlefieldCards ?? [];
  // Parent → children map for attached cards on THIS player's board.
  // Hoisted early because `computeCellWidths` needs each parent's
  // attach count to widen the parent's cell (cells hosting a heavily-
  // fanned parent grow to the left so the leftward-extending children
  // don't overlap the neighboring column). Reused later by the render
  // pass for absolute positioning.
  const attachedChildrenByParent = (() => {
    const m = new Map<number, BattlefieldCard[]>();
    for (const c of battlefieldDisplayList) {
      if (
        c.attachTargetCardId != null &&
        c.attachTargetPlayerId === playerId
      ) {
        const list = m.get(c.attachTargetCardId) ?? [];
        list.push(c);
        m.set(c.attachTargetCardId, list);
      }
    }
    return m;
  })();
  // Attached-to-own-parent cards live at wire (x=-1, y=-1) — they don't
  // occupy their own slot on the battlefield. Filter them out of the
  // layout input so col 0 / row 0 isn't inflated by every attached card
  // ending up there. The full battlefieldDisplayList is still what the
  // render loop iterates; layout just needs the "free-standing" set.
  //
  // Each free-standing parent carries its `attachedChildCount` so
  // `computeCellWidths` can widen the parent's cell to hold the fan,
  // pushing subsequent columns right — otherwise the leftward-fanning
  // children would overlap the previous column's card.
  const battlefieldForLayout = battlefieldDisplayList
    .filter(
      (c) =>
        c.attachTargetCardId == null || c.attachTargetPlayerId !== playerId,
    )
    .map((c) => ({
      row: c.slot.row,
      col: c.slot.col,
      subSlot: c.subSlot,
      attachedChildCount:
        attachedChildrenByParent.get(Number(c.id))?.length ?? 0,
    }));
  // Per-cell horizontal footprint — a cell with 3 stacked cards is
  // 2×STACK_OFFSET_PX wider than a solo cell, and columns to the right
  // of it shift over by that difference. Ported from Cockatrice's
  // `TableZone::computeCardStackWidths`.
  const cellWidths = computeCellWidths(battlefieldForLayout, battlefieldLayout);
  // Effective min-cols: cap BATTLEFIELD_MIN_COLS at whatever fits in
  // the visible container width. Cockatrice enforces its 5-col MIN_WIDTH
  // via a scene-side floor and lets fitInView scale everything down to
  // fit; we hold card size fixed (height-driven scale) and instead
  // shrink the min-cols reservation so the empty grid doesn't overflow
  // horizontally. `+1` in the fit formula accounts for margins and the
  // final card not needing a trailing gap.
  const effectiveMinCols = (() => {
    if (fitSize.w <= 0) return BATTLEFIELD_MIN_COLS;
    const usable =
      fitSize.w - BATTLEFIELD_MARGIN_LEFT_PX - BATTLEFIELD_MARGIN_RIGHT_PX;
    const perCol = CARD_W_PX + BATTLEFIELD_GAP_PX;
    const fitCols = Math.max(1, Math.floor((usable + BATTLEFIELD_GAP_PX) / perCol));
    return Math.min(BATTLEFIELD_MIN_COLS, fitCols);
  })();
  // Per-row column count including one buffer past the rightmost card
  // (or the min-cols floor) — matches Cockatrice's "always leave a drop
  // target on the right" behavior. Used by the slot overlay to know how
  // many dashed outlines to render per row.
  const colsByRow = (() => {
    const out = new Array<number>(BATTLEFIELD_ROWS).fill(0);
    const maxCol = new Array<number>(BATTLEFIELD_ROWS).fill(-1);
    for (const c of battlefieldForLayout) {
      if (c.row >= 0 && c.row < BATTLEFIELD_ROWS) {
        maxCol[c.row] = Math.max(maxCol[c.row], c.col);
      }
    }
    for (let r = 0; r < BATTLEFIELD_ROWS; r++) {
      out[r] = Math.max(effectiveMinCols, maxCol[r] + 2);
    }
    return out;
  })();
  // Content pixel size — sum of per-row column widths + margins. When
  // stacks push columns right, or when a buffer column opens past the
  // fit width, contentW grows past fitSize.w and the scroll container
  // starts scrolling horizontally.
  const naturalContentW = computeContentWidth(
    cellWidths,
    battlefieldForLayout,
    { ...battlefieldLayout, minCols: effectiveMinCols },
  );
  const naturalContentH = computeContentHeight(battlefieldLayout) + stackExtPx;
  const contentW = Math.max(fitSize.w, naturalContentW);
  const contentH = Math.max(fitSize.h, naturalContentH);
  // Legacy slot-bound shims — group drops / nearest-available-slot search
  // originally iterated a rectangular `grid.cols × grid.rows` space; with
  // per-row column counts we use the widest row as the effective width.
  // Wire rows are fixed at BATTLEFIELD_ROWS.
  const gridRows = BATTLEFIELD_ROWS;
  const gridCols = Math.max(BATTLEFIELD_MIN_COLS, ...colsByRow);

  // Auto-scroll the battlefield to the rightmost edge whenever a
  // genuinely NEW column opens — a card placed on the buffer column
  // past the rightmost stack pushes `maxColsInAnyRow` up by one. Only
  // this case gets the scroll; stacking cards onto an EXISTING slot
  // grows that cell's width and shifts later columns right, but should
  // NOT auto-scroll (the user is looking at the stack they're building,
  // scrolling away hides it).
  const maxColsInAnyRow = colsByRow.reduce((m, n) => Math.max(m, n), 0);
  const prevMaxColsRef = useRef(maxColsInAnyRow);
  useEffect(() => {
    if (maxColsInAnyRow > prevMaxColsRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      }
    }
    prevMaxColsRef.current = maxColsInAnyRow;
  }, [maxColsInAnyRow]);

  // Begin a drag on `cards` (single or group) coming from `sourceZone`.
  // Records the pointer's offset from the primary card's top-left so the
  // ghost stays anchored where the user grabbed. No-op for opponents.
  //
  // `sourcePlayerId` defaults to undefined = "self". Only set when the
  // drag started inside a zone another player lent us — the Lend
  // library flow calls this via the ForeignDragContext registered
  // below, passing the lender's id so the wire dispatches with
  // Command_MoveCard.startPlayerId = <lender>.
  const beginDrag = (
    e: React.PointerEvent<HTMLElement>,
    cards: HandCard[],
    sourceZone: DragSourceZone,
    sourcePlayerId?: number,
  ) => {
    if (!isSelf || e.button !== 0 || cards.length === 0) return;
    // preventDefault suppresses the browser's default text-selection AND
    // its native HTML5 drag on any focusable/selectable child (e.g., the
    // card art). Without it the browser sometimes takes over mid-drag and
    // shows the "no drop" cursor, killing our custom drag.
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({
      cards,
      sourceZone,
      sourcePlayerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialX: e.clientX,
      initialY: e.clientY,
      moved: false,
    });
  };

  // Publish beginDrag into the shared ForeignDragContext when we're
  // the local seat. IncomingRevealDialog (mounted at Game.tsx level,
  // outside this PlayerBox's subtree) uses this to start drags from
  // a lender's revealed library — the drag runs on our infrastructure
  // (ghost, drop detection, applyMove) but with sourcePlayerId set
  // to the lender. Non-self PlayerBoxes don't register — a foreign
  // drag on an opponent's UI wouldn't make sense.
  useRegisterForeignDrag(isSelf ? beginDrag : null);

  // Helpers callsites use at pointerdown time to decide "group drag vs
  // single". If the clicked card is in the current selection and matches
  // the selection's zone, drag the whole group. Otherwise, clear the
  // selection and drag just this one card.
  const startCardDrag = (
    e: React.PointerEvent<HTMLElement>,
    card: HandCard,
    zone: Selection["zone"],
    zoneCards: HandCard[],
  ) => {
    // Opponent card: don't touch selection state — the viewer might have
    // this card highlighted (from a cross-battlefield marquee) and a
    // failed drag attempt shouldn't clear that.
    if (!isSelf) return;
    if (
      selection &&
      selection.zone === zone &&
      selection.ids.has(card.id)
    ) {
      // Card is part of the current selection — start a group drag. A
      // no-move release preserves the group; only actual drag+drop or
      // a click on a non-group card modifies the selection.
      const group = zoneCards.filter((c) => selection.ids.has(c.id));
      beginDrag(e, group, zone);
    } else {
      // Single-card drag. Selection isn't touched yet — the drag
      // pointerup handler decides: if the pointer never moved past the
      // threshold, treat as a click and select just this card. If it
      // moved, treat as a drag and clear selection on drop.
      beginDrag(e, [card], zone);
    }
  };
  const startPileDrag = (
    e: React.PointerEvent<HTMLElement>,
    card: HandCard,
    zone: Exclude<DragSourceZone, "hand" | "battlefield" | "stack">,
  ) => {
    beginDrag(e, [card], zone);
  };

  /** True if this specific card is currently part of an active drag.
   *  Only returns true after the pointer has moved past the threshold —
   *  a click that never becomes a drag doesn't hide its source. */
  const isDragging = (id: string, zone: DragSourceZone) =>
    !!drag &&
    drag.moved &&
    drag.sourceZone === zone &&
    drag.cards.some((c) => c.id === id);

  // Force the grabbing cursor on the whole document while a drag is
  // active. Without this, the OS cursor picks up the style of whatever
  // element is under the pointer — including cursor: not-allowed on
  // disabled phase buttons or other-player zones — which makes the drag
  // look like it's about to fail even though it's fine. Toggling on the
  // "is a drag active" boolean keeps this from thrashing on every pointer
  // move (drag state churns each move to update pointerX/Y).
  const isDragActive = drag !== null && drag.moved;
  useEffect(() => {
    if (!isDragActive) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    const styleEl = document.createElement("style");
    styleEl.textContent = "*, *::before, *::after { cursor: grabbing !important; }";
    document.head.appendChild(styleEl);
    return () => {
      document.body.style.cursor = prev;
      styleEl.remove();
    };
  }, [isDragActive]);

  // Global pointer listeners while dragging. Effect re-registers on every
  // pointer move (drag state churns) — negligible cost, keeps the closure
  // and drop calculation trivially correct.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return null;
        const moved =
          d.moved ||
          Math.abs(e.clientX - d.initialX) > DRAG_MOVEMENT_THRESHOLD_PX ||
          Math.abs(e.clientY - d.initialY) > DRAG_MOVEMENT_THRESHOLD_PX;
        return { ...d, pointerX: e.clientX, pointerY: e.clientY, moved };
      });
    };
    const onUp = (e: PointerEvent) => {
      if (drag.moved) {
        // Real drag: commit drop, clear selection so the group doesn't
        // trail the cards into their new zone.
        const target = detectDropTarget(e.clientX, e.clientY, drag);
        if (target) applyMove(drag.sourceZone, target, drag.cards, drag.sourcePlayerId);
        setSelection(null);
        broadcastBattlefieldSelection?.(new Map());
      } else if (drag.cards.length === 1) {
        // Click, not drag. Two possible interpretations:
        //   1. Pending-attach mode: the previous "Attach to card..."
        //      menu selection set `attachPending`; this click on a
        //      battlefield card resolves the attach (or cancels if the
        //      user clicked the source card again).
        //   2. Normal click: replace the selection with the clicked card.
        const zone = drag.sourceZone;
        const clickedCardId = drag.cards[0].id;
        const clickedCardIdNum = Number(clickedCardId);
        const pending = attachPendingRef.current;
        if (
          pending &&
          zone === "battlefield" &&
          Number.isFinite(clickedCardIdNum) &&
          playerId != null
        ) {
          if (clickedCardIdNum === pending.sourceCardId) {
            // Same card = cancel. Cockatrice's ArrowAttachItem does the
            // same via `targetItem == startItem` short-circuit.
            setAttachPending(null);
          } else {
            onAttachCard?.(pending.sourceCardId, {
              playerId,
              cardId: clickedCardIdNum,
            });
            setAttachPending(null);
          }
        } else if (
          zone === "hand" ||
          zone === "battlefield" ||
          zone === "stack"
        ) {
          setSelection({
            zone,
            ids: new Set([clickedCardId]),
          });
          broadcastBattlefieldSelection?.(new Map());
        }
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, cellWidths]);

  // Marquee pointer effect. Follows the pointer while dragging out a
  // selection rect; on release, finalize the selection.
  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      // Live update the selection as the marquee expands so cards
      // highlight the moment the rect covers them, and un-highlight the
      // moment it doesn't. `pointerup` just closes the marquee — no need
      // to recompute at the end because we already are.
      if (marquee.startZone) {
        const rect = {
          left: Math.min(marquee.x1, e.clientX),
          right: Math.max(marquee.x1, e.clientX),
          top: Math.min(marquee.y1, e.clientY),
          bottom: Math.max(marquee.y1, e.clientY),
        };
        const { own, foreign } = computeMarqueeSelection(
          rect,
          marquee.startZone,
        );
        setSelection(own);
        broadcastBattlefieldSelection?.(foreign);
      }
      setMarquee((m) =>
        m ? { ...m, x2: e.clientX, y2: e.clientY } : null,
      );
    };
    const onUp = () => {
      setMarquee(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [marquee]);

  // Which zone the given viewport point falls in, or null if none. For
  // battlefield, we scan EVERY player's battlefield globally and return
  // the owner id so each board counts as its own zone. Hand/stack are
  // per-player private and only checked against the viewer's own refs.
  const zoneAtPoint = (x: number, y: number): MarqueeStartZone | null => {
    const bfEls = document.querySelectorAll<HTMLElement>(
      "[data-battlefield-owner]",
    );
    for (const el of bfEls) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return {
          zone: "battlefield",
          ownerId: el.dataset.battlefieldOwner ?? "",
        };
      }
    }
    const hit = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (hit(handRef.current)) return { zone: "hand" };
    if (hit(stackRef.current)) return { zone: "stack" };
    return null;
  };

  // Enumerate card elements intersecting the marquee rect across every
  // zone the marquee could touch, then pick a single zone to select from.
  //
  // Rules:
  //   1. Cards intersecting the rect are grouped by zone. Each
  //      battlefield is a separate zone (keyed by owner).
  //   2. If only one zone has intersecting cards → select those,
  //      regardless of whether that zone matches the start point.
  //   3. If multiple zones have intersecting cards → prefer the start
  //      zone. If the start zone isn't among them, fall back to a fixed
  //      priority (battlefield > hand > stack).
  //
  // This lets a marquee that begins in an empty spot (e.g. stack) still
  // catch cards elsewhere, while preventing accidental mixed selections
  // when the rect straddles two zones that both contain cards.
  const computeMarqueeSelection = (
    rect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    },
    startZone: MarqueeStartZone,
  ): { own: Selection | null; foreign: Map<string, Set<string>> } => {
    const disjoint = (r: DOMRect) =>
      r.right < rect.left ||
      r.left > rect.right ||
      r.bottom < rect.top ||
      r.top > rect.bottom;

    // key → { ownerId?, ids }. Keys: "hand", "stack", "battlefield:<id>".
    type Bucket = { ownerId?: string; ids: Set<string> };
    const byZone = new Map<string, Bucket>();
    const addHit = (key: string, id: string, ownerId?: string) => {
      const b = byZone.get(key) ?? { ownerId, ids: new Set<string>() };
      b.ids.add(id);
      byZone.set(key, b);
    };

    const boxEl = boxRef.current;
    if (boxEl) {
      (["hand", "stack"] as const).forEach((z) => {
        const els = boxEl.querySelectorAll<HTMLElement>(
          `[data-card][data-zone="${z}"]`,
        );
        els.forEach((el) => {
          const id = el.dataset.cardId;
          if (!id) return;
          if (disjoint(el.getBoundingClientRect())) return;
          addHit(z, id);
        });
      });
    }
    const bfEls = document.querySelectorAll<HTMLElement>(
      "[data-battlefield-owner]",
    );
    bfEls.forEach((bfEl) => {
      const ownerId = bfEl.dataset.battlefieldOwner ?? "";
      const key = `battlefield:${ownerId}`;
      const cardEls = bfEl.querySelectorAll<HTMLElement>(
        `[data-card][data-zone="battlefield"]`,
      );
      cardEls.forEach((el) => {
        const id = el.dataset.cardId;
        if (!id) return;
        if (disjoint(el.getBoundingClientRect())) return;
        addHit(key, id, ownerId);
      });
    });

    if (byZone.size === 0) return { own: null, foreign: new Map() };

    const startKey =
      startZone.zone === "battlefield"
        ? `battlefield:${startZone.ownerId}`
        : startZone.zone;
    const rank = (k: string) => {
      if (k.startsWith("battlefield:")) return 0;
      if (k === "hand") return 1;
      if (k === "stack") return 2;
      return 3;
    };
    let winnerKey: string;
    if (byZone.size === 1) {
      winnerKey = byZone.keys().next().value as string;
    } else if (byZone.has(startKey)) {
      winnerKey = startKey;
    } else {
      winnerKey = [...byZone.keys()].sort((a, b) => rank(a) - rank(b))[0];
    }

    const winner = byZone.get(winnerKey)!;
    if (winnerKey === "hand") {
      return { own: { zone: "hand", ids: winner.ids }, foreign: new Map() };
    }
    if (winnerKey === "stack") {
      return { own: { zone: "stack", ids: winner.ids }, foreign: new Map() };
    }
    // Battlefield: own if we own it, foreign otherwise.
    if (winner.ownerId === player.user_id) {
      return {
        own: { zone: "battlefield", ids: winner.ids },
        foreign: new Map(),
      };
    }
    return {
      own: null,
      foreign: new Map([[winner.ownerId ?? "", winner.ids]]),
    };
  };

  // PlayerBox root pointerdown: start a marquee when the click landed on
  // background (not on any card/pile). Both viewer + opponent boxes handle
  // this — opponent boxes forward to the viewer's PlayerBox via
  // `onMarqueeStart` so a marquee can begin over any battlefield.
  const onPointerDownBox = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    // Card wrappers, library, graveyard, and exile all have their own
    // pointerdown; let them handle it (they'll manage selection state).
    // Also skip clicks that land inside a floating context menu —
    // React events on portal-rendered menus bubble through the React
    // tree back to this PlayerBox, and treating a menu-item click as
    // "clicked empty background" would clear the marquee selection
    // BEFORE the item's click handler fires, causing the item to
    // rebuild against a stale (null) selection.
    if (
      target?.closest("[data-card]") ||
      target?.closest("[data-drag-source]") ||
      target?.closest("[data-card-context-menu]") ||
      target?.closest("[data-context-menu]")
    ) {
      return;
    }
    // Clicks on a scrollbar (e.g. the hand's horizontal scrollbar) fire
    // pointerdown on the scrolling element with the pointer sitting past
    // clientWidth/clientHeight. Those aren't marquee gestures.
    if (target) {
      const rect = target.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const onHScrollbar =
        target.scrollWidth > target.clientWidth &&
        localY > target.clientHeight;
      const onVScrollbar =
        target.scrollHeight > target.clientHeight &&
        localX > target.clientWidth;
      if (onHScrollbar || onVScrollbar) return;
    }
    if (isSelf) {
      setSelection(null);
      broadcastBattlefieldSelection?.(new Map());
      setMarquee({
        x1: e.clientX,
        y1: e.clientY,
        x2: e.clientX,
        y2: e.clientY,
        startZone: zoneAtPoint(e.clientX, e.clientY),
      });
    } else {
      // Route the marquee-start to the viewer's PlayerBox so it takes
      // over the interaction. `onMarqueeStart` is provided by
      // Battlefield.tsx and looks up the viewer's imperative handle.
      onMarqueeStart?.(e.clientX, e.clientY);
    }
  };

  // Hit-test the pointer against each zone's ref, returning the first
  // match. Battlefield is checked first because it's the biggest area and
  // needs the extra slot-computation step; the others are pure zone hits.
  const detectDropTarget = (
    x: number,
    y: number,
    d: DragState,
  ): DropTarget | null => {
    const insideRect = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      return r;
    };
    // The search-library dialog is a modal — while open, it takes
    // drop priority over everything beneath it (usually the
    // battlefield). Check first so drops on the modal resolve to
    // library instead of leaking through to the covered zone.
    if (insideRect(librarySearchDialogRef.current)) return { zone: "library" };
    // Graveyard / exile view dialog — same overlay-priority principle
    // as the library dialogs above. Resolves to the exact pile the
    // view was opened on, so a same-zone drop (drag out and let go
    // on the modal) is absorbed as a no-op by applyMove's same-zone
    // branch rather than leaking into the battlefield underneath.
    if (pileView && insideRect(pileViewDialogRef.current)) {
      return { zone: pileView.zone };
    }
    // Sideboard view dialog — same overlay-priority pattern. Drops
    // land on the SIDEBOARD zone (HiddenZone), server picks the
    // position via x=-1 (append). Same-zone drops (drag within
    // the sideboard) resolve as no-ops via applyMove's same-zone
    // early return; cross-zone drops (from hand / battlefield /
    // grave / etc.) fire Command_MoveCard(target=SIDEBOARD).
    if (viewSideboardOpen && insideRect(sideboardDialogRef.current)) {
      return { zone: "sideboard" };
    }
    // Zone-reveal dialog — compute which reveal slot the drop lands in
    // so we can move the card to that exact library position via
    // Cockatrice's "Move to → X cards from top" wire path
    // (Command_MoveCard target=DECK x=N). The drop index is between two
    // cards: pointer past a card's horizontal midpoint bumps the index
    // by one so drops land AFTER that card. When the pointer is past
    // the last card entirely, index = cards.length (append to reveal).
    const zrEl = zoneRevealDialogRef.current;
    if (insideRect(zrEl) && zrEl) {
      const cardEls = zrEl.querySelectorAll<HTMLElement>(
        "[data-card][data-card-id]",
      );
      if (cardEls.length === 0) {
        return { zone: "library", revealSlotIndex: 0 };
      }
      let bestIndex = 0;
      let bestDist = Infinity;
      let bestRight = false;
      cardEls.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
          bestRight = x > cx;
        }
      });
      const revealSlotIndex = bestRight ? bestIndex + 1 : bestIndex;
      return { zone: "library", revealSlotIndex };
    }
    // Battlefield hit-test scans EVERY player's battlefield, not just our
    // own — this is what lets the viewer gift cards onto an opponent's
    // battlefield. For each battlefield, the pointer must be inside the
    // VISIBLE scroll container (content can extend past it when scrolled)
    // and the slot is computed against the content div's rect so scroll
    // offset is naturally accounted for.
    const bfEls = document.querySelectorAll<HTMLElement>(
      "[data-battlefield-owner]",
    );
    for (const el of bfEls) {
      // `el` is the scroll container (visible area). Its first child is
      // the sized content div — use it for coordinate math because it
      // stays aligned with the grid regardless of scroll offset.
      const visibleRect = el.getBoundingClientRect();
      if (
        x < visibleRect.left ||
        x > visibleRect.right ||
        y < visibleRect.top ||
        y > visibleRect.bottom
      ) {
        continue;
      }
      const contentEl = el.firstElementChild as HTMLElement | null;
      if (!contentEl) continue;
      const bfRect = contentEl.getBoundingClientRect();
      const ownerId = el.dataset.battlefieldOwner ?? "";
      const mirrored = el.dataset.battlefieldMirrored === "true";
      // Target-specific cellWidths are serialized as JSON on the content
      // div's dataset so the source PlayerBox can snap against the exact
      // same per-column footprint the target renders — a card dropped
      // between a 3-stack and its neighbor lands in the correct column
      // even though this drag logic runs outside the target's render
      // context. Falls back to an empty map for the pre-hydration
      // transient (uniform card-width columns).
      let targetCellWidths: ReturnType<typeof computeCellWidths>;
      try {
        const raw = contentEl.dataset.cellWidths;
        targetCellWidths = raw ? new Map(JSON.parse(raw)) : new Map();
      } catch {
        targetCellWidths = new Map();
      }
      // Pointer position in the target content div's coord space. The
      // content div's rect already accounts for horizontal scroll, so
      // subtracting its left/top gives layout coords.
      const cardLeft = x - d.offsetX;
      const cardTop = y - d.offsetY;
      const localX = cardLeft - bfRect.left;
      const localYRaw = cardTop - bfRect.top;
      // Mirroring: on the OWN board, wire row 0 (creatures) renders at
      // the visual TOP. Opponent boards flip so their creatures still
      // face ours. Snap in the visual coord system, then flip the row
      // back to wire orientation if the target is mirrored.
      const rawSnap = snapPxToSlot(
        localX,
        localYRaw,
        targetCellWidths,
        battlefieldLayout,
      );
      const wireRow = mirrored
        ? BATTLEFIELD_ROWS - 1 - rawSnap.row
        : rawSnap.row;
      return {
        zone: "battlefield",
        slot: { row: wireRow, col: rawSnap.col },
        ownerId,
      };
    }
    const stackRect = insideRect(stackRef.current);
    if (stackRect) {
      // Insertion index is judged against the layout the user actually
      // sees. When dragging cards OUT of the stack, those source cards are
      // hidden and the pile re-flows to `stack.length - drag.cards.length`;
      // matching that count keeps the drop-index visually accurate.
      const layoutCount =
        stackDisplayList.length - (d.sourceZone === "stack" ? d.cards.length : 0);
      const positions = layoutStack(
        layoutCount,
        stackRect.width,
        stackRect.height,
        CARD_W_PX,
        CARD_H_PX,
        STACK_HOFFSET_PX,
      );
      let idx = 0;
      for (const p of positions) {
        const centerY = stackRect.top + p.y + CARD_H_PX / 2;
        if (y > centerY) idx++;
      }
      return { zone: "stack", index: idx };
    }
    if (insideRect(handRef.current)) {
      // Insertion index = number of hand cards whose center-X sits to the
      // LEFT of the pointer, excluding any cards currently being dragged
      // (they've moved with the cursor and shouldn't influence the index).
      const handEls = boxRef.current?.querySelectorAll<HTMLElement>(
        '[data-card][data-zone="hand"]',
      );
      let idx = 0;
      handEls?.forEach((el) => {
        const id = el.dataset.cardId;
        if (!id) return;
        if (d.sourceZone === "hand" && d.cards.some((c) => c.id === id)) {
          return;
        }
        const r = el.getBoundingClientRect();
        if (x > r.left + r.width / 2) idx++;
      });
      return { zone: "hand", index: idx };
    }
    if (insideRect(libraryRef.current)) return { zone: "library" };
    if (insideRect(graveyardRef.current)) return { zone: "graveyard" };
    if (insideRect(exileRef.current)) return { zone: "exile" };
    return null;
  };

  // Move a group of cards from their source zone to the resolved drop
  // target. Handles both single-card and group drags. Same-zone drops are
  // no-ops except battlefield (re-slot) and stack (reorder).
  //
  // `sourcePlayerId` defaults to the local player. Set only when the
  // drag started from another player's zone that they lent us (via
  // Command_RevealCards + grant_write_access) — in that case the wire
  // uses the lender's id for `startPlayerId` so Servatrice routes the
  // move through their zone, checking the write-permission set.
  const applyMove = (
    sourceZone: DragSourceZone,
    target: DropTarget,
    cards: HandCard[],
    sourcePlayerId?: number,
  ) => {
    if (cards.length === 0) return;
    // Foreign drags (from a lent zone) are Cockatrice-parity-limited to
    // battlefield drops only — matching what the desktop client offers
    // via drag-from-ZoneViewWidget. Silently no-op if the user drops
    // anywhere else so the card just visually snaps back.
    if (sourcePlayerId != null && target.zone !== "battlefield") {
      return;
    }
    const ids = new Set(cards.map((c) => c.id));

    // In-place moves within my own battlefield: re-slot + re-append.
    // (Battlefield dropped on someone else's battlefield falls through
    // to the cross-zone path, which handles the gift + source removal.)
    if (
      target.zone === "battlefield" &&
      sourceZone === "battlefield" &&
      target.ownerId === player.user_id
    ) {
      // Re-slot each dragged card row-major from the drop slot, and
      // re-append them to the end of the array so they land on top of
      // any existing stack at the target slot (paint order = array
      // order, and stack index within a slot = insertion order). If
      // the group came from a single source slot (i.e., a stack), skip
      // row-major and target the drop slot for every card — the
      // resolveSlots cap still bumps overflow to neighbors.
      const intended = intendedBattlefieldSlots(cards, target.slot);
      // Wire dispatch: fire Command_MoveCard so the server updates
      // the card's x/y (intra-zone reorder via cardMovedInSameZone).
      // Multi-card group drags fire one wire per card so each lands
      // at its intended slot. Skips optimistic mock-id cards.
      if (onMoveCard && playerId != null) {
        for (let i = 0; i < cards.length; i++) {
          const cardId = Number(cards[i].id);
          if (!Number.isFinite(cardId)) continue;
          const slot = intended[i] ?? target.slot;
          // Wire x = col * 3 to match Cockatrice's stack-column
          // convention (`gridX / 3` = stack column, `gridX % 3` =
          // sub-slot). Sending col*3 places at sub-slot 0; the desktop
          // client's drop resolver bumps to the next sub-slot if the
          // spot is already taken.
          onMoveCard({
            startPlayerId: playerId,
            startZone: ZoneName.TABLE,
            cardsToMove: { card: [{ cardId }] },
            targetPlayerId: playerId,
            targetZone: ZoneName.TABLE,
            x: slot.col * 3,
            y: slot.row,
          });
        }
      }
      return;
    }
    if (target.zone === "stack" && sourceZone === "stack") {
      return;
    }
    if (target.zone === "hand" && sourceZone === "hand") {
      return;
    }
    // Same-zone drops for the remaining zones are no-ops — EXCEPT a
    // library→library drop that landed on the zone-reveal dialog: that's
    // a reorder within the visible reveal, which we forward as
    // Command_MoveCard(source=DECK, target=DECK, x=slot) so the server
    // reorders the deck. Datatrice's cardMoved listener sees the
    // same-zone event and dispatches zoneViewCardReordered, which
    // updates the reveal snapshot in place.
    const isLibraryRevealReorder =
      sourceZone === "library" &&
      target.zone === "library" &&
      target.revealSlotIndex !== undefined;
    if (
      target.zone === sourceZone &&
      target.zone !== "battlefield" &&
      target.zone !== "stack" &&
      target.zone !== "hand" &&
      !isLibraryRevealReorder
    ) {
      return;
    }
    // Wire path: fire Command_MoveCard, then rely on the server's
    // Event_MoveCard broadcast to drive the reducer and refresh the
    // Redux-hydrated display props. There is no local mock to
    // maintain any more.
    //
    // Card addressing on the wire depends on the source zone type:
    //   • Library (HiddenZone) → positional index. Pile drags carry
    //     LIBRARY_TOP_DRAG_PAYLOAD (non-numeric id → cardId: 0).
    //     Reveal-dialog drags carry numeric ids matching the revealed
    //     card's server-side deck position.
    //   • Hand / Battlefield / Grave / Exile / Stack (PublicZone or
    //     PrivateZone) → the real numeric card id Redux carries, taken
    //     verbatim from `card.id`.
    if (onMoveCard && playerId != null) {
      const wireStartZone = wireZoneName(sourceZone);
      const wireTargetZone = wireZoneName(target.zone);
      const targetPlayerId =
        target.zone === "battlefield" ? Number(target.ownerId) : playerId;
      // For battlefield drops: wire x = col * 3 to match Cockatrice's
      // stack-column encoding (`gridX / 3` = stack column, `gridX % 3` =
      // sub-slot 0..2). Sending col*3 always aims for sub-slot 0; the
      // desktop client's drop resolver bumps subsequent cards in the
      // same column to sub-slots 1 and 2 automatically.
      // Drop-on-reveal reorder → translate the reveal slot index to a
      // deck position for the wire's `x`. The invariant is that the
      // drop-target slot lines up with the deck position of whichever
      // revealed card would sit there:
      //   • Top view: revealed[k].id = k, so revealSlotIndex k → x=k.
      //   • Bottom-N view: revealed[k].id = deckCount - N + k, so
      //     revealSlotIndex k → x = deckCount - N + k.
      // Drops past the last revealed slot (revealSlotIndex === N) append
      // after the last-visible card (deckCount for top view, deckCount
      // for bottom view — clamped by the server to the actual last
      // position after the source removal).
      const revealCount = revealedDeckCards?.length ?? 0;
      const revealBase =
        topCardsView?.isReversed ? deckCount - revealCount : 0;
      const revealX =
        target.zone === "library" && target.revealSlotIndex !== undefined
          ? Math.max(
              0,
              Math.min(deckCount, revealBase + target.revealSlotIndex),
            )
          : undefined;
      const x =
        target.zone === "battlefield"
          ? target.slot.col * 3
          : target.zone === "hand" || target.zone === "stack"
            ? target.index
            : target.zone === "sideboard"
              ? -1 // Append to sideboard — HiddenZone with no visible
                   // ordering. Server places the card at the end.
              : revealX ?? 0;
      const y = target.zone === "battlefield" ? target.slot.row : 0;
      // Reveal drops don't need `is_reversed` on the wire — we're
      // sending an exact position via `x`, which the server places at
      // library index `x` regardless. `is_reversed` would only apply
      // to Cockatrice-style front-of-view drops (x=0 + isReversed).
      const isReversedFlag = false;
      let wireCards: { cardId: number }[] | null;
      if (sourceZone === "library") {
        // Library is a HiddenZone: the wire cardId is a POSITION into
        // the server's deck (0 = top). Reveal-dialog drags carry a
        // numeric id equal to the revealed card's deck position — use
        // it verbatim. Pile drags carry LIBRARY_TOP_DRAG_PAYLOAD whose
        // sentinel id parses to NaN, correctly resolving to `cardId: 0`.
        wireCards = cards.map((c) => {
          const realId = Number(c.id);
          return { cardId: Number.isFinite(realId) ? realId : 0 };
        });
      } else if (sourceZone === "sideboard") {
        // Sideboard is a HiddenZone — Servatrice expects a positional
        // cardId. Cards in the sideboard modal come from
        // sideboardZone.revealedCards, which the zoneViewRevealed
        // reducer already reindexed to 0..N-1 positional ids (see
        // reindexRevealed). So the HandCard.id IS the wire cardId —
        // same pattern as the library reveal-dialog drag path above.
        wireCards = cards.map((c) => {
          const realId = Number(c.id);
          return { cardId: Number.isFinite(realId) ? realId : 0 };
        });
      } else {
        wireCards = [];
        for (const c of cards) {
          const cardId = Number(c.id);
          if (!Number.isFinite(cardId)) {
            // Card without a server id — should never happen now that
            // display lists trust Redux exclusively. Skip the wire
            // rather than send a garbage cardId to the server.
            wireCards = null;
            break;
          }
          wireCards.push({ cardId });
        }
      }
      if (wireCards) {
        onMoveCard({
          // Foreign drags (lent zones) use the lender's id here so
          // Servatrice routes the move through their zone; local
          // drags use our own id like always.
          startPlayerId: sourcePlayerId ?? playerId,
          startZone: wireStartZone,
          cardsToMove: { card: wireCards },
          targetPlayerId,
          targetZone: wireTargetZone,
          x,
          y,
          isReversed: isReversedFlag,
        });
        // NOTE: don't re-dump the reveal after a deck-touching move.
        // Datatrice's cardMoved listener already updates the reveal
        // snapshot in place — `zoneViewCardRemoved` prunes cards that
        // leave the deck, `zoneViewCardReordered` handles in-zone
        // moves. Re-dumping would pull FRESH cards from the deck to
        // fill the vacated slot, which is a reveal cheat: if the
        // player asked to see the top 3 and plays one, they'd see the
        // next-hidden card promoted into slot 3 for free. Cockatrice's
        // ZoneView also just shrinks.
      }
      // Reveal reorder is fully server-authoritative — the wire above
      // moves the card in the deck, and datatrice's zoneViewCardReordered
      // reindexes the visible snapshot. Skip the local-mock library
      // mutations below: the reveal card carries a numeric id equal to
      // its (stale) deck position, and prepending it to `library` would
      // pollute `library[0]` so a subsequent pile drag sends that stale
      // id as the wire cardId — the server would then pick the WRONG
      // deck slot (e.g. dragging the pile after "Shivan Reef to top"
      // returns whatever is currently at deck[2], not deck[0]).
      if (isLibraryRevealReorder) {
        return;
      }
    }
  };

  // Decide where each card in a battlefield drop wants to land, before
  // the 3-per-slot cap kicks in. When every card in the group came from
  // the battlefield we preserve the source layout:
  //   - single stack (all same source slot) → collapse onto the drop slot
  //   - multiple stacks → translate every card by (source − anchor) so
  //     the whole selection shape lands at the drop point, keeping each
  //     stack intact relative to the others
  // Any mix that includes cards without source slots (hand, library, …)
  // falls back to row-major spreading from the drop slot.
  const intendedBattlefieldSlots = (
    cards: HandCard[],
    start: BattlefieldSlot,
  ): BattlefieldSlot[] => {
    if (cards.length === 0) return [];
    const srcSlots = cards.map(
      (c) => battlefieldDisplayList.find((bc) => bc.id === c.id)?.slot,
    );
    if (srcSlots.every((s) => s !== undefined)) {
      const defined = srcSlots as BattlefieldSlot[];
      const first = defined[0];
      const allSameSlot = defined.every(
        (s) => s.row === first.row && s.col === first.col,
      );
      if (allSameSlot) return cards.map(() => start);
      // Multiple source stacks: use each card's offset from the group's
      // top-left anchor as its offset from the drop slot. Clamp to grid
      // bounds so the shape gets pushed back on-board when the anchor
      // sits close to an edge.
      const minRow = Math.min(...defined.map((s) => s.row));
      const minCol = Math.min(...defined.map((s) => s.col));
      const rows = Math.max(1, gridRows);
      const cols = Math.max(1, gridCols);
      return defined.map((s) => ({
        row: Math.max(0, Math.min(rows - 1, start.row + (s.row - minRow))),
        col: Math.max(0, Math.min(cols - 1, start.col + (s.col - minCol))),
      }));
    }
    return slotsFrom(start, cards.length);
  };

  // Row-major slot sequence starting at `start`, wrapping to the next row
  // when we run out of columns. Used for placing group drops on the
  // battlefield so cards spread out visibly instead of overlapping.
  const slotsFrom = (
    start: BattlefieldSlot,
    count: number,
  ): BattlefieldSlot[] => {
    const cols = Math.max(1, gridCols);
    const rows = Math.max(1, gridRows);
    const out: BattlefieldSlot[] = [];
    let idx = start.row * cols + start.col;
    for (let i = 0; i < count; i++) {
      const wrapped = idx % (cols * rows);
      out.push({ row: Math.floor(wrapped / cols), col: wrapped % cols });
      idx++;
    }
    return out;
  };

  // Resolve where each card in a drop should actually land, respecting
  // the 3-card-per-slot cap. If the intended slot is full, the card is
  // bumped to the nearest slot (by squared Euclidean distance in row/col
  // space) that still has room. Occupancy accumulates as we place, so a
  // group whose first card fills a slot forces subsequent cards to look
  // elsewhere.
  const resolveSlots = (
    existing: BattlefieldCard[],
    intended: BattlefieldSlot[],
  ): BattlefieldSlot[] => {
    const occ = new Map<string, number>();
    for (const c of existing) {
      const k = `${c.slot.row},${c.slot.col}`;
      occ.set(k, (occ.get(k) ?? 0) + 1);
    }
    const out: BattlefieldSlot[] = [];
    for (const desired of intended) {
      let slot = desired;
      const dk = `${desired.row},${desired.col}`;
      if ((occ.get(dk) ?? 0) >= MAX_STACK_PER_SLOT) {
        slot = findNearestAvailableSlot(desired, occ);
      }
      out.push(slot);
      const k = `${slot.row},${slot.col}`;
      occ.set(k, (occ.get(k) ?? 0) + 1);
    }
    return out;
  };

  // Scan the whole grid, pick the slot with room that's closest to the
  // desired slot in row/col distance. Falls back to the desired slot if
  // the grid is completely full — a pathological case for a battlefield.
  const findNearestAvailableSlot = (
    desired: BattlefieldSlot,
    occ: Map<string, number>,
  ): BattlefieldSlot => {
    let best = desired;
    let bestDist = Infinity;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const k = `${row},${col}`;
        if ((occ.get(k) ?? 0) >= MAX_STACK_PER_SLOT) continue;
        const dRow = row - desired.row;
        const dCol = col - desired.col;
        const dist = dRow * dRow + dCol * dCol;
        if (dist < bestDist) {
          bestDist = dist;
          best = { row, col };
        }
      }
    }
    return best;
  };

  // Cross-player "receive" (gifts) and cross-board marquee forwarding.
  // receiveBattlefieldCards is now a no-op — Redux picks up the gifted
  // card from Servatrice's Event_MoveCard broadcast, so there's no
  // local state to seed; the handle is kept so the type contract with
  // Battlefield.tsx stays stable.
  useImperativeHandle(ref, () => ({
    receiveBattlefieldCards: () => {},
    receiveBattlefieldSelection: (ids: Set<string>) => {
      setReceivedBattlefieldSelection(ids);
    },
    startMarquee: (x: number, y: number) => {
      // Same as the local pointerdown path, but coords come from an
      // opponent's PlayerBox forwarding the interaction to us.
      setSelection(null);
      broadcastBattlefieldSelection?.(new Map());
      setMarquee({
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        startZone: zoneAtPoint(x, y),
      });
    },
  }));

  // Life total — starts at Commander 40. Only mutable by the owning
  // player; opponents render the number read-only. Capped at 9999 so
  // the number can't overflow the display box or (more importantly)
  // push the info column into an obviously silly state.
  const LIFE_MAX = 9999;
  // Matches Cockatrice's counter_limits.h — Servatrice clamps card
  // counter values to [0, 999] server-side. Used client-side by the
  // "Increment all card counters" flow to skip counters already at
  // the cap (matches actIncrementAllCardCounters at
  // player_actions.cpp:1605).
  const MAX_COUNTER_VALUE = 999;
  // Fallback local life state — only used when no `lifeControl` prop
  // is passed (transient pre-hydration or when the player's life
  // counter hasn't landed in Redux yet).
  const [localLife, setLocalLifeState] = useState(40);
  const life = lifeControl ? lifeControl.value : localLife;
  const setLife = (next: number | ((prev: number) => number)) => {
    if (lifeControl) {
      // Controlled: compute the target value + delta and dispatch.
      // Callers that pass a plain number → `onSet`; callers that pass
      // a `(prev) => next` function get their delta forwarded via
      // `onDelta` so downstream selectors can decide whether to emit
      // an inc- or set-counter command (usually inc for the ±1 hover
      // paths, set for the edit-mode input).
      if (typeof next === "function") {
        const target = Math.min(LIFE_MAX, Math.trunc(next(life)));
        lifeControl.onDelta(target - life);
      } else {
        lifeControl.onSet(Math.min(LIFE_MAX, Math.trunc(next)));
      }
      return;
    }
    setLocalLifeState((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;
      return Math.min(LIFE_MAX, Math.trunc(raw));
    });
  };
  // Open state for the set-life modal (Ctrl/Cmd+L for the local player).
  const [setLifeModalOpen, setSetLifeModalOpen] = useState(false);
  // "Set counter..." modal for mana / storm counters. Reuses SetLifeModal
  // (extended with title/subtitle overrides). `null` = closed.
  const [setManaCounterModal, setSetManaCounterModal] = useState<
    { counterId: number; symbol: string; label: string; currentValue: number } | null
  >(null);
  // Annotation modal state — carries the target card ids + current
  // annotation so submit knows what to send. `targetIds` is snapshotted
  // at open time so the confirmed text applies to every card that was
  // selected when the menu opened, even if the selection changes
  // mid-modal (matches Cockatrice's cardMenuAction pattern). Single-
  // card right-click carries just that card's id.
  const [annotationModal, setAnnotationModal] = useState<
    { targetIds: number[]; cardName: string; current: string } | null
  >(null);
  // Set-PT modal state. `targetIds` snapshotted at open time; confirm
  // applies applyPTSet to every card, using each card's own current
  // PT as the base for the DSL. `cardName` and `current` reflect the
  // clicked card for the modal's label/pre-fill.
  const [ptModal, setPTModal] = useState<
    { targetIds: number[]; cardName: string; current: string } | null
  >(null);
  // "Move X cards from top of library..." modal. Snapshot the deck size
  // at open time so the input's max/clamp stay stable even if a draw
  // shrinks the deck mid-dialog.
  const [moveXModal, setMoveXModal] = useState<
    { cardId: number; cardName: string; deckSize: number } | null
  >(null);
  // "Draw cards..." modal — Cockatrice's `actRequestDrawCardsDialog`.
  // Snapshots deck size at open time; the DrawCardsModal clamps input
  // to that snapshot so a concurrent draw doesn't move the goalposts.
  const [drawCardsModal, setDrawCardsModal] = useState<
    { deckSize: number } | null
  >(null);
  // "View top / bottom cards of library..." modal + dialog. The modal
  // asks for N, then the dialog opens with `revealedDeckCards` after
  // the server responds to Command_DumpZone. `isReversed` distinguishes
  // top (false) from bottom (true).
  const [viewNCardsModal, setViewNCardsModal] = useState<
    { isReversed: boolean; deckSize: number } | null
  >(null);
  // The ViewTopCardsDialog carries the direction so its header can
  // read "Top N" or "Bottom N" correctly. `null` = closed.
  const [topCardsView, setTopCardsView] = useState<{ isReversed: boolean } | null>(
    null,
  );
  // "View graveyard" / "View exile" — persistent dialog listing every
  // card in the public pile. Both are PublicZones so Redux already
  // carries the full byId/order — no wire needed to open, unlike the
  // library flows above which have to Command_DumpZone first. Mirrors
  // Cockatrice's actViewGraveyard / actViewRfg (player_actions.cpp:222-230)
  // which just emit requestZoneViewToggle(zone, -1). `null` = closed.
  const [pileView, setPileView] = useState<
    { zone: "graveyard" | "exile" } | null
  >(null);
  // "Reveal top cards to..." prompt. Reuses ViewNCardsModal — the
  // input math (deck-size-clamped positive integer) is identical to
  // the "View top cards" flow. `targetPlayerId === -1` means "All
  // players" and translates to no player_id on the wire (proto2 field
  // presence trap). `deckSize` is snapshotted at open time so a
  // concurrent draw doesn't move the max value while the user types.
  const [revealTopCardsPrompt, setRevealTopCardsPrompt] = useState<
    { targetPlayerId: number; targetName: string; deckSize: number } | null
  >(null);
  // Generic numeric-prompt for the Top-of-library / Bottom-of-library
  // multi-card submenu items (Move top N to grave/exile ± face-down,
  // Draw bottom N, Move bottom N to grave/exile ± face-down, Shuffle
  // top/bottom N). All reuse ViewNCardsModal — same input math (positive
  // integer clamped to deck size) — with a per-action title, submit
  // label, and inline `onSubmit` that fires the wire. Snapshotting the
  // deck size at open time matches other prompts here.
  const [countPrompt, setCountPrompt] = useState<
    {
      title: string;
      submitLabel: string;
      deckSize: number;
      onSubmit: (n: number) => void;
    } | null
  >(null);
  // "Set counters (X)..." modal. Snapshots the current counter value at
  // open time so the input pre-fills correctly. `targetIds` is
  // snapshotted at open time — confirm applies the value to every
  // card that was selected when the menu opened.
  const [setCounterModal, setSetCounterModal] = useState<
    {
      targetIds: number[];
      cardName: string;
      counterId: number;
      counterLetter: string;
      currentValue: number;
    } | null
  >(null);
  // "Create token..." modal (Tailwind — replaces the old MUI
  // CreateTokenDialog wired via useGameDialogs; see feedback memory
  // "Replace MUI, don't override it"). Local to this PlayerBox so the
  // wire fires against the local player's battlefield only, matching
  // where the right-click menu lives.
  const [createTokenModalOpen, setCreateTokenModalOpen] = useState(false);
  // Last successfully-submitted token — powers "Create another token"
  // (Cockatrice's actCreateAnotherToken, player_actions.cpp:894-916).
  // Persisted across the modal's open/close cycle so a subsequent
  // right-click → "Create another token" re-fires with the same args.
  const [lastToken, setLastToken] = useState<{
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  } | null>(null);
  // Pending-attach source: set when the user selects "Attach to card..."
  // from a battlefield card's context menu. Next click on a battlefield
  // card resolves the attach; Escape or clicking the source cancels.
  // Numeric `cardId` because Command_AttachCard needs the wire id, not
  // the string HandCard id. Only set on the isSelf PlayerBox (opponents
  // can't attach FROM their own cards via our UI). The ref is kept in
  // sync so the drag/pointerup useEffect closure — which captures
  // `drag` and only re-registers when it changes — can still read the
  // latest pending state without needing pending in its deps.
  const [attachPending, setAttachPending] = useState<
    { sourceCardId: number; sourceCardName: string } | null
  >(null);
  const attachPendingRef = useRef(attachPending);
  useEffect(() => {
    attachPendingRef.current = attachPending;
  }, [attachPending]);
  // Pending draw-arrow — same shape as attachPending. Menu → set →
  // next battlefield card OR player-target click resolves. Rendered
  // as a live RED arrow following the cursor (Cockatrice's `Qt::red`
  // default for `actDrawArrow`).
  const [drawArrowPending, setDrawArrowPending] = useState<
    {
      sourceCardId: number;
      sourceCardName: string;
      /** Wire zone name of the source card. Defaults to TABLE (battlefield
       *  arrows), set to GRAVE / EXILE when the flow started from a
       *  pile-view modal's card context menu. Passed through to
       *  `onCreateArrow` so the wire's `startZone` matches where the
       *  source card actually lives — arrows drawn from a grave card
       *  render off the grave pile at both ends' clients. */
      sourceZone: string;
    } | null
  >(null);
  // Window-level click resolver for the draw-arrow flow. Unlike attach
  // (which can only target this player's own board), draw-arrow can
  // target ANY player's battlefield card OR any life-pill hitbox. Uses
  // capture-phase click on window so it fires before per-card handlers,
  // and hit-tests via data attributes. Set up only while pending.
  useEffect(() => {
    if (!drawArrowPending || playerId == null) return undefined;
    const onClick = (e: MouseEvent) => {
      // Only respond to LEFT clicks. Right-clicks are the drag-arrow
      // system; middle/other buttons are ignored.
      if (e.button !== 0) return;
      const source = drawArrowPending;
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      // Card hit-test first: closest [data-card-id] with matching
      // owner/zone data attrs (same attrs the right-click-drag hook
      // uses). If found, target the card.
      const cardEl = el.closest('[data-card-id][data-card-owner][data-card-zone]') as HTMLElement | null;
      if (cardEl) {
        const targetPlayerId = Number(cardEl.getAttribute('data-card-owner'));
        const targetCardId = Number(cardEl.getAttribute('data-card-id'));
        if (
          Number.isFinite(targetPlayerId) &&
          Number.isFinite(targetCardId) &&
          !(targetPlayerId === playerId && targetCardId === source.sourceCardId)
        ) {
          e.preventDefault();
          e.stopPropagation();
          onCreateArrow?.(source.sourceCardId, source.sourceZone, {
            kind: 'card',
            playerId: targetPlayerId,
            cardId: targetCardId,
          });
          setDrawArrowPending(null);
          return;
        }
        // Same-card click = cancel. Match Cockatrice's `targetItem == startItem`
        // short-circuit in `ArrowDragItem::mouseReleaseEvent`.
        if (targetPlayerId === playerId && targetCardId === source.sourceCardId) {
          e.preventDefault();
          e.stopPropagation();
          setDrawArrowPending(null);
          return;
        }
      }
      // Player-target hit-test.
      const playerEl = el.closest('[data-arrow-target-kind="player"]') as HTMLElement | null;
      if (playerEl) {
        const targetPlayerId = Number(playerEl.getAttribute('data-arrow-target-player-id'));
        if (Number.isFinite(targetPlayerId)) {
          e.preventDefault();
          e.stopPropagation();
          onCreateArrow?.(source.sourceCardId, source.sourceZone, {
            kind: 'player',
            playerId: targetPlayerId,
          });
          setDrawArrowPending(null);
          return;
        }
      }
      // Click on empty space or non-target UI → cancel.
      setDrawArrowPending(null);
    };
    // Capture phase so we run before React's delegated handlers on the
    // battlefield cards (which would otherwise fire selection / other
    // click effects even after we set the pending state to null).
    window.addEventListener('click', onClick, { capture: true });
    return () => window.removeEventListener('click', onClick, { capture: true });
  }, [drawArrowPending, playerId, onCreateArrow]);
  // Escape cancels any menu-initiated pending flow (attach or draw
  // arrow). Kept on window so it fires regardless of what's focused.
  useEffect(() => {
    if (!attachPending && !drawArrowPending) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAttachPending(null);
        setDrawArrowPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attachPending, drawArrowPending]);

  // Live pointer position — tracked while EITHER menu-initiated
  // arrow flow is pending so we can draw the arrow from the source
  // card to the cursor. Cleared when both flows end so the arrow
  // stops following. Cockatrice uses a mouse-grabbed ArrowAttachItem
  // / ArrowDragItem for the same visual (arrow_item.cpp:177+, 288+);
  // we render an SVG portal instead.
  const [pendingArrowPointer, setPendingArrowPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    if (!attachPending && !drawArrowPending) {
      setPendingArrowPointer(null);
      return undefined;
    }
    const onMove = (e: MouseEvent) => {
      setPendingArrowPointer({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [attachPending, drawArrowPending]);
  // Placeholder values — real state lands with the game-state iteration.
  // Mana pool: read from the wired `manaCounters` when available
  // (Redux-authoritative), fall back to zeros during pre-hydration.
  // Local mana pool is per-player and matches Cockatrice's
  // Servatrice-created counters (w/u/b/r/g/x/storm) — see
  // server_player.cpp:96-102.
  const manaPool: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O', number> = {
    W: manaCounters?.W?.count ?? 0,
    U: manaCounters?.U?.count ?? 0,
    B: manaCounters?.B?.count ?? 0,
    R: manaCounters?.R?.count ?? 0,
    G: manaCounters?.G?.count ?? 0,
    C: manaCounters?.C?.count ?? 0,
    O: manaCounters?.O?.count ?? 0,
  };

  // Displayed counts mirror Cockatrice desktop: read straight from the
  // server-authoritative `zone.cardCount` and DON'T decrement while a
  // card is under the cursor mid-drag. The desktop client also shows
  // the same pre-drop count until the server broadcasts the move back;
  // the visible "card in flight" is the drag ghost, not a badge tweak.
  // Fall back to the local mock zone length only for the pre-hydration
  // transient (before Redux has any zone data at all).
  const displayedDeckCount = zoneCounts?.deck ?? 0;
  const displayedGraveyardCount = zoneCounts?.grave ?? 0;
  const displayedExileCount = zoneCounts?.rfg ?? 0;

  // All zone display lists come straight from Redux — there is no local
  // mock any more. Empty arrays are truthful (an empty zone renders
  // empty, not "the last thing we knew about"). Owner-side pile drags
  // grab the last card in the display list; opponent-side pile drags
  // show a card-back count only (Redux gives us `zone.cardCount`
  // without the actual card identities for hidden zones).
  const graveDisplayList = graveCards ?? [];
  const exileDisplayList = exileCards ?? [];
  const handDisplayList = handCards ?? [];
  const handCount = zoneCounts?.hand ?? handDisplayList.length;

  // DeckCards enriched with Scryfall/Dexie metadata (`cardMetaByName`),
  // used only by the "View library" search dialog. The .cod parser
  // nulls type_line/cmc/colors/mana_cost/power/toughness because .cod
  // XML doesn't ship them; without this backfill, the dialog's Group
  // by Type / Sort by CMC / etc. would degrade to a single "Other"
  // bucket. Prefer any non-null field already on the DeckCard so a
  // future .cod format that DOES carry metadata isn't overwritten.
  const enrichedDeckCards = useMemo<DeckCard[]>(
    () =>
      cards.map((c) => {
        const meta = cardMetaByName.get(c.name);
        if (!meta) return c;
        return {
          ...c,
          type_line: c.type_line ?? meta.typeLine ?? null,
          mana_cost: c.mana_cost ?? meta.manaCost ?? null,
          cmc: c.cmc ?? meta.cmc ?? null,
          colors: c.colors.length > 0 ? c.colors : meta.colors ?? [],
          power: c.power ?? meta.power ?? null,
          toughness: c.toughness ?? meta.toughness ?? null,
        };
      }),
    [cards, cardMetaByName],
  );
  // Fire flight animations from the library rect to the hand rect only
  // when the Redux draw beacon (`drawSeq`) ticks. The beacon is bumped
  // exclusively by the cardsDrawn listener (Event_DrawCards), so drags
  // from other zones into the hand — which grow `handCount` too — never
  // trigger this. `lastDrawCount` says how many flights to spawn. Each
  // PlayerBox measures against its OWN library/hand rects, so it works
  // for self draws (Ctrl+D, mulligan, opening hand) and opponents alike.
  // Guards: skip on first render (no baseline), skip if refs aren't
  // measurable, skip if the beacon didn't actually tick.
  useEffect(() => {
    const currentSeq = drawSeq ?? 0;
    const prev = prevDrawSeqForFlightRef.current;
    prevDrawSeqForFlightRef.current = currentSeq;
    if (prev === null) return; // first render — establish baseline only
    if (currentSeq <= prev) return;
    const drawn = lastDrawCount ?? 0;
    if (drawn <= 0) return;
    const libEl = libraryRef.current;
    const handEl = handRef.current;
    if (!libEl || !handEl) return;
    const from = libEl.getBoundingClientRect();
    const to = handEl.getBoundingClientRect();
    if (from.width === 0 || to.width === 0) return;
    for (let i = 0; i < drawn; i++) {
      const id = ++flightIdCounterRef.current;
      const startDelay = i * 90;
      window.setTimeout(() => {
        setFlights((prev) => [...prev, { id, from, to, landed: false }]);
        // Two rAFs so the initial style commits before the transition
        // target is set — otherwise browsers may collapse both frames
        // and skip the animation.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setFlights((prev) =>
              prev.map((f) => (f.id === id ? { ...f, landed: true } : f)),
            );
          });
        });
        window.setTimeout(() => {
          setFlights((prev) => prev.filter((f) => f.id !== id));
        }, DRAW_ANIMATION_MS + 50);
      }, startDelay);
    }
  }, [drawSeq, lastDrawCount]);
  // `battlefieldDisplayList` is hoisted to the layout section earlier
  // (needed by cellWidths / contentW / contentH) so both the card
  // render loop and the slot overlay resolve against the same source.

  // Parent → children map for attached cards on THIS player's battlefield.
  // `attachedChildrenByParent` is hoisted to the layout section
  // earlier — needed by `computeCellWidths` for attach-aware cell
  // widening. Reused here to fan children beside their parent.

  // Absolute (x, y) render position for every battlefield card, keyed by
  // BattlefieldCard.id. Parents get shifted right + down to make room for
  // their children; children fan diagonally left/up-under from the
  // parent. Skipped attached cards resolve normally (as if unattached)
  // if their parent isn't present on this battlefield — cross-player
  // attach or a race between events.
  const battlefieldPositions = (() => {
    const positions = new Map<string, { x: number; y: number }>();
    // Pass 1: non-attached cards. Parent-with-children get position
    // shifted right by (numChildren * stackOffsetX) and down by 15px so
    // the fanned children extend LEFT into empty space instead of
    // overlapping the parent. Ports `TableZone::reorganizeCards`.
    for (const c of battlefieldDisplayList) {
      if (
        c.attachTargetCardId != null &&
        c.attachTargetPlayerId === playerId
      ) {
        continue;
      }
      const displayRow = handOnTop
        ? BATTLEFIELD_ROWS - 1 - c.slot.row
        : c.slot.row;
      const origin = slotOriginPx(
        { row: displayRow, col: c.slot.col, subSlot: c.subSlot },
        cellWidths,
        battlefieldLayout,
      );
      const numChildren = attachedChildrenByParent.get(Number(c.id))?.length ?? 0;
      positions.set(c.id, {
        x: origin.x + numChildren * STACK_OFFSET_PX,
        y: origin.y + (numChildren > 0 ? 15 * scale : 0),
      });
    }
    // Pass 2: attached children. Position relative to the parent's
    // freshly-computed x/y. First child sits just left of the parent
    // (parent.x - offset), each subsequent child steps another offset
    // further left. Y sits 5px below the parent's base — matches
    // Cockatrice's `childY = y + 5`.
    for (const c of battlefieldDisplayList) {
      if (
        c.attachTargetCardId == null ||
        c.attachTargetPlayerId !== playerId
      ) {
        continue;
      }
      const parentPos = positions.get(String(c.attachTargetCardId));
      if (!parentPos) {
        // Parent not on this battlefield (cross-player attach or race);
        // fall back to slot origin so the child at least renders.
        const displayRow = handOnTop
          ? BATTLEFIELD_ROWS - 1 - c.slot.row
          : c.slot.row;
        const origin = slotOriginPx(
          { row: displayRow, col: c.slot.col, subSlot: c.subSlot },
          cellWidths,
          battlefieldLayout,
        );
        positions.set(c.id, { x: origin.x, y: origin.y });
        continue;
      }
      const siblings = attachedChildrenByParent.get(c.attachTargetCardId) ?? [];
      const idx = siblings.indexOf(c);
      // Reconstruct the PARENT'S row baseline (not the child's own).
      // Cockatrice's `childY = y + 5` uses the parent's mapped Y — an
      // attached card renders in the same row as its target regardless
      // of what slot the wire currently says the child is in. Without
      // this the child would stick to its original row when the parent
      // is elsewhere (see the "col matches but row doesn't" bug).
      const parent = battlefieldDisplayList.find(
        (bc) => Number(bc.id) === c.attachTargetCardId,
      );
      const parentRow = parent?.slot.row ?? c.slot.row;
      const displayRow = handOnTop
        ? BATTLEFIELD_ROWS - 1 - parentRow
        : parentRow;
      const rowY = rowTopY(displayRow, battlefieldLayout);
      positions.set(c.id, {
        x: parentPos.x - (idx + 1) * STACK_OFFSET_PX,
        y: rowY + 5 * scale,
      });
    }
    return positions;
  })();
  // Same "trust Redux in real games" rule as grave/exile above — see
  // that comment for the mock-id mismatch bug this avoids.
  const stackDisplayList = stackCards ?? [];
  const graveyardTopIdx =
    graveDisplayList.length - 1 - (drag?.sourceZone === "graveyard" ? 1 : 0);
  const exileTopIdx =
    exileDisplayList.length - 1 - (drag?.sourceZone === "exile" ? 1 : 0);
  const graveyardTop =
    graveyardTopIdx >= 0 ? graveDisplayList[graveyardTopIdx] : null;
  const exileTop = exileTopIdx >= 0 ? exileDisplayList[exileTopIdx] : null;

  // Shared pile-menu item arrays. Cockatrice's PlayerMenu shows the
  // full grave / exile / library menus as nested submenus of the
  // battlefield right-click; the same menus also live on each pile's
  // own right-click. Extracting to shared arrays keeps the two entry
  // points in lockstep — any change to a pile menu automatically
  // flows through to the battlefield submenu.
  //
  // Helper for the "Move <pile> to <target>" bulk-move click handlers
  // that grave/exile menus both use — enumerates every card in the
  // source pile (in stored bottom→top order, matching desktop) into a
  // single Command_MoveCard.
  const buildMoveAll = (
    source: "graveyard" | "exile",
    list: readonly HandCard[],
    startZone: string,
    targetZone: string,
    x: number,
  ): (() => void) => () => {
    if (!onMoveCard || playerId == null || list.length === 0) return;
    const cards = list
      .map((c) => ({ cardId: Number(c.id) }))
      .filter((c) => Number.isFinite(c.cardId));
    if (cards.length === 0) return;
    // `source` param is intentionally unused inside the wire (startZone
    // carries the wire name); it's a documentation hint for the caller.
    void source;
    onMoveCard({
      startPlayerId: playerId,
      startZone,
      cardsToMove: { card: cards },
      targetPlayerId: playerId,
      targetZone,
      x,
      y: 0,
    });
  };
  // "Reveal random card to..." submenu — used by grave. Same shape as
  // reveal-library: All players (playerId=-1) + separator + one row
  // per opponent. Disabled when the source pile is empty (Servatrice
  // returns RespContextError on empty-zone random reveals,
  // server_abstract_player.cpp:1504).
  const buildRevealRandomSubmenu = (
    zoneName: string,
    zoneSize: number,
  ): ContextMenuItem[] =>
    revealTargets && revealTargets.length > 0
      ? [
          {
            label: "All players",
            onClick: () => onRevealRandomFromZone?.(zoneName, -1),
            disabled: zoneSize <= 0,
          },
          { divider: true },
          ...revealTargets.map((t) => ({
            label: t.name,
            onClick: () => onRevealRandomFromZone?.(zoneName, t.playerId),
            disabled: zoneSize <= 0,
          })),
        ]
      : [{ label: "(no players)" }];
  // Graveyard menu items — ported 1:1 from Cockatrice's GraveyardMenu
  // (grave_menu.cpp:14-36). Full self-view; opponent-view uses just
  // the "View graveyard" item below.
  const graveMenuItemsSelf: ContextMenuItem[] = [
    {
      label: "View graveyard",
      onClick: () => setPileView({ zone: "graveyard" }),
      shortcut: "F4",
    },
    {
      label: "Reveal random card to...",
      disabled: displayedGraveyardCount <= 0,
      submenu: buildRevealRandomSubmenu(ZoneName.GRAVE, displayedGraveyardCount),
    },
    { divider: true },
    {
      // "Move graveyard to..." — bulk move mirrors PileZoneLogic::moveAllToZone
      // (card_zone_logic.cpp:134-153).
      label: "Move graveyard to...",
      disabled: displayedGraveyardCount <= 0,
      submenu: [
        {
          label: "Top of library",
          onClick: buildMoveAll("graveyard", graveDisplayList, ZoneName.GRAVE, ZoneName.DECK, 0),
          disabled: displayedGraveyardCount <= 0,
        },
        {
          label: "Bottom of library",
          onClick: buildMoveAll("graveyard", graveDisplayList, ZoneName.GRAVE, ZoneName.DECK, -1),
          disabled: displayedGraveyardCount <= 0,
        },
        { divider: true },
        {
          label: "Hand",
          onClick: buildMoveAll("graveyard", graveDisplayList, ZoneName.GRAVE, ZoneName.HAND, 0),
          disabled: displayedGraveyardCount <= 0,
        },
        { divider: true },
        {
          label: "Exile",
          onClick: buildMoveAll("graveyard", graveDisplayList, ZoneName.GRAVE, ZoneName.EXILE, 0),
          disabled: displayedGraveyardCount <= 0,
        },
      ],
    },
  ];
  const graveMenuItemsOpponent: ContextMenuItem[] = [
    {
      label: "View graveyard",
      onClick: () => setPileView({ zone: "graveyard" }),
      disabled: displayedGraveyardCount <= 0,
    },
  ];
  // Exile menu items — ported 1:1 from Cockatrice's RfgMenu
  // (rfg_menu.cpp:9-28). Two deliberate omissions vs GraveyardMenu:
  // no "Reveal random card to..." submenu, and Move exile to... ends
  // at "Graveyard" (not a self "Exile" target).
  const exileMenuItemsSelf: ContextMenuItem[] = [
    {
      label: "View exile",
      onClick: () => setPileView({ zone: "exile" }),
    },
    { divider: true },
    {
      label: "Move exile to...",
      disabled: displayedExileCount <= 0,
      submenu: [
        {
          label: "Top of library",
          onClick: buildMoveAll("exile", exileDisplayList, ZoneName.EXILE, ZoneName.DECK, 0),
          disabled: displayedExileCount <= 0,
        },
        {
          label: "Bottom of library",
          onClick: buildMoveAll("exile", exileDisplayList, ZoneName.EXILE, ZoneName.DECK, -1),
          disabled: displayedExileCount <= 0,
        },
        { divider: true },
        {
          label: "Hand",
          onClick: buildMoveAll("exile", exileDisplayList, ZoneName.EXILE, ZoneName.HAND, 0),
          disabled: displayedExileCount <= 0,
        },
        { divider: true },
        {
          label: "Graveyard",
          onClick: buildMoveAll("exile", exileDisplayList, ZoneName.EXILE, ZoneName.GRAVE, 0),
          disabled: displayedExileCount <= 0,
        },
      ],
    },
  ];
  const exileMenuItemsOpponent: ContextMenuItem[] = [
    {
      label: "View exile",
      onClick: () => setPileView({ zone: "exile" }),
      disabled: displayedExileCount <= 0,
    },
  ];

  // Library menu items — ported 1:1 from Cockatrice's LibraryMenu.
  // Cockatrice attaches the SAME LibraryMenu instance to both the
  // library pile and the battlefield PlayerMenu (player_menu.cpp:23,67),
  // so the two entry points share this const.
  //
  // Helper: single-card "Top of library..." → target move click. Wire
  // uses cardId=0 (cmdSetTopCard, player_actions.cpp:376).
  const buildMoveTopCardTo = (
    targetZone: string,
    x: number,
    faceDown?: boolean,
  ): (() => void) => () => {
    if (!onMoveCard || playerId == null || deckCount <= 0) return;
    onMoveCard({
      startPlayerId: playerId,
      startZone: ZoneName.DECK,
      cardsToMove: {
        card: [faceDown ? { cardId: 0, faceDown: true } : { cardId: 0 }],
      },
      targetPlayerId: playerId,
      targetZone,
      x,
      y: 0,
    });
  };
  // Single-card "Bottom of library..." → target move click. Wire uses
  // cardId=deckCount-1 (cmdSetBottomCard, player_actions.cpp:384).
  const buildMoveBottomCardTo = (
    targetZone: string,
    x: number,
    faceDown?: boolean,
  ): (() => void) => () => {
    if (!onMoveCard || playerId == null || deckCount <= 0) return;
    const id = deckCount - 1;
    onMoveCard({
      startPlayerId: playerId,
      startZone: ZoneName.DECK,
      cardsToMove: {
        card: [faceDown ? { cardId: id, faceDown: true } : { cardId: id }],
      },
      targetPlayerId: playerId,
      targetZone,
      x,
      y: 0,
    });
  };
  // Multi-card "Move top N to <target>" prompt. Iterates i in
  // [N-1..0] to match moveTopCardsTo iteration order (player_actions.cpp:475).
  const promptMoveTopNTo = (
    title: string,
    targetZone: string,
    faceDown?: boolean,
  ): (() => void) => () => {
    const size = deckCount;
    if (!onMoveCard || playerId == null || size <= 0) return;
    setCountPrompt({
      title,
      submitLabel: "Move",
      deckSize: size,
      onSubmit: (n) => {
        const count = Math.min(n, size);
        if (count <= 0) return;
        const cards: { cardId: number; faceDown?: boolean }[] = [];
        for (let i = count - 1; i >= 0; i--) {
          cards.push(faceDown ? { cardId: i, faceDown: true } : { cardId: i });
        }
        onMoveCard({
          startPlayerId: playerId,
          startZone: ZoneName.DECK,
          cardsToMove: { card: cards },
          targetPlayerId: playerId,
          targetZone,
          x: 0,
          y: 0,
        });
      },
    });
  };
  // Multi-card "Move bottom N to <target>" prompt. Iterates i in
  // [maxCards-N..maxCards-1] to match moveBottomCardsTo iteration
  // order (player_actions.cpp:673) and actDrawBottomCards (:798).
  const promptMoveBottomNTo = (
    title: string,
    submitLabel: string,
    targetZone: string,
    faceDown?: boolean,
  ): (() => void) => () => {
    const size = deckCount;
    if (!onMoveCard || playerId == null || size <= 0) return;
    setCountPrompt({
      title,
      submitLabel,
      deckSize: size,
      onSubmit: (n) => {
        const count = Math.min(n, size);
        if (count <= 0) return;
        const cards: { cardId: number; faceDown?: boolean }[] = [];
        for (let i = size - count; i < size; i++) {
          cards.push(faceDown ? { cardId: i, faceDown: true } : { cardId: i });
        }
        onMoveCard({
          startPlayerId: playerId,
          startZone: ZoneName.DECK,
          cardsToMove: { card: cards },
          targetPlayerId: playerId,
          targetZone,
          x: 0,
          y: 0,
        });
      },
    });
  };
  // Reveal targets → submenu builder for "Reveal library to..." and
  // "Reveal top cards to...". Reveal-library variant includes an "All
  // players" option; reveal-top-N variant opens a numeric prompt per
  // pick. Lend-library variant omits "All players" (library_menu.cpp:280-293).
  const revealLibraryItems: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? [
          { label: "All players", onClick: () => onRevealLibrary?.(-1) },
          { divider: true },
          ...revealTargets.map((t) => ({
            label: t.name,
            onClick: () => onRevealLibrary?.(t.playerId),
          })),
        ]
      : [{ label: "(no players)" }];
  const lendLibraryItems: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? revealTargets.map((t) => ({
          label: t.name,
          onClick: () => onLendLibrary?.(t.playerId),
        }))
      : [{ label: "(no players)" }];
  const revealTopCardsItems: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? [
          {
            label: "All players",
            onClick: () =>
              setRevealTopCardsPrompt({
                targetPlayerId: -1,
                targetName: "all players",
                deckSize: deckCount,
              }),
          },
          { divider: true },
          ...revealTargets.map((t) => ({
            label: t.name,
            onClick: () =>
              setRevealTopCardsPrompt({
                targetPlayerId: t.playerId,
                targetName: t.name,
                deckSize: deckCount,
              }),
          })),
        ]
      : [{ label: "(no players)" }];
  const libraryMenuItems: ContextMenuItem[] = [
    {
      label: "Draw card",
      onClick: () => draw(1),
      disabled: deckCount <= 0,
      shortcut: isMac() ? "⌘D" : "Ctrl+D",
    },
    {
      label: "Draw cards...",
      onClick: () => setDrawCardsModal({ deckSize: deckCount }),
      disabled: deckCount <= 0,
      shortcut: isMac() ? "⌘E" : "Ctrl+E",
    },
    {
      label: "Undo last draw",
      onClick: () => onUndoDraw?.(),
      // Cockatrice always shows this enabled; server rejects when
      // nothing to undo.
      shortcut: isMac() ? "⌘⇧D" : "Ctrl+Shift+D",
    },
    { divider: true },
    {
      label: "Shuffle",
      onClick: () => onShuffle?.(),
      disabled: deckCount <= 1,
      shortcut: isMac() ? "⌘S" : "Ctrl+S",
    },
    { divider: true },
    {
      label: "View library",
      onClick: () => {
        onDumpTopCards?.(-1, false);
        setLibrarySearchOpen(true);
      },
      disabled: deckCount <= 0,
      shortcut: "F3",
    },
    {
      label: "View top cards of library...",
      onClick: () =>
        setViewNCardsModal({ isReversed: false, deckSize: deckCount }),
      disabled: deckCount <= 0,
      shortcut: isMac() ? "⌘W" : "Ctrl+W",
    },
    {
      label: "View bottom cards of library...",
      onClick: () =>
        setViewNCardsModal({ isReversed: true, deckSize: deckCount }),
      disabled: deckCount <= 0,
      shortcut: isMac() ? "⌘⇧W" : "Ctrl+Shift+W",
    },
    { divider: true },
    { label: "Reveal library to...", submenu: revealLibraryItems },
    { label: "Lend library to...", submenu: lendLibraryItems },
    { label: "Reveal top cards to...", submenu: revealTopCardsItems },
    {
      label: "Always reveal top card",
      checked: alwaysRevealTopCard ?? false,
      onClick: () => onSetAlwaysRevealTopCard?.(!alwaysRevealTopCard),
      shortcut: isMac() ? "⌘N" : "Ctrl+N",
    },
    {
      label: "Always look at top card",
      checked: alwaysLookAtTopCard ?? false,
      onClick: () => onSetAlwaysLookAtTopCard?.(!alwaysLookAtTopCard),
      shortcut: isMac() ? "⌘⇧N" : "Ctrl+Shift+N",
    },
    { divider: true },
    {
      label: "Top of library...",
      disabled: deckCount <= 0,
      submenu: [
        {
          label: "Play top card",
          onClick: buildMoveTopCardTo(ZoneName.STACK, -1),
          disabled: deckCount <= 0,
        },
        {
          label: "Play top card face down",
          onClick: buildMoveTopCardTo(ZoneName.TABLE, -1, true),
          disabled: deckCount <= 0,
        },
        {
          label: "Put top card on bottom",
          onClick: buildMoveTopCardTo(ZoneName.DECK, -1),
          disabled: deckCount <= 0,
        },
        { divider: true },
        {
          label: "Move top card to graveyard",
          onClick: buildMoveTopCardTo(ZoneName.GRAVE, 0),
          disabled: deckCount <= 0,
        },
        {
          label: "Move top cards to graveyard...",
          onClick: promptMoveTopNTo("Move top cards to graveyard", ZoneName.GRAVE),
          disabled: deckCount <= 0,
        },
        {
          label: "Move top cards to graveyard face down...",
          onClick: promptMoveTopNTo(
            "Move top cards to graveyard face down",
            ZoneName.GRAVE,
            true,
          ),
          disabled: deckCount <= 0,
        },
        {
          label: "Move top card to exile",
          onClick: buildMoveTopCardTo(ZoneName.EXILE, 0),
          disabled: deckCount <= 0,
        },
        {
          label: "Move top cards to exile...",
          onClick: promptMoveTopNTo("Move top cards to exile", ZoneName.EXILE),
          disabled: deckCount <= 0,
        },
        {
          label: "Move top cards to exile face down...",
          onClick: promptMoveTopNTo(
            "Move top cards to exile face down",
            ZoneName.EXILE,
            true,
          ),
          disabled: deckCount <= 0,
        },
        {
          // Filter-expression dialog with autoPlay; needs its own
          // dialog before we can wire it. Left disabled so menu shape
          // still reads 1:1 with desktop.
          label: "Put top cards on stack until...",
          disabled: true,
        },
        { divider: true },
        {
          label: "Shuffle top cards...",
          onClick: () => {
            const size = deckCount;
            if (!onShuffleRange || size <= 0) return;
            setCountPrompt({
              title: "Shuffle top cards",
              submitLabel: "Shuffle",
              deckSize: size,
              onSubmit: (n) => {
                const count = Math.min(n, size);
                if (count <= 0) return;
                // Command_Shuffle range is inclusive: [0, N-1] shuffles
                // positions 0..N-1 (player_actions.cpp:267-268).
                onShuffleRange(0, count - 1);
              },
            });
          },
          disabled: deckCount <= 0,
        },
      ],
    },
    {
      label: "Bottom of library...",
      disabled: deckCount <= 0,
      submenu: [
        {
          label: "Draw bottom card",
          onClick: buildMoveBottomCardTo(ZoneName.HAND, 0),
          disabled: deckCount <= 0,
        },
        {
          label: "Draw bottom cards...",
          onClick: promptMoveBottomNTo(
            "Draw bottom cards",
            "Draw",
            ZoneName.HAND,
          ),
          disabled: deckCount <= 0,
        },
        { divider: true },
        {
          label: "Play bottom card",
          onClick: buildMoveBottomCardTo(ZoneName.STACK, -1),
          disabled: deckCount <= 0,
        },
        {
          label: "Play bottom card face down",
          onClick: buildMoveBottomCardTo(ZoneName.TABLE, -1, true),
          disabled: deckCount <= 0,
        },
        {
          label: "Put bottom card on top",
          onClick: buildMoveBottomCardTo(ZoneName.DECK, 0),
          disabled: deckCount <= 0,
        },
        { divider: true },
        {
          label: "Move bottom card to graveyard",
          onClick: buildMoveBottomCardTo(ZoneName.GRAVE, 0),
          disabled: deckCount <= 0,
        },
        {
          label: "Move bottom cards to graveyard...",
          onClick: promptMoveBottomNTo(
            "Move bottom cards to graveyard",
            "Move",
            ZoneName.GRAVE,
          ),
          disabled: deckCount <= 0,
        },
        {
          label: "Move bottom cards to graveyard face down...",
          onClick: promptMoveBottomNTo(
            "Move bottom cards to graveyard face down",
            "Move",
            ZoneName.GRAVE,
            true,
          ),
          disabled: deckCount <= 0,
        },
        {
          label: "Move bottom card to exile",
          onClick: buildMoveBottomCardTo(ZoneName.EXILE, 0),
          disabled: deckCount <= 0,
        },
        {
          label: "Move bottom cards to exile...",
          onClick: promptMoveBottomNTo(
            "Move bottom cards to exile",
            "Move",
            ZoneName.EXILE,
          ),
          disabled: deckCount <= 0,
        },
        {
          label: "Move bottom cards to exile face down...",
          onClick: promptMoveBottomNTo(
            "Move bottom cards to exile face down",
            "Move",
            ZoneName.EXILE,
            true,
          ),
          disabled: deckCount <= 0,
        },
        { divider: true },
        {
          label: "Shuffle bottom cards...",
          onClick: () => {
            const size = deckCount;
            if (!onShuffleRange || size <= 0) return;
            setCountPrompt({
              title: "Shuffle bottom cards",
              submitLabel: "Shuffle",
              deckSize: size,
              onSubmit: (n) => {
                const count = Math.min(n, size);
                if (count <= 0) return;
                // `[-N, -1]` — negative indices count from the end
                // (server accepts either sign; Cockatrice desktop
                // always sends negative for bottom, :298-299).
                onShuffleRange(-count, -1);
              },
            });
          },
          disabled: deckCount <= 0,
        },
      ],
    },
    { divider: true },
    {
      // Webatrice divergence: instead of reconstructing the deck
      // in-app, we route to the same `/deck/:id` page a My Decks
      // row-click opens. Disabled when the game's deck doesn't
      // match any of the user's saved decks (name-based lookup
      // happens in GameBoardCell).
      label: "Open deck in deck editor",
      onClick: onOpenDeckInEditor,
      disabled: !onOpenDeckInEditor,
    },
  ];

  // Battlefield right-click menu — Cockatrice's PlayerMenu (attached
  // to the TableZoneGraphicsItem, player_menu.cpp:60-62). Shape
  // matches 1:1 with the desktop menu. Pile submenus (Hand, Library,
  // Graveyard, Exile, Sideboard) already have their own right-click
  // menus on their piles; here we surface a single hint item pointing
  // there instead of duplicating hundreds of lines of already-wired
  // items. Utility actions we don't yet wire (untap-all, flip-coin,
  // create-token, counters, custom-zones) render disabled so the shape
  // still reads as identical to Cockatrice. Gated to isSelf per
  // player_menu.cpp — spectators / opponents don't get this menu.
  const handSize = handCards?.length ?? 0;
  // Reveal-hand submenu — same shape as reveal-library (All players
  // + separator + one entry per opponent). Uses the same wire as
  // reveal-library (Command_RevealCards with zoneName=hand). No
  // playerId when targeting "All players" (-1) — proto2 field
  // presence trap; server returns RespNameNotFound if we sent -1
  // explicitly. Kept inline here since it's tiny.
  const revealHandSubmenu: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? [
          {
            label: "All players",
            onClick: () => onRevealZone?.(ZoneName.HAND, -1),
            disabled: handSize <= 0,
          },
          { divider: true },
          ...revealTargets.map((t) => ({
            label: t.name,
            onClick: () => onRevealZone?.(ZoneName.HAND, t.playerId),
            disabled: handSize <= 0,
          })),
        ]
      : [{ label: "(no players)" }];
  const revealRandomHandSubmenu: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? [
          {
            label: "All players",
            onClick: () => onRevealRandomFromZone?.(ZoneName.HAND, -1),
            disabled: handSize <= 0,
          },
          { divider: true },
          ...revealTargets.map((t) => ({
            label: t.name,
            onClick: () =>
              onRevealRandomFromZone?.(ZoneName.HAND, t.playerId),
            disabled: handSize <= 0,
          })),
        ]
      : [{ label: "(no players)" }];
  // Helper: build a "move all cards from HAND to <target>" click
  // handler. Hand card ids are real numeric ids on the wire.
  const moveAllHandTo = (
    targetZone: string,
    x: number,
  ): (() => void) => () => {
    if (!onMoveCard || playerId == null || !handCards || handCards.length === 0) {
      return;
    }
    const cards = handCards
      .map((c) => ({ cardId: Number(c.id) }))
      .filter((c) => Number.isFinite(c.cardId));
    if (cards.length === 0) return;
    onMoveCard({
      startPlayerId: playerId,
      startZone: ZoneName.HAND,
      cardsToMove: { card: cards },
      targetPlayerId: playerId,
      targetZone,
      x,
      y: 0,
    });
  };
  const handMenuItems: ContextMenuItem[] = [
    // View hand — Cockatrice opens a persistent hand view. We don't
    // have that widget yet; a natural fit would be reusing the
    // library-search dialog against the hand cards, but scope for
    // this iteration.
    { label: "View hand", disabled: true },
    {
      label: "Sort hand by...",
      submenu: [
        { label: "Name", disabled: true },
        { label: "Type", disabled: true },
        { label: "Mana Value", disabled: true },
      ],
    },
    {
      label: "Reveal hand to...",
      submenu: revealHandSubmenu,
    },
    {
      label: "Reveal random card to...",
      submenu: revealRandomHandSubmenu,
    },
    { divider: true },
    {
      // Choose-hand-size mulligan — desktop opens a modal to prompt
      // for the target hand size. We haven't built that modal yet;
      // "same size" and "-1" variants below cover the common cases.
      label: "Take mulligan (Choose hand size)",
      disabled: true,
    },
    {
      label: "Take mulligan (Same hand size)",
      onClick: () => onMulligan?.(handSize),
      disabled: handSize <= 0,
    },
    {
      label: "Take mulligan (Hand size - 1)",
      onClick: () => onMulligan?.(Math.max(1, handSize - 1)),
      disabled: handSize <= 1,
    },
    { divider: true },
    {
      label: "Move hand to...",
      disabled: handSize <= 0,
      submenu: [
        {
          label: "Top of library",
          onClick: moveAllHandTo(ZoneName.DECK, 0),
          disabled: handSize <= 0,
        },
        {
          label: "Bottom of library",
          onClick: moveAllHandTo(ZoneName.DECK, -1),
          disabled: handSize <= 0,
        },
        { divider: true },
        {
          label: "Graveyard",
          onClick: moveAllHandTo(ZoneName.GRAVE, 0),
          disabled: handSize <= 0,
        },
        { divider: true },
        {
          label: "Exile",
          onClick: moveAllHandTo(ZoneName.EXILE, 0),
          disabled: handSize <= 0,
        },
      ],
    },
  ];
  // Counters submenu — Cockatrice's AbstractCounter builds a menu per
  // counter with "Set counter..." + ±1..±10 rows (abstract_counter.cpp:36-57).
  // We already have all the wires for these: `lifeControl.onDelta` /
  // `.onSet` for life, and `onModifyCounter(id, delta)` for the mana
  // pool. Just build the delta list programmatically and hand it to
  // each counter's submenu. "Set counter..." on Life reuses the
  // existing Ctrl+L modal; mana counters don't have a set-modal yet
  // so their Set row is disabled.
  const buildDeltaItems = (
    apply: (delta: number) => void,
  ): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    // +10 down to +1
    for (let i = 10; i >= 1; i--) {
      items.push({ label: `+${i}`, onClick: () => apply(i) });
    }
    items.push({ divider: true });
    // -1 down to -10
    for (let i = 1; i <= 10; i++) {
      items.push({ label: `-${i}`, onClick: () => apply(-i) });
    }
    return items;
  };
  const lifeCounterItems: ContextMenuItem[] = [
    {
      label: "Set counter...",
      onClick: () => setSetLifeModalOpen(true),
      disabled: !lifeControl,
    },
    { divider: true },
    ...buildDeltaItems((d) => lifeControl?.onDelta(d)),
  ];
  const manaCounterSubmenus: ContextMenuItem[] = MANA_COLORS.map((m) => {
    const counter = manaCounters?.[m.symbol];
    const canModify = counter != null && onModifyCounter != null;
    const canSet = counter != null && onSetPlayerCounter != null;
    return {
      label: m.label,
      // Disable the whole counter's submenu when we don't have a
      // counter id from Redux (pre-hydration transient) — every row
      // inside would no-op anyway.
      disabled: !canModify,
      submenu: [
        {
          // Reuses SetLifeModal (the same arithmetic-input modal
          // Ctrl+L opens) with title/subtitle overrides for the
          // counter name. Fires Command_SetCounter with the
          // absolute value.
          label: "Set counter...",
          onClick: () => {
            if (counter) {
              setSetManaCounterModal({
                counterId: counter.id,
                symbol: m.symbol,
                label: m.label,
                currentValue: counter.count,
              });
            }
          },
          disabled: !canSet,
        },
        { divider: true },
        ...buildDeltaItems((d) => {
          if (canModify) onModifyCounter(counter.id, d);
        }),
      ],
    };
  });
  const countersMenuItems: ContextMenuItem[] = [
    { label: "Life", submenu: lifeCounterItems },
    ...manaCounterSubmenus,
  ];

  // Rest of the battlefield menu — pile submenus are placeholders
  // (already wired on the piles themselves), utility items wire
  // Roll die and Game info via GameDialogActionsContext. Everything
  // else stays disabled with the correct label so the menu reads
  // identical in shape to Cockatrice's PlayerMenu.
  const battlefieldMenuItems: ContextMenuItem[] = [
    {
      label: "Hand",
      submenu: handMenuItems,
    },
    {
      // Same items as right-clicking the library pile. Cockatrice's
      // PlayerMenu attaches the same LibraryMenu to both places
      // (player_menu.cpp:23,67).
      label: "Library",
      submenu: libraryMenuItems,
    },
    {
      // Same items as right-clicking the graveyard pile. Cockatrice's
      // PlayerMenu attaches the same GraveyardMenu to both places
      // (player_menu.cpp:29,63). Top-level entry stays enabled even
      // when the pile is empty so the user can still open "View
      // graveyard" — individual submenu items handle their own
      // per-pile-count disabling.
      label: "Graveyard",
      submenu: graveMenuItemsSelf,
    },
    {
      // Same items as right-clicking the exile pile. Cockatrice's
      // PlayerMenu attaches the same RfgMenu to both places
      // (player_menu.cpp:30,64).
      label: "Exile",
      submenu: exileMenuItemsSelf,
    },
    {
      label: "Sideboard",
      submenu: [
        {
          // Cockatrice's actViewSideboard opens the same zone-view
          // dialog that "View library" opens (player_actions.cpp:232-234).
          // We reuse LibrarySearchDialog against the local player's
          // sideboard zone (mounted below in the modal render block).
          label: "View sideboard",
          onClick: onRequestViewSideboard,
        },
      ],
    },
    { divider: true },
    {
      // Counters submenu — Cockatrice's countersMenu lists every
      // per-player counter (life + w/u/b/r/g/x/storm) as its own
      // ±N/Set submenu (AbstractCounter, abstract_counter.cpp:36-57).
      // We already wire the deltas via lifeControl.onDelta and
      // onModifyCounter, and life's Set via the Ctrl+L modal.
      label: "Counters",
      submenu: countersMenuItems,
    },
    {
      // "Increment all card counters" — port of Cockatrice's
      // actIncrementAllCardCounters (player_actions.cpp:1588-1621).
      // Target set: current battlefield selection if any, else every
      // card on this player's battlefield. For each targeted card,
      // iterate its EXISTING counters and bump each by +1, skipping
      // any already at MAX_COUNTER_VALUE (999). Cards with no counters
      // are silently no-ops — matches desktop, which only touches
      // counters that already exist rather than adding new ones.
      // Disabled when no callback is wired (pre-hydration transient)
      // or when there's simply nothing on the board with counters.
      label: "Increment all card counters",
      onClick: () => {
        if (!onBulkSetCardCounters) return;
        const targets =
          selection?.zone === "battlefield" && selection.ids.size > 0
            ? battlefieldDisplayList.filter((c) =>
                selection.ids.has(c.id),
              )
            : battlefieldDisplayList;
        // Collect every (cardId, counterId, currentValue+1) into one
        // list; the batching helper packs them into a single
        // CommandContainer so the whole increment lands atomically
        // (mirrors Cockatrice's prepareGameCommand(commandList) in
        // actIncrementAllCardCounters, player_actions.cpp:1618-1620).
        const entries: {
          cardId: number;
          counterId: number;
          value: number;
        }[] = [];
        for (const card of targets) {
          const cardIdNum = Number(card.id);
          if (!Number.isFinite(cardIdNum)) continue;
          for (const counter of card.counters ?? []) {
            if (counter.value >= MAX_COUNTER_VALUE) continue;
            entries.push({
              cardId: cardIdNum,
              counterId: counter.id,
              value: counter.value + 1,
            });
          }
        }
        if (entries.length > 0) onBulkSetCardCounters(entries);
      },
      disabled:
        !onBulkSetCardCounters || battlefieldDisplayList.length === 0,
    },
    { divider: true },
    {
      // "Untap all permanents" — port of Cockatrice's actUntapAll.
      // Fires one Command_SetCardAttr with cardId=-1 (Servatrice's
      // "all cards in zone" sentinel), which the server iterates
      // over every card in TABLE and untaps each while respecting
      // per-card `doesntUntap` flags (server_card.cpp:70). This is
      // the same wire the phase-tracker's untap-step double-click
      // fires (usePhaseBar.ts:41-51) — one wire, whole battlefield.
      // Not phase-gated here — the menu action is always available.
      label: "Untap all permanents",
      onClick: () => onUntapAll?.(),
      disabled: !onUntapAll,
    },
    { divider: true },
    {
      label: "Roll die...",
      onClick: () => onRequestRollDie?.(),
    },
    {
      // "Flip coin" — port of actFlipCoin (player_actions.cpp:866-872).
      // Cockatrice models a coin flip as a `Command_RollDie(sides=2,
      // count=1)`; server broadcasts Event_RollDie and the chat log
      // renders the heads/tails outcome.
      label: "Flip coin",
      onClick: () => onFlipCoin?.(),
      disabled: !onFlipCoin,
    },
    { divider: true },
    {
      // "Create token..." — opens the modal, on submit fires
      // Command_CreateToken and snapshots the payload into lastToken
      // so "Create another token" can re-fire without the modal.
      // Matches Cockatrice's actCreateToken (player_actions.cpp:878-892):
      // stores lastTokenInfo, then chains into actCreateAnotherToken.
      label: "Create token...",
      onClick: () => setCreateTokenModalOpen(true),
      disabled: !onCreateToken,
    },
    {
      // "Create another token" — direct re-fire with the last submitted
      // args. Mirrors Cockatrice's actCreateAnotherToken which early-
      // returns when lastTokenInfo.name is empty (player_actions.cpp:895);
      // we disable the menu item instead so the state matches Cockatrice's
      // "enable" signal (requestEnableAndSetCreateAnotherTokenAction).
      label: "Create another token",
      onClick: () => {
        if (onCreateToken && lastToken) {
          onCreateToken(lastToken);
        }
      },
      disabled: !onCreateToken || !lastToken,
    },
    {
      label: "Create predefined token",
      // Populated at runtime from the deck's tokens zone in Cockatrice.
      disabled: true,
    },
    { divider: true },
    {
      label: "Game info...",
      onClick: () => onRequestGameInfo?.(),
    },
  ];

  // Opponent battlefield right-click menu. Ports Cockatrice's
  // player_menu.cpp:14-58 opponent branch: all utility items (Create
  // token, Roll die, Counters, Untap all, Hand / Library / Sideboard
  // submenus) are OWN-ONLY, so the opponent menu narrows to just the
  // two public zones you can peek at — graveyard and exile. Reuses
  // the same opponent grave/exile item arrays the pile-level menus
  // already attach so "View graveyard" opens the same LibrarySearch
  // dialog either way.
  const opponentBattlefieldMenuItems: ContextMenuItem[] = [
    { label: 'Graveyard', submenu: graveMenuItemsOpponent },
    { label: 'Exile', submenu: exileMenuItemsOpponent },
  ];

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDownBox}
      className={[
        "h-full min-h-0 rounded-lg border overflow-hidden bg-bg-surface/60 backdrop-blur-sm transition-shadow select-none",
        isActive ? "border-accent" : "border-border-subtle",
      ].join(" ")}
      style={{
        display: "grid",
        // Info column width in em so it scales with the box's font-size.
        // Info col hosts life + a 3×2 mana pip grid + the vertical zone
        // stack (library / graveyard / exile). Zones are card-sized
        // (CARD_HEIGHT wide because they're rotated) and the pip row
        // (3 pips at ~2em each + gaps) is narrower, so we just need
        // CARD_HEIGHT + a small padding allowance.
        //
        // Middle col holds command zone + stack — sized so that after
        // p-2 (0.5rem each side = 1rem total) the inner width equals
        // exactly one card width. Hand row height tracks CARD_HEIGHT
        // + a small non-scaling breathing gap so hand cards don't
        // overflow at bigger scales.
        gridTemplateColumns: `calc(${CARD_HEIGHT} + 1.5em) calc((${CARD_WIDTH} + 1rem) * 1.2) 1fr`,
        // Hand row reserves 60% of a card height + a hair of breathing
        // room. When idle, 60% of each hand card is visible (bottom
        // 40% clipped); on hover, the hand div flips its overflow open
        // and lets the remaining 40% float into the play-area's cell
        // without reflowing anything behind it. Same "hover overlay"
        // pattern as the phase track.
        gridTemplateRows: handOnTop
          ? `calc(${CARD_HEIGHT} * 0.6 + 0.5em) 1fr`
          : `1fr calc(${CARD_HEIGHT} * 0.6 + 0.5em)`,
        // Stronger accent glow than shadow-glow when it's this player's turn.
        boxShadow: isActive
          ? "0 0 28px 0 rgb(var(--accent-primary) / 0.5), 0 0 10px 0 rgb(var(--accent-primary) / 0.35)"
          : undefined,
      }}
    >
      {/* Info column — spans both rows. Top: full-width header + life total.
          Bottom: mana-pool sub-column on the left + card zones on the right. */}
      <div
        className="row-span-full border-r border-border-subtle bg-bg-surface/70 flex flex-col p-[0.75em] gap-[0.5em] min-h-0"
        style={{ gridColumn: 1 }}
      >
        {/* Player header — spans full info column width */}
        <div className="flex items-center gap-[0.5em] pb-[0.5em] border-b border-border-subtle">
          <span className="text-[0.875em] font-semibold text-text-primary truncate">
            {name}
          </span>
        </div>

        {/* Life total — spans full info column width; avatar as background
             with a 50% black wash on top.
             Owner interactions:
               • left click  → +1 life (delta)
               • right click → -1 life (delta) — browser context menu
                 is suppressed via preventDefault
               • Ctrl / Cmd + L → opens the set-life modal (registered
                 in a useEffect below on window keydown; only fires for
                 the local player's box)
             Non-owner boxes render read-only (no cursor change, no
             click handlers). */}
        <div
          role={isSelf ? "button" : undefined}
          tabIndex={isSelf ? 0 : undefined}
          aria-label={isSelf ? "Life total — left click +1, right click -1, Ctrl/Cmd+L to set" : undefined}
          // Arrow target for right-click-drag arrows aimed at a player's
          // life total. The interactions hook hit-tests by looking for
          // `[data-arrow-target-kind="player"]` under the pointer; the
          // overlay resolves player-targeted committed arrows the same
          // way. Both self and opponent pills carry these — you can
          // point arrows at yourself in Cockatrice too.
          data-arrow-target-kind="player"
          data-arrow-target-player-id={playerId}
          onClick={isSelf ? () => setLife((l) => l + 1) : undefined}
          onContextMenu={
            isSelf
              ? (e) => {
                  e.preventDefault();
                  setLife((l) => l - 1);
                }
              : undefined
          }
          className={[
            "relative flex items-center justify-center gap-[0.75em] rounded-md overflow-hidden py-0",
            isSelf ? "cursor-pointer select-none" : "",
          ].join(" ")}
          style={{
            backgroundImage: player.profile?.avatar_url
              ? `url(${player.profile.avatar_url})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!player.profile?.avatar_url && (
            <div
              className="absolute inset-0 bg-gradient-to-br from-accent-secondary to-accent pointer-events-none"
              aria-hidden
            />
          )}
          <div className="absolute inset-0 bg-black/50 pointer-events-none" aria-hidden />
          <Heart size="2.5em" className="text-red-400 relative z-10 pointer-events-none" />
          <span
            className="text-[3em] font-modern font-bold tabular-nums text-white relative z-10 pointer-events-none"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)" }}
          >
            {life}
          </span>
        </div>

        {/* Below the life total: mana pool sits as the first item of
             the zone column — same `justify-evenly` distribution as
             library / graveyard / exile so it reads as one of the
             stacked column items rather than a separate block. */}
        <div className="flex-1 min-w-0 flex flex-col justify-evenly min-h-0">
          {/* Mana pool — 3 × 2 grid of pips (WUB / RGC). Grid keeps
              the block compact so the info column stays narrow. */}
          <div className="shrink-0 grid grid-cols-3 gap-1 justify-items-center">
            {MANA_COLORS.map((m, i) => {
              const counter = manaCounters?.[m.symbol];
              const canModify =
                isSelf && counter != null && onModifyCounter != null;
              const pip = (
                <ManaPip
                  symbol={m.symbol}
                  label={m.label}
                  tint={m.tint}
                  count={manaPool[m.symbol]}
                  onIncrement={
                    canModify
                      ? () => onModifyCounter(counter.id, 1)
                      : undefined
                  }
                  onDecrement={
                    canModify
                      ? () => onModifyCounter(counter.id, -1)
                      : undefined
                  }
                />
              );
              // 7 pips in a 3-col grid → the last one wraps to a new
              // row alone in column 1. Span the full row and center
              // it via flex so the odd-one-out sits under the middle
              // column instead of hugging the left edge.
              const isLastInPartialRow =
                MANA_COLORS.length % 3 !== 0 &&
                i === MANA_COLORS.length - 1;
              if (isLastInPartialRow) {
                return (
                  <div
                    key={m.symbol}
                    className="col-span-3"
                  >
                    {pip}
                  </div>
                );
              }
              return <div key={m.symbol}>{pip}</div>;
            })}
          </div>
            {isSelf ? (
              <ContextMenu
                items={[
                  // Order + labels + shortcuts ported 1:1 from Cockatrice's
                  // library context menu (deck_menu.cpp / TabGame shortcuts).
                  // Items without onClick render as disabled placeholders
                  // — this iteration is a visual match; wiring follows.
                  {
                    label: "Draw card",
                    onClick: () => draw(1),
                    disabled: deckCount <= 0,
                    shortcut: isMac() ? "⌘D" : "Ctrl+D",
                  },
                  {
                    label: "Draw cards...",
                    onClick: () =>
                      setDrawCardsModal({ deckSize: deckCount }),
                    disabled: deckCount <= 0,
                    shortcut: isMac() ? "⌘E" : "Ctrl+E",
                  },
                  {
                    label: "Undo last draw",
                    onClick: () => onUndoDraw?.(),
                    // No client-side gate — the server rejects when
                    // there's nothing to undo (matches Cockatrice, which
                    // also always shows the item enabled).
                    shortcut: isMac() ? "⌘⇧D" : "Ctrl+Shift+D",
                  },
                  { divider: true },
                  {
                    label: "Shuffle",
                    onClick: () => {
                      onShuffle?.();
                    },
                    disabled: deckCount <= 1,
                    shortcut: isMac() ? "⌘S" : "Ctrl+S",
                  },
                  { divider: true },
                  {
                    // "View library" — fires a full-deck dump
                    // (Command_DumpZone with numberCards=-1) and opens the
                    // search dialog against Redux `revealedCards`. Mirrors
                    // Cockatrice's actViewLibrary (player_actions.cpp).
                    label: "View library",
                    onClick: () => {
                      onDumpTopCards?.(-1, false);
                      setLibrarySearchOpen(true);
                    },
                    disabled: deckCount <= 0,
                    shortcut: "F3",
                  },
                  {
                    label: "View top cards of library...",
                    onClick: () =>
                      setViewNCardsModal({
                        isReversed: false,
                        deckSize: deckCount,
                      }),
                    disabled: deckCount <= 0,
                    shortcut: isMac() ? "⌘W" : "Ctrl+W",
                  },
                  {
                    label: "View bottom cards of library...",
                    // Same flow as "View top cards" but with is_reversed=true
                    // on Command_DumpZone: server sends the bottom-N slice
                    // face-up, ids equal to their actual deck positions
                    // (deckSize-N .. deckSize-1). Reveal dialog labels
                    // and reorder math already branch on isReversed.
                    onClick: () =>
                      setViewNCardsModal({
                        isReversed: true,
                        deckSize: deckCount,
                      }),
                    disabled: deckCount <= 0,
                    shortcut: isMac() ? "⌘⇧W" : "Ctrl+Shift+W",
                  },
                  { divider: true },
                  {
                    // "Reveal library to..." — mirrors Cockatrice's
                    // populateRevealLibraryMenuWithActivePlayers
                    // (library_menu.cpp:259-278). "All players"
                    // sits at the top (player_id=-1), separator, then
                    // one entry per other seated player. Disabled when
                    // nobody else is at the table.
                    label: "Reveal library to...",
                    submenu:
                      revealTargets && revealTargets.length > 0
                        ? [
                            {
                              label: "All players",
                              onClick: () => onRevealLibrary?.(-1),
                            },
                            { divider: true },
                            ...revealTargets.map((t) => ({
                              label: t.name,
                              onClick: () => onRevealLibrary?.(t.playerId),
                            })),
                          ]
                        : [{ label: "(no players)" }],
                  },
                  {
                    // "Lend library to..." — same targets as Reveal
                    // but without the "All players" option: Cockatrice's
                    // populateLendLibraryMenuWithActivePlayers
                    // (library_menu.cpp:280-293) intentionally omits
                    // the broadcast entry (write access can only be
                    // granted to a single player). Fires
                    // Command_RevealCards with grant_write_access=true;
                    // the target gains permission to move cards from
                    // this player's deck until the next shuffle.
                    label: "Lend library to...",
                    submenu:
                      revealTargets && revealTargets.length > 0
                        ? revealTargets.map((t) => ({
                            label: t.name,
                            onClick: () => onLendLibrary?.(t.playerId),
                          }))
                        : [{ label: "(no players)" }],
                  },
                  {
                    // "Reveal top cards to..." — same target list as
                    // "Reveal library to..." (All players + separator +
                    // one per opponent, per library_menu.cpp:295-314).
                    // Each entry opens a numeric prompt for the count
                    // (library_menu.cpp:340-342) before firing the wire.
                    label: "Reveal top cards to...",
                    submenu:
                      revealTargets && revealTargets.length > 0
                        ? [
                            {
                              label: "All players",
                              onClick: () =>
                                setRevealTopCardsPrompt({
                                  targetPlayerId: -1,
                                  targetName: "all players",
                                  deckSize: deckCount,
                                }),
                            },
                            { divider: true },
                            ...revealTargets.map((t) => ({
                              label: t.name,
                              onClick: () =>
                                setRevealTopCardsPrompt({
                                  targetPlayerId: t.playerId,
                                  targetName: t.name,
                                  deckSize: deckCount,
                                }),
                            })),
                          ]
                        : [{ label: "(no players)" }],
                  },
                  {
                    // "Always reveal top card" — toggles Cockatrice's
                    // per-zone always_reveal_top_card flag
                    // (library_menu.cpp:197-202,
                    // player_actions.cpp:199-205). When ON, everyone
                    // (including this player) sees the deck's top card
                    // face-up; the server automatically re-emits the
                    // reveal on every draw / shuffle / move-to-top via
                    // revealTopCardIfNeeded
                    // (server_abstract_player.cpp:558-565).
                    label: "Always reveal top card",
                    checked: alwaysRevealTopCard ?? false,
                    onClick: () =>
                      onSetAlwaysRevealTopCard?.(!alwaysRevealTopCard),
                    shortcut: isMac() ? "⌘N" : "Ctrl+N",
                  },
                  {
                    // "Always look at top card" — same shape but only
                    // the owner sees the face (server-side
                    // revealTopCardIfNeeded emits Event_RevealCards
                    // privately per server_abstract_player.cpp:567-580).
                    // Independent of always-reveal — Cockatrice's menu
                    // doesn't gate either on the other.
                    label: "Always look at top card",
                    checked: alwaysLookAtTopCard ?? false,
                    onClick: () =>
                      onSetAlwaysLookAtTopCard?.(!alwaysLookAtTopCard),
                    shortcut: isMac() ? "⌘⇧N" : "Ctrl+Shift+N",
                  },
                  { divider: true },
                  {
                    // "Top of library..." — Cockatrice's LibraryMenu
                    // topLibraryMenu (library_menu.cpp:50-62). Order,
                    // labels, and separators match 1:1. Single-card
                    // items direct-fire Command_MoveCard with cardId=0
                    // (cmdSetTopCard convention, player_actions.cpp:376);
                    // multi-card items open a numeric prompt and iterate
                    // cardsToMove entries `i in [N-1..0]` (matches
                    // moveTopCardsTo iteration order at :475).
                    label: "Top of library...",
                    disabled: deckCount <= 0,
                    submenu: [
                      {
                        label: "Play top card",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: { card: [{ cardId: 0 }] },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.STACK,
                              x: -1,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Play top card face down",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: 0, faceDown: true }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.TABLE,
                              x: -1,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Put top card on bottom",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: { card: [{ cardId: 0 }] },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.DECK,
                              x: -1,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      { divider: true },
                      {
                        label: "Move top card to graveyard",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: { card: [{ cardId: 0 }] },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.GRAVE,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move top cards to graveyard...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move top cards to graveyard",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              // Cockatrice iterates i from N-1 down to
                              // 0 (moveTopCardsTo, :475). Preserving
                              // that order keeps parity with any log
                              // formatting or replay tooling that
                              // assumes the same ordering.
                              const cards: {
                                cardId: number;
                              }[] = [];
                              for (let i = count - 1; i >= 0; i--) {
                                cards.push({ cardId: i });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.GRAVE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move top cards to graveyard face down...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title:
                              "Move top cards to graveyard face down",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                                faceDown: boolean;
                              }[] = [];
                              for (let i = count - 1; i >= 0; i--) {
                                cards.push({ cardId: i, faceDown: true });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.GRAVE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move top card to exile",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: { card: [{ cardId: 0 }] },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.EXILE,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move top cards to exile...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move top cards to exile",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                              }[] = [];
                              for (let i = count - 1; i >= 0; i--) {
                                cards.push({ cardId: i });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.EXILE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move top cards to exile face down...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move top cards to exile face down",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                                faceDown: boolean;
                              }[] = [];
                              for (let i = count - 1; i >= 0; i--) {
                                cards.push({ cardId: i, faceDown: true });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.EXILE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        // "Put top cards on stack until..." — Cockatrice
                        // opens a filter-expression dialog + options
                        // (movingCardsUntil* state, autoPlay flag). The
                        // desktop flow chains actMoveTopCardToPlay in a
                        // timer loop until the filter matches N times.
                        // Deferred: needs its own dialog with filter
                        // syntax parsing + auto-play toggle. Left as a
                        // disabled placeholder so the menu shape still
                        // reads 1:1 with desktop.
                        label: "Put top cards on stack until...",
                        disabled: true,
                      },
                      { divider: true },
                      {
                        label: "Shuffle top cards...",
                        onClick: () => {
                          const size = deckCount;
                          if (!onShuffleRange || size <= 0) return;
                          setCountPrompt({
                            title: "Shuffle top cards",
                            submitLabel: "Shuffle",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              // Command_Shuffle range is inclusive on
                              // both ends: [0, N-1] shuffles positions
                              // 0..N-1 (player_actions.cpp:267-268).
                              onShuffleRange(0, count - 1);
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                    ],
                  },
                  {
                    // "Bottom of library..." — Cockatrice's LibraryMenu
                    // bottomLibraryMenu (library_menu.cpp:64-78). Bottom
                    // single-card items address `cardId = deckCount-1`
                    // (cmdSetBottomCard, player_actions.cpp:384); the
                    // multi-card actions iterate positions
                    // `maxCards-N..maxCards-1` (moveBottomCardsTo,
                    // :673). Shuffle bottom is encoded on the wire as
                    // `[-N, -1]` — negative indices count from the end
                    // (:298-299).
                    label: "Bottom of library...",
                    disabled: deckCount <= 0,
                    submenu: [
                      {
                        label: "Draw bottom card",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: deckCount - 1 }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.HAND,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Draw bottom cards...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Draw bottom cards",
                            submitLabel: "Draw",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              // Cockatrice iterates i in
                              // [maxCards-N..maxCards-1] (actDrawBottomCards
                              // :798-800) — natural order, unlike top-N
                              // which reverses. Preserve that ordering
                              // so any downstream log/replay tooling
                              // matches desktop.
                              const cards: {
                                cardId: number;
                              }[] = [];
                              for (let i = size - count; i < size; i++) {
                                cards.push({ cardId: i });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.HAND,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      { divider: true },
                      {
                        label: "Play bottom card",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: deckCount - 1 }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.STACK,
                              x: -1,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Play bottom card face down",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [
                                  {
                                    cardId: deckCount - 1,
                                    faceDown: true,
                                  },
                                ],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.TABLE,
                              x: -1,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Put bottom card on top",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: deckCount - 1 }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.DECK,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      { divider: true },
                      {
                        label: "Move bottom card to graveyard",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: deckCount - 1 }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.GRAVE,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move bottom cards to graveyard...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move bottom cards to graveyard",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                              }[] = [];
                              for (let i = size - count; i < size; i++) {
                                cards.push({ cardId: i });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.GRAVE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label:
                          "Move bottom cards to graveyard face down...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title:
                              "Move bottom cards to graveyard face down",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                                faceDown: boolean;
                              }[] = [];
                              for (let i = size - count; i < size; i++) {
                                cards.push({ cardId: i, faceDown: true });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.GRAVE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move bottom card to exile",
                        onClick: () => {
                          if (onMoveCard && playerId != null && deckCount > 0) {
                            onMoveCard({
                              startPlayerId: playerId,
                              startZone: ZoneName.DECK,
                              cardsToMove: {
                                card: [{ cardId: deckCount - 1 }],
                              },
                              targetPlayerId: playerId,
                              targetZone: ZoneName.EXILE,
                              x: 0,
                              y: 0,
                            });
                          }
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move bottom cards to exile...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move bottom cards to exile",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                              }[] = [];
                              for (let i = size - count; i < size; i++) {
                                cards.push({ cardId: i });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.EXILE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      {
                        label: "Move bottom cards to exile face down...",
                        onClick: () => {
                          const size = deckCount;
                          if (
                            !onMoveCard ||
                            playerId == null ||
                            size <= 0
                          ) {
                            return;
                          }
                          setCountPrompt({
                            title: "Move bottom cards to exile face down",
                            submitLabel: "Move",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              const cards: {
                                cardId: number;
                                faceDown: boolean;
                              }[] = [];
                              for (let i = size - count; i < size; i++) {
                                cards.push({ cardId: i, faceDown: true });
                              }
                              onMoveCard({
                                startPlayerId: playerId,
                                startZone: ZoneName.DECK,
                                cardsToMove: { card: cards },
                                targetPlayerId: playerId,
                                targetZone: ZoneName.EXILE,
                                x: 0,
                                y: 0,
                              });
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                      { divider: true },
                      {
                        label: "Shuffle bottom cards...",
                        onClick: () => {
                          const size = deckCount;
                          if (!onShuffleRange || size <= 0) return;
                          setCountPrompt({
                            title: "Shuffle bottom cards",
                            submitLabel: "Shuffle",
                            deckSize: size,
                            onSubmit: (n) => {
                              const count = Math.min(n, size);
                              if (count <= 0) return;
                              // `[-N, -1]` — negative indices count from
                              // the end (server accepts either sign;
                              // Cockatrice desktop always sends negative
                              // for bottom, :298-299).
                              onShuffleRange(-count, -1);
                            },
                          });
                        },
                        disabled: deckCount <= 0,
                      },
                    ],
                  },
                  { divider: true },
                  {
                    // Webatrice divergence from Cockatrice desktop:
                    // instead of reconstructing the deck in-app, we
                    // route to the same `/deck/:id` page a My Decks
                    // row-click opens. Disabled when the game's deck
                    // doesn't match any of the user's saved decks
                    // (name-based lookup happens in GameBoardCell —
                    // undefined callback ⇒ menu item disabled).
                    label: "Open deck in deck editor",
                    onClick: onOpenDeckInEditor,
                    disabled: !onOpenDeckInEditor,
                  },
                ]}
              >
                <CardBackZone
                  ref={libraryRef}
                  label="Library"
                  count={displayedDeckCount}
                  // Pile face: show whatever `deckTopCard` is currently
                  // populated to. The state itself is the guard — the
                  // datatrice cardsRevealed reducer only sets
                  // topRevealedCard when the receiver is in the
                  // reveal audience (owner for always-look-at,
                  // everyone for always-reveal), and top-changing
                  // listeners clear it when the position 0 card
                  // moves. Toggling off does NOT clear — matches
                  // Cockatrice desktop's "keep revealed face
                  // visible until top actually changes" behavior.
                  topCard={deckTopCard ?? null}
                  onPointerDown={
                    displayedDeckCount > 0
                      ? (e) =>
                          startPileDrag(
                            e,
                            LIBRARY_TOP_DRAG_PAYLOAD,
                            "library",
                          )
                      : undefined
                  }
                />
              </ContextMenu>
            ) : (
              // Opponent's library — Cockatrice does nothing on
              // right-click here; skip the ContextMenu wrapper entirely.
              // Wrapping div (not raw <CardBackZone>) preserves the same
              // DOM shape the layout above expected from <ContextMenu>.
              <div>
                <CardBackZone
                  ref={libraryRef}
                  label="Library"
                  count={displayedDeckCount}
                  // Opponent pile: same principle as the own-pile
                  // render above. State is the guard — we only have
                  // deckTopCard populated when the opponent had
                  // always-reveal on (their private "look at"
                  // reveals never reach us).
                  topCard={deckTopCard ?? null}
                />
              </div>
            )}
            {isSelf ? (
              <ContextMenu items={graveMenuItemsSelf}>
                <LargeZoneBox
                  ref={graveyardRef}
                  icon={Skull}
                  label="Graveyard"
                  count={displayedGraveyardCount}
                  topCard={graveyardTop}
                  arrowAnchorPlayerId={playerId}
                  arrowAnchorZone={ZoneName.GRAVE}
                  onPointerDown={
                    graveDisplayList.length > 0
                      ? (e) =>
                          startPileDrag(
                            e,
                            graveDisplayList[graveDisplayList.length - 1],
                            "graveyard",
                          )
                      : undefined
                  }
                />
              </ContextMenu>
            ) : (
              // Opponent's graveyard — GraveyardMenu gates the move /
              // reveal-random submenus behind local-or-judge
              // (grave_menu.cpp:19,42); every player still gets "View
              // graveyard" since the zone is public.
              <ContextMenu items={graveMenuItemsOpponent}>
                <LargeZoneBox
                  ref={graveyardRef}
                  icon={Skull}
                  label="Graveyard"
                  count={displayedGraveyardCount}
                  topCard={graveyardTop}
                  arrowAnchorPlayerId={playerId}
                  arrowAnchorZone={ZoneName.GRAVE}
                />
              </ContextMenu>
            )}
            {isSelf ? (
              <ContextMenu items={exileMenuItemsSelf}>
                <LargeZoneBox
                  ref={exileRef}
                  icon={Sparkles}
                  label="Exile"
                  count={displayedExileCount}
                  topCard={exileTop}
                  arrowAnchorPlayerId={playerId}
                  arrowAnchorZone={ZoneName.EXILE}
                  onPointerDown={
                    exileDisplayList.length > 0
                      ? (e) =>
                          startPileDrag(
                            e,
                            exileDisplayList[exileDisplayList.length - 1],
                            "exile",
                          )
                      : undefined
                  }
                />
              </ContextMenu>
            ) : (
              // Opponent's exile — RfgMenu gates move behind local-or-judge
              // (rfg_menu.cpp:16); "View exile" is available to any viewer.
              <ContextMenu items={exileMenuItemsOpponent}>
                <LargeZoneBox
                  ref={exileRef}
                  icon={Sparkles}
                  label="Exile"
                  count={displayedExileCount}
                  topCard={exileTop}
                  arrowAnchorPlayerId={playerId}
                  arrowAnchorZone={ZoneName.EXILE}
                />
              </ContextMenu>
            )}
        </div>
      </div>

      {/* Stack column — sits in the play row (opposite the hand). Only
          the battlefield is mirrored for top-row boxes; the stack
          always renders in the same orientation. */}
      <div
        className="border-r border-border-subtle flex flex-col min-h-0 p-2"
        style={{ gridColumn: 2, gridRow: handOnTop ? 2 : 1 }}
      >
        {/* Stack — spells/abilities waiting to resolve. Cards zig-zag
            vertically; index 0 renders topmost. Dropping between two
            existing cards inserts at that position. */}
        <div ref={stackRef} className="flex-1 min-h-0 relative">
          {(() => {
            const visible = stackDisplayList.filter(
              (c) => !isDragging(c.id, "stack"),
            );
            const positions = layoutStack(
              visible.length,
              stackSize.w,
              stackSize.h,
              CARD_W_PX,
              CARD_H_PX,
              STACK_HOFFSET_PX,
            );
            return visible.map((c, i) => {
              const pos = positions[i];
              if (!pos) return null;
              const selected =
                selection?.zone === "stack" && selection.ids.has(c.id);
              return (
                <div
                  key={c.id}
                  data-card
                  data-zone="stack"
                  data-card-id={c.id}
                  onPointerDown={(e) =>
                    startCardDrag(e, c, "stack", stackDisplayList)
                  }
                  className="absolute hover:z-10"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    touchAction: isSelf ? "none" : undefined,
                    cursor: isSelf ? "grab" : "default",
                    boxShadow: selected
                      ? "0 0 0 2px rgb(59 130 246), 0 0 12px 2px rgb(59 130 246 / 0.6)"
                      : undefined,
                    borderRadius: CARD_CORNER_RADIUS,
                  }}
                >
                  <Card
                    name={c.name}
                    scryfallId={c.scryfallId}
                    pt={cardMetaByName.get(c.name)?.pt}
                  />
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Battlefield — sits in the play row (opposite the hand). The inner
          scroll container measures the fit area (how many columns fit
          on-screen). The battlefield content div has an explicit pixel
          size that expands past the fit as cards are placed on the right
          buffer column, triggering horizontal scroll. Padding equals the
          card gap so the visual "frame" around the battlefield matches
          the spacing between cards.
          Own battlefield gets Cockatrice's PlayerMenu on right-click
          (player_menu.cpp:60-62). Opponent boards get the narrower
          view-only menu (Graveyard / Exile submenus only) since
          Cockatrice hides every utility item behind the isLocal gate. */}
      <ContextMenu
        items={isSelf ? battlefieldMenuItems : opponentBattlefieldMenuItems}
        wrapperClassName="min-h-0 relative"
        wrapperStyle={{ gridColumn: 3, gridRow: handOnTop ? 2 : 1 }}
      >
        {/* Lands divider — spans the full width of the play area,
            ignoring the padding around the scrollable battlefield content
            so it reads as a continuous horizontal line across the box.
            Sits in the gap ABOVE the lands row (visual bottom for self,
            visual top for mirrored opponent boards). */}
        {BATTLEFIELD_ROWS >= 2 &&
          (() => {
            // The lands row is the visual row nearest the OWNER's hand.
            // Webatrice's wire y semantics (see playCard.ts) put creatures
            // at wireY=0 and lands at wireY=2, so:
            //   • self (handOnTop=false): lands render at bottom (row 2)
            //   • opponent (handOnTop=true, mirrored): lands render at top
            //     (visual row 0, since mirroring flips wireY=2 → row 0)
            // Draw the divider in the row-gap ABOVE (self) or BELOW
            // (opponent) the lands row.
            const dividerAboveRow = handOnTop ? 1 : 2;
            const dividerY =
              rowTopY(dividerAboveRow, battlefieldLayout) -
              BATTLEFIELD_ROW_PADDING_PX / 2;
            return (
              <div
                className="absolute left-0 right-0 border-t border-border-strong/60 pointer-events-none"
                style={{ top: `${dividerY}px` }}
              />
            );
          })()}
        <div
          ref={scrollContainerRef}
          data-battlefield-owner={player.user_id}
          data-battlefield-mirrored={handOnTop ? "true" : "false"}
          // Cockatrice-style layout: the outer scroll container has no
          // padding. Left/right/top margins are already baked into the
          // content div's card + slot positions via BATTLEFIELD_MARGIN_*
          // constants in the layout helpers, so adding container padding
          // would double up the inset and shrink the visible column
          // count for no visual gain.
          className="absolute inset-0 overflow-x-auto overflow-y-hidden box-border"
          onWheel={(e) => {
            // Mouse-wheel scrolls the battlefield horizontally. Only
            // when there's actually more content than fits — otherwise
            // let the wheel event bubble to the outer play area.
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            if (e.deltaY === 0) return;
            el.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
        >
        <div
          ref={battlefieldRef}
          data-battlefield-content
          // Cross-battlefield snap reads this to reconstruct per-column
          // widths when a card is dragged over another player's board.
          // JSON.stringify on a Map returns [], so materialize entries
          // first. Cheap even for a few hundred cards.
          data-cell-widths={JSON.stringify(Array.from(cellWidths.entries()))}
          className="relative"
          // Absolute-positioned children (cards + slot outlines) sit at
          // pixel coordinates computed from cellWidths + rowTopY. The
          // content div's own size is set to the sum of per-column
          // widths + margins (Cockatrice-style): if the natural size is
          // smaller than the container, empty space appears on the right
          // (no more spread-to-fit); if larger, the container scrolls.
          style={{
            width: `${naturalContentW}px`,
            height: `${naturalContentH}px`,
          }}
        >
          <BattlefieldSlotOverlay
            cellWidths={cellWidths}
            colsByRow={colsByRow}
            layout={battlefieldLayout}
            mirrored={handOnTop}
          />
          {(() => {
            // Group cards by slot for insertion-order stacking. For
            // server-authoritative cards `subSlot` carries the true
            // stack index (from `wire_x % 3`); for the drop-to-ack
            // window we fall back to the group's insertion index so
            // multiple optimistic drops on the same slot don't overlap.
            const groups = new Map<string, string[]>();
            for (const c of battlefieldDisplayList) {
              const key = `${c.slot.row},${c.slot.col}`;
              const list = groups.get(key) ?? [];
              list.push(c.id);
              groups.set(key, list);
            }
            return battlefieldDisplayList.map((c) => {
              // Position resolved from the shared `battlefieldPositions`
              // map above: parents get shifted to accommodate children,
              // attached children fan diagonally under their parent, and
              // free cards fall back to slotOriginPx. See the
              // battlefieldPositions builder for the full algorithm.
              const origin = battlefieldPositions.get(c.id) ?? {
                x: 0,
                y: 0,
              };
              const dragging = isDragging(c.id, "battlefield");
              const selected =
                (selection?.zone === "battlefield" && selection.ids.has(c.id)) ||
                receivedBattlefieldSelection.has(c.id);
              // Attach source ring — green while pending so the user
              // can see which card they're about to attach. Only one
              // source card per player at a time (`attachPending` is
              // single-slot). Matches Cockatrice's `ArrowAttachItem`
              // color choice (Qt::green).
              const isAttachSource =
                attachPending != null &&
                Number(c.id) === attachPending.sourceCardId;
              return (
                <div
                  key={c.id}
                  data-card
                  data-zone="battlefield"
                  data-card-id={c.id}
                  // Arrow interaction: the useGameArrowInteractions hook
                  // hit-tests via `data-card-owner` + `data-card-zone`
                  // during right-click-drag, and the GameArrowOverlay
                  // resolves committed arrow endpoints against the same
                  // attributes. Zone value is the Cockatrice wire name
                  // (`ZoneName.TABLE`) so the DOM lookup matches the
                  // server's start/target_zone strings.
                  data-card-owner={playerId}
                  data-card-zone={ZoneName.TABLE}
                  // Hover uses an arbitrary z far above the position-
                  // derived base so a mid-battlefield hover always pops
                  // to the top regardless of Y stacking.
                  className="absolute hover:z-[10000]"
                  onPointerDown={(e) =>
                    startCardDrag(
                      e,
                      { id: c.id, name: c.name, scryfallId: c.scryfallId },
                      "battlefield",
                      battlefieldDisplayList.map((bc) => ({
                        id: bc.id,
                        name: bc.name,
                        scryfallId: bc.scryfallId,
                      })),
                    )
                  }
                  onContextMenu={
                    c
                      ? (e) => {
                          e.preventDefault();
                          // Stop the event from bubbling up to the
                          // battlefield's ContextMenu wrapper — otherwise
                          // right-clicking a card opens both the card menu
                          // AND the player menu at the same position.
                          // Also opens for opponent cards; the menu render
                          // below branches on isSelf between the full owner
                          // menu and Cockatrice's minimal opponent menu
                          // (Draw arrow / Clone / Select / Reduce life by
                          // power / View related cards — card_menu.cpp:183).
                          e.stopPropagation();
                          setCardContextMenu({
                            cardId: c.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }
                      : undefined
                  }
                  onDoubleClick={
                    isSelf
                      ? () => {
                          // If the double-clicked card belongs to the
                          // current marquee selection on THIS battlefield,
                          // tap/untap every selected card together. Local
                          // selection is only ever set for the viewer's
                          // own zones, so this branch never fires for
                          // opponent-battlefield selections — those live
                          // in receivedBattlefieldSelection on the
                          // opponent's PlayerBox and can't be tapped by
                          // the viewer anyway.
                          const groupTap =
                            selection?.zone === "battlefield" &&
                            selection.ids.has(c.id);
                          const targetIds = groupTap
                            ? selection.ids
                            : new Set([c.id]);
                          const nextTapped = !c.tapped;
                          // Wire dispatch: one Command_SetCardAttr per
                          // card. Server broadcasts Event_SetCardAttr
                          // back and Redux flips `tapped` — no local
                          // mutation needed.
                          const wireIds: number[] = [];
                          targetIds.forEach((id) => {
                            const n = Number(id);
                            if (Number.isFinite(n)) wireIds.push(n);
                          });
                          if (wireIds.length > 0) {
                            onSetCardTapped?.(wireIds, nextTapped);
                          }
                        }
                      : undefined
                  }
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    left: `${origin.x}px`,
                    top: `${origin.y}px`,
                    // Position-derived stacking: higher-Y cards render on
                    // top. This is what makes attached parents (y = base+15)
                    // sit visually ABOVE their children (y = base+5) — the
                    // parent's full art shows, children peek out from the
                    // fan. Ports Cockatrice's `ZValues::tableCardZValue`
                    // formula from z_values.h:72-75; without it, DOM order
                    // decides and children played after the parent stomp on
                    // top of it.
                    zIndex: Math.round(origin.y * 100) + Math.round(origin.x),
                    touchAction: isSelf ? "none" : undefined,
                    cursor: attachPending
                      ? "crosshair"
                      : isSelf
                        ? "grab"
                        : "default",
                    opacity: dragging ? 0 : 1,
                    // Ring priority (outer overrides inner visually):
                    //   • attach source → green (Cockatrice's arrow color)
                    //   • marquee-selected → blue
                    //   • doesntUntap → amber
                    // When multiple apply they layer, but attach-source
                    // takes visual precedence since it's the ephemeral
                    // "you're mid-flow" cue.
                    boxShadow: isAttachSource
                      ? "0 0 0 3px rgb(34 197 94), 0 0 16px 3px rgb(34 197 94 / 0.75)"
                      : selected
                        ? c.doesntUntap
                          ? "0 0 0 2px rgb(59 130 246), 0 0 0 4px rgb(251 191 36), 0 0 12px 2px rgb(251 191 36 / 0.7)"
                          : "0 0 0 2px rgb(59 130 246), 0 0 12px 2px rgb(59 130 246 / 0.6)"
                        : c.doesntUntap
                          ? "0 0 0 2px rgb(251 191 36), 0 0 10px 2px rgb(251 191 36 / 0.6)"
                          : undefined,
                    borderRadius: CARD_CORNER_RADIUS,
                    // Tapped cards rotate 90° clockwise in place.
                    // transform-origin: center keeps the pivot at the
                    // card's midpoint so it doesn't drift off its slot.
                    transform: c.tapped ? "rotate(90deg)" : undefined,
                    transformOrigin: "center",
                    transition: "transform 150ms ease-out",
                  }}
                >
                  <Card
                    name={c.name}
                    scryfallId={c.scryfallId}
                    id={c.id}
                    faceDown={c.faceDown}
                    // Prefer the server's `pt` (initial value from
                    // `playCard` or an `AttrPT` change); fall back to
                    // the prefetched base P/T from the Scryfall
                    // lookup cache so untouched creatures still
                    // show their printed stats. Face-down cards keep
                    // whatever PT the server has recorded so a manifested
                    // creature's stats stay readable (Cockatrice does
                    // the same).
                    pt={c.pt || (c.faceDown ? undefined : cardMetaByName.get(c.name)?.pt)}
                    basePT={cardMetaByName.get(c.name)?.pt}
                    annotation={c.annotation}
                    counters={c.counters}
                    imageUri={resolveFaceImageUri(c.name)}
                  />
                </div>
              );
            });
          })()}
        </div>
        </div>
      </ContextMenu>

      {/* Hand — every player gets one; row flips based on handOnTop.
           Idle: overflow-hidden clips cards to half their height so
           the hand row only occupies half a card of vertical space.
           Hovered: overflow-visible + z-30 lets cards render at full
           height, floating over the play area WITHOUT reflowing the
           grid (the reserved row height doesn't change). Alignment
           per row direction so the visible half always sits toward
           the screen edge and expansion goes toward the play area:
             • Bottom hand: items-end → bottom half visible, top half
               overflows upward into the play area on hover.
             • Top hand:    items-start → top half visible, bottom
               half overflows downward into the play area on hover. */}
      {/* Nested structure — two problems solved:
             1. CSS silently promotes overflow-visible to auto when
                the other axis is auto/hidden, spawning a vertical
                scrollbar. Splitting vertical vs horizontal overflow
                across nested elements avoids the promotion.
             2. On hover, the bottom hand needs to "slide up" so the
                top half stays visible while the bottom half now sits
                inside the strip and the top half floats into the
                play area above. That's the transform on the inner
                container (top hand doesn't need it — its natural
                overflow direction IS toward the play area).
           Layout invariant: cards render top-aligned in the strip so
           the TOP half of every card (name / mana / art — the part
           you actually need to read) is what's visible in idle. */}
      <div
        onMouseEnter={() => setHandExpanded(true)}
        onMouseLeave={() => setHandExpanded(false)}
        className={[
          "bg-bg-surface/40 min-h-0 flex",
          // For flipped opponent hands, use items-end so the rotated
          // card back's BOTTOM (which is the original TOP with the
          // Magic logo) sits in the visible strip. Everything else
          // (own hand + non-flipped 3-player opponent) stays
          // top-aligned, matching the local invariant that the
          // card's readable half occupies the strip.
          handOnTop && flipHandCardBacks ? "items-end" : "items-start",
          handOnTop ? "border-b border-border-subtle" : "border-t border-border-subtle",
          handExpanded ? "overflow-visible" : "overflow-hidden",
        ].join(" ")}
        style={{
          gridColumn: "2 / 4",
          gridRow: handOnTop ? 1 : 2,
          // Elevate above other grid children when expanded so the
          // overflowing cards paint on top of the play area.
          position: 'relative',
          zIndex: handExpanded ? 30 : undefined,
        }}
      >
        {/* Inner row — full card height so cards render at their true
            size; the outer wrapper clips the half we don't want to see
            in idle mode. On hover, a translateY on this container
            slides the whole card content upward for the bottom hand
            (top hand stays put — its expansion is downward and
            handled by the outer's overflow flip alone). */}
        <div
          ref={handRef}
          // `overflow-y-hidden` set explicitly alongside overflow-x-auto
          // to short-circuit the CSS spec's promotion of the other
          // axis to `auto` — that's what was spawning a phantom
          // vertical scrollbar even though cards fit exactly.
          className="w-full flex items-center overflow-x-auto overflow-y-hidden transition-transform duration-200 ease-out"
          style={{
            height: CARD_HEIGHT,
            // Own hand slides UP on hover (top half of card floats
            // into the play area above, bottom half comes into the
            // strip). Flipped opponent hand mirrors that, sliding
            // DOWN on hover so the card back's original TOP (with
            // Magic logo) drops into the play area below and the
            // rotated top comes into the strip. Non-flipped
            // (3-player) opponent has no transform — its expansion
            // is a plain overflow reveal downward.
            transform: handExpanded
              ? !handOnTop
                ? 'translateY(-40%)'
                : flipHandCardBacks
                  ? 'translateY(40%)'
                  : undefined
              : undefined,
          }}
          onWheel={(e) => {
            // Translate vertical wheel input into horizontal scroll so the
            // mousewheel Just Works over an overflowing hand. Only when
            // there's actual horizontal overflow — otherwise let the event
            // bubble so the outer play-area scrolls normally.
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            if (e.deltaY === 0) return;
            el.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
        >
        {/* Static hand — the owner sees the real card faces; everyone else
            sees face-down card backs (one per card the server says
            they're holding). `m-auto` on the inner row centers the
            cards when they fit and collapses to 0 when they don't —
            unlike `justify-center`, this leaves the leading edge
            reachable when the hand overflows and needs to scroll. */}
        {isSelf
          ? handDisplayList.length > 0 && (
              <div className="flex items-center gap-1 m-auto px-1">
                {handDisplayList.map((c) => {
                  const dragging = isDragging(c.id, "hand");
                  const selected =
                    selection?.zone === "hand" && selection.ids.has(c.id);
                  return (
                    <div
                      key={c.id}
                      data-card
                      data-zone="hand"
                      data-card-id={c.id}
                      onPointerDown={(e) =>
                        startCardDrag(e, c, "hand", handDisplayList)
                      }
                      onDoubleClick={async () => {
                        // Auto-route mirrors Cockatrice's
                        // `PlayerActions::playCard()`. Card type comes
                        // from the prefetched cache; on cache miss we
                        // block on a fresh lookup so the first click
                        // routes correctly even if prefetch hasn't
                        // completed. Wire y = tableRowToGridY(tableRow)
                        // for permanents; instants/sorceries route to
                        // the stack. Wire x = -1 lets the server pick
                        // a column.
                        const cardId = Number(c.id);
                        if (
                          !Number.isFinite(cardId) ||
                          !onMoveCard ||
                          playerId == null
                        ) {
                          return;
                        }
                        let typeLine =
                          cardMetaByName.get(c.name)?.typeLine ??
                          cards.find((dc) => dc.name === c.name)?.type_line ??
                          "";
                        if (!typeLine) {
                          const r = await lookupCard(c.name);
                          typeLine = r.typeLine ?? "";
                          const pt =
                            r.power != null && r.toughness != null
                              ? `${r.power}/${r.toughness}`
                              : undefined;
                          if (typeLine || pt) {
                            setCardMetaByName((prev) => {
                              const existing = prev.get(c.name);
                              if (
                                existing?.typeLine === typeLine &&
                                existing?.pt === pt
                              ) {
                                return prev;
                              }
                              const next = new Map(prev);
                              next.set(c.name, { typeLine, pt });
                              return next;
                            });
                          }
                        }
                        const tableRow = typeLineToTableRow(typeLine);
                        if (tableRow === 3) {
                          onMoveCard({
                            startPlayerId: playerId,
                            startZone: ZoneName.HAND,
                            cardsToMove: { card: [{ cardId }] },
                            targetPlayerId: playerId,
                            targetZone: ZoneName.STACK,
                            x: -1,
                            y: 0,
                          });
                        } else {
                          onMoveCard({
                            startPlayerId: playerId,
                            startZone: ZoneName.HAND,
                            cardsToMove: { card: [{ cardId }] },
                            targetPlayerId: playerId,
                            targetZone: ZoneName.TABLE,
                            x: -1,
                            y: tableRowToGridY(tableRow),
                          });
                        }
                      }}
                      style={{
                        touchAction: "none",
                        cursor: "grab",
                        opacity: dragging ? 0 : 1,
                        boxShadow: selected
                          ? "0 0 0 2px rgb(59 130 246), 0 0 12px 2px rgb(59 130 246 / 0.6)"
                          : undefined,
                        borderRadius: CARD_CORNER_RADIUS,
                      }}
                    >
                      <Card
                        name={c.name}
                        scryfallId={c.scryfallId}
                        pt={cardMetaByName.get(c.name)?.pt}
                      />
                    </div>
                  );
                })}
              </div>
            )
          : handCount > 0 && (
              <div className="flex items-center gap-1 m-auto px-1">
                {Array.from({ length: handCount }, (_, i) => (
                  <img
                    key={i}
                    src={CARD_BACK_URL}
                    alt=""
                    draggable={false}
                    className="shadow-md pointer-events-none select-none"
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      borderRadius: CARD_CORNER_RADIUS,
                      transform: flipHandCardBacks ? "rotate(180deg)" : undefined,
                    }}
                  />
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Draw animations — a card back tweens from the library rect
          (rotated to match the sideways pile) to the hand rect (upright)
          each time Redux hand count grows. Purely visual: the drawn
          card is already in Redux; this just adds the "flight" polish. */}
      {flights.length > 0 &&
        createPortal(
          <>
            {flights.map((f) => {
              const style: React.CSSProperties = {
                position: "fixed",
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                borderRadius: CARD_CORNER_RADIUS,
                transition: `left ${DRAW_ANIMATION_MS}ms ease-out, top ${DRAW_ANIMATION_MS}ms ease-out, transform ${DRAW_ANIMATION_MS}ms ease-out`,
                pointerEvents: "none",
                zIndex: 200,
                willChange: "left, top, transform",
              };
              if (!f.landed) {
                style.left = f.from.left + f.from.width / 2;
                style.top = f.from.top + f.from.height / 2;
                style.transform = "translate(-50%, -50%) rotate(-90deg)";
              } else {
                style.left = f.to.left + f.to.width / 2;
                style.top = f.to.top + f.to.height / 2;
                style.transform = "translate(-50%, -50%) rotate(0deg)";
              }
              return (
                <img
                  key={f.id}
                  src={CARD_BACK_URL}
                  alt=""
                  draggable={false}
                  className="shadow-glow"
                  style={style}
                />
              );
            })}
          </>,
          document.body,
        )}

      {/* Marquee selection rectangle. Fixed-position overlay so it can
          straddle scrollable containers without clipping. */}
      {marquee &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: Math.min(marquee.x1, marquee.x2),
              top: Math.min(marquee.y1, marquee.y2),
              width: Math.abs(marquee.x2 - marquee.x1),
              height: Math.abs(marquee.y2 - marquee.y1),
              border: "1px dashed rgb(59 130 246)",
              background: "rgb(59 130 246 / 0.12)",
              pointerEvents: "none",
              zIndex: 275,
            }}
          />,
          document.body,
        )}

      {/* Library search dialog — full-deck reveal. Cards come from Redux
          `revealedDeckCards` (populated by Response_DumpZone when
          "View library" opens above). On close, optionally fires
          Command_Shuffle (shuffle-on-close checkbox default checked
          per Cockatrice) and always clears the revealed snapshot.

          The .cod-parsed DeckCards ship with type_line/cmc/colors/pt
          set to null (parsedDeckToMockCards), so backfill each field
          from `cardMetaByName` (Dexie / Scryfall lookup) before
          passing. Without this, "Group by Type" would bucket every
          card into "Other" and "Sort by CMC" would treat everything
          as 0. */}
      <LibrarySearchDialog
        isOpen={librarySearchOpen}
        onClose={(shuffleOnClose) => {
          setLibrarySearchOpen(false);
          if (shuffleOnClose) onShuffle?.();
          onClearRevealedDeck?.();
        }}
        library={revealedDeckCards ?? []}
        deckCards={enrichedDeckCards}
        playerName={name}
        dropRef={librarySearchDialogRef}
        // Pointer-down on a card in the dialog kicks off a normal
        // library-source drag. The card's id is the revealed-card's
        // server-side deck position, which the wire path forwards
        // verbatim as Command_MoveCard.cardId.
        onCardPointerDown={
          isSelf
            ? (e, c) => beginDrag(e, [c], "library")
            : undefined
        }
        draggingCardIds={
          drag?.sourceZone === "library"
            ? new Set(drag.cards.map((c) => c.id))
            : undefined
        }
      />

      {/* Set-life modal — opens on Ctrl/Cmd+L. Portal-rendered so it
          sits above every other PlayerBox regardless of stacking
          context. Only the local player can trigger it (keyboard
          binding gated on isSelf), but the modal itself renders
          without extra guards since the setter is only ever wired
          from the local box's keydown handler. */}
      {setLifeModalOpen &&
        createPortal(
          <SetLifeModal
            currentLife={life}
            onCancel={() => setSetLifeModalOpen(false)}
            onConfirm={(value) => {
              setLife(value);
              setSetLifeModalOpen(false);
            }}
          />,
          document.body,
        )}

      {/* Set-mana-counter modal — opens from the battlefield menu's
          Counters → <color> → "Set counter..." row. Reuses SetLifeModal
          (same arithmetic-input UX) with the counter's name in the
          title. Fires Command_SetCounter via `onSetPlayerCounter`;
          server clamps to [0, MAX_COUNTER_VALUE] so we can just
          pass the raw evaluated value. */}
      {setManaCounterModal &&
        createPortal(
          <SetLifeModal
            currentLife={setManaCounterModal.currentValue}
            title={`Set ${setManaCounterModal.label.toLowerCase()} counter`}
            subtitle={`Current: ${setManaCounterModal.currentValue}`}
            ariaLabel={`Set ${setManaCounterModal.label} counter`}
            onCancel={() => setSetManaCounterModal(null)}
            onConfirm={(value) => {
              onSetPlayerCounter?.(
                setManaCounterModal.counterId,
                Math.max(0, value),
              );
              setSetManaCounterModal(null);
            }}
          />,
          document.body,
        )}

      {/* Annotation modal — opens from the "Set annotation..." card
          context menu item. Submit sends Command_SetCardAttr with
          AttrAnnotation; empty text clears the annotation. */}
      {annotationModal &&
        createPortal(
          <SetAnnotationModal
            cardName={annotationModal.cardName}
            currentAnnotation={annotationModal.current}
            onCancel={() => setAnnotationModal(null)}
            onConfirm={(value) => {
              // Loop over the snapshotted target set — server has no
              // bulk-annotation wire, so one Command_SetCardAttr per
              // card. Matches Cockatrice's actSetAnnotation which
              // iterates selectedCards.
              if (onSetAnnotation) {
                for (const id of annotationModal.targetIds) {
                  onSetAnnotation(id, value);
                }
              }
              setAnnotationModal(null);
            }}
          />,
          document.body,
        )}

      {/* Menu-initiated arrow visuals — live arrow from the source card
          to the cursor. Green for "Attach to card...", red for "Draw
          arrow...". Ports Cockatrice's ArrowAttachItem / ArrowDragItem
          mouse-grabbed visuals (arrow_item.cpp:177+, 288+). Uses the
          exact same curved-leaf path helper the right-click-drag arrow
          uses so the shape is 1:1. */}
      {(attachPending || drawArrowPending) && pendingArrowPointer &&
        (() => {
          const pending = attachPending ?? drawArrowPending!;
          const color = attachPending ? ArrowColor.GREEN : ArrowColor.RED;
          // Look up the source card element by its data attributes to
          // anchor the arrow at its center. Uses querySelector rather
          // than a ref so we don't have to plumb the source ref out of
          // the render loop.
          const el = document.querySelector(
            `[data-card-id="${CSS.escape(String(pending.sourceCardId))}"][data-card-owner="${CSS.escape(String(playerId))}"][data-card-zone="${CSS.escape(ZoneName.TABLE)}"]`,
          ) as HTMLElement | null;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const sx = r.left + r.width / 2;
          const sy = r.top + r.height / 2;
          const geom = buildArrowGeometry(sx, sy, pendingArrowPointer.x, pendingArrowPointer.y);
          if (!geom) return null;
          // Cockatrice's ArrowItem::paint uses alpha 150 while unlocked
          // and 200 when snapped to a target. We don't do target-snap
          // preview here (menu flows resolve on click), so always draw
          // at 200 to read as "committed direction".
          const fill = rgbaToCss({ ...color, a: 200 });
          return createPortal(
            <svg
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                pointerEvents: "none",
                zIndex: 200,
                overflow: "visible",
              }}
              aria-hidden
            >
              <g
                transform={`translate(${geom.originX} ${geom.originY}) rotate(${geom.angleDeg})`}
              >
                <path
                  d={geom.d}
                  fill={fill}
                  stroke="black"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              </g>
            </svg>,
            document.body,
          );
        })()}

      {/* View top/bottom N cards modal — from the "View top cards of
          library..." (and eventually "View bottom cards...") library
          context menu items. Submit dispatches Command_DumpZone with
          the requested count + direction, then opens the search dialog
          keyed to the revealed snapshot. */}
      {viewNCardsModal &&
        createPortal(
          <ViewNCardsModal
            isReversed={viewNCardsModal.isReversed}
            deckSize={viewNCardsModal.deckSize}
            initial={Math.min(
              3,
              Math.max(1, viewNCardsModal.deckSize),
            )}
            onCancel={() => setViewNCardsModal(null)}
            onConfirm={(value) => {
              onDumpTopCards?.(value, viewNCardsModal.isReversed);
              setTopCardsView({ isReversed: viewNCardsModal.isReversed });
              setViewNCardsModal(null);
            }}
          />,
          document.body,
        )}

      {/* "Reveal top cards to <player>" numeric prompt. Same modal as
          "View top cards" — same input math, same clamp — with a
          reveal-specific title. Submit fires Command_RevealCards
          (via onRevealTopCards); server sends face-up card list to
          the target (and originator), summary to spectators. Our
          IncomingRevealDialog picks up the receiver-side popup for
          anyone in the reveal audience. */}
      {revealTopCardsPrompt &&
        createPortal(
          <ViewNCardsModal
            isReversed={false}
            deckSize={revealTopCardsPrompt.deckSize}
            initial={Math.min(3, Math.max(1, revealTopCardsPrompt.deckSize))}
            titleOverride={`Reveal top cards of library to ${revealTopCardsPrompt.targetName}`}
            onCancel={() => setRevealTopCardsPrompt(null)}
            onConfirm={(value) => {
              onRevealTopCards?.(revealTopCardsPrompt.targetPlayerId, value);
              setRevealTopCardsPrompt(null);
            }}
          />,
          document.body,
        )}

      {/* Generic count prompt for the Top-of-library / Bottom-of-library
          multi-card submenu items (Move N to grave/exile ± FD, Draw
          bottom N, Shuffle top/bottom N). Reuses ViewNCardsModal — the
          input is a positive integer clamped to deck size, same as
          view/reveal-top-cards. Per-action title, submit label, and
          inline `onSubmit` come from the menu item that opened it. */}
      {countPrompt &&
        createPortal(
          <ViewNCardsModal
            isReversed={false}
            deckSize={countPrompt.deckSize}
            initial={Math.min(3, Math.max(1, countPrompt.deckSize))}
            titleOverride={countPrompt.title}
            submitLabel={countPrompt.submitLabel}
            onCancel={() => setCountPrompt(null)}
            onConfirm={(value) => {
              countPrompt.onSubmit(value);
              setCountPrompt(null);
            }}
          />,
          document.body,
        )}

      {/* Zone-reveal dialog for the "View top / bottom cards of
          library..." flow. Same component will host graveyard / exile
          reveal flows too — the caller supplies the title, shuffle
          option, and reorder handler; the dialog itself is
          zone-agnostic. Cockatrice's ZoneView shows revealed cards in
          server order (no sort/group), and lets you drag them to
          reorder — the parent forwards that as
          Command_MoveCard(source=zone, target=zone, x=toIndex). */}
      {topCardsView && (
        <ZoneRevealDialog
          isOpen
          title={`${topCardsView.isReversed ? 'Bottom' : 'Top'} ${revealedDeckCards?.length ?? 0} cards — ${name}`}
          cards={revealedDeckCards ?? []}
          // Position label per card: the actual 0-indexed deck position,
          // read straight off the reveal card's id (server writes the
          // real deck position — Cockatrice invariant, see
          // reindexRevealed / view_zone_logic.cpp). Bottom view: server
          // sends cards.size()-N..cards.size()-1 in that order, so
          // revealed[N-1] is the actual bottom. Ends → "Top" / "Bottom";
          // middle → the raw 0-indexed position.
          labels={(revealedDeckCards ?? []).map((c) => {
            const libraryPos = Number(c.id);
            if (!Number.isFinite(libraryPos)) return '';
            if (libraryPos <= 0) return 'Top';
            if (libraryPos >= deckCount - 1) return 'Bottom';
            return String(libraryPos);
          })}
          // Outbound drag — pointerdown on a card starts a normal
          // library-source drag, so it can be dropped on any zone in
          // the play area. Drops back on the dialog resolve to library
          // via `zoneRevealDialogRef` in detectDropTarget.
          onCardPointerDown={
            isSelf
              ? (e, c) => beginDrag(e, [c], "library")
              : undefined
          }
          dropRef={zoneRevealDialogRef}
          draggingCardIds={
            drag?.sourceZone === "library"
              ? new Set(drag.cards.map((c) => c.id))
              : undefined
          }
          onClose={() => {
            setTopCardsView(null);
            onClearRevealedDeck?.();
          }}
        />
      )}

      {/* View graveyard / View exile — reuses LibrarySearchDialog so
          the pile view / group-by / sort-by controls match the
          "View library" flow. Both graveyard and exile are public
          zones whose full card list Redux already carries, so no
          wire fires on open (unlike the library flow which needs
          Command_DumpZone first) and nothing needs clearing on
          close. `showShuffleOnClose={false}` hides the toggle —
          shuffling a pile that isn't the library makes no sense.
          `enrichedDeckCards` is passed so the group/sort dropdowns
          have Scryfall-backfilled type / cmc / color info to work
          with (graveyard cards typically originated from the deck). */}
      {pileView && (
        <LibrarySearchDialog
          isOpen
          title={`${pileView.zone === "graveyard" ? "Graveyard" : "Exile"} — ${name}`}
          showShuffleOnClose={false}
          library={
            pileView.zone === "graveyard"
              ? graveDisplayList
              : exileDisplayList
          }
          deckCards={enrichedDeckCards}
          playerName={name}
          onCardPointerDown={
            isSelf
              ? (e, c) => beginDrag(e, [c], pileView.zone)
              : undefined
          }
          // Per-card right-click menu. Anchors at the pointer so it
          // opens where the user clicked, and carries the source
          // zone (GRAVE / EXILE) so the Draw arrow flow can set the
          // wire's `startZone` correctly.
          onCardContextMenu={(e, c) => {
            setPileCardMenu({
              zone:
                pileView.zone === "graveyard"
                  ? ZoneName.GRAVE
                  : ZoneName.EXILE,
              cardId: c.id,
              cardName: c.name,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          // dropRef lets detectDropTarget hit-test the modal so a
          // drag-and-release inside the dialog resolves to the source
          // pile (same-zone no-op) instead of falling through to the
          // battlefield behind. Without this the modal was invisible
          // to drop detection.
          dropRef={pileViewDialogRef}
          draggingCardIds={
            drag?.sourceZone === pileView.zone
              ? new Set(drag.cards.map((c) => c.id))
              : undefined
          }
          onClose={() => setPileView(null)}
        />
      )}

      {/* Sideboard view — Cockatrice's actViewSideboard opens the
          same zone-view dialog "View library" uses (player_actions.cpp:232-234).
          We reuse LibrarySearchDialog against the local player's
          SIDEBOARD zone. Owner-only (gated on isSelf) — sideboard
          contents are private, and only the owner has byId/order
          populated. No wire fires on open: the sideboard zone is
          already populated in Redux from the initial game state
          broadcast. Drag out: cards flow through beginDrag as normal
          library-style drops. Drop in: detectDropTarget routes drops
          on the modal to `{ zone: "sideboard" }`, applyMove fires
          Command_MoveCard(target=SIDEBOARD, x=-1) to append. */}
      {isSelf && viewSideboardOpen && (
        <LibrarySearchDialog
          isOpen
          title={`Sideboard — ${name}`}
          showShuffleOnClose={false}
          library={sideboardCards ?? []}
          deckCards={enrichedDeckCards}
          playerName={name}
          onCardPointerDown={(e, c) => beginDrag(e, [c], "sideboard")}
          dropRef={sideboardDialogRef}
          draggingCardIds={
            drag?.sourceZone === "sideboard"
              ? new Set(drag.cards.map((c) => c.id))
              : undefined
          }
          onClose={() => {
            closeViewSideboard();
            // Clear the revealed snapshot so the next open re-dumps
            // fresh (mirrors Cockatrice's zoneViewCleared broadcast
            // on ZoneViewWidget close).
            onClearRevealedSideboard?.();
          }}
        />
      )}

      {/* Draw cards modal — from the "Draw cards..." library context
          menu item. Submit calls `draw(N)` which fires the same wire
          + local flow used by Ctrl+D. */}
      {drawCardsModal &&
        createPortal(
          <DrawCardsModal
            deckSize={drawCardsModal.deckSize}
            initial={Math.min(1, Math.max(1, drawCardsModal.deckSize))}
            onCancel={() => setDrawCardsModal(null)}
            onConfirm={(value) => {
              draw(value);
              setDrawCardsModal(null);
            }}
          />,
          document.body,
        )}

      {/* "Create token..." modal — from the battlefield context menu's
          Create-token item. Submit fires Command_CreateToken via
          onCreateToken (GameBoardCell computes y from a Dexie tablerow
          lookup) and snapshots the args into lastToken so a subsequent
          "Create another token" can re-fire without reprompting. Pre-
          seeds fields from lastToken so the modal is a good "edit last
          token" flow too. */}
      {createTokenModalOpen &&
        createPortal(
          <CreateTokenModal
            initial={lastToken}
            onCancel={() => setCreateTokenModalOpen(false)}
            onConfirm={(payload) => {
              setLastToken(payload);
              setCreateTokenModalOpen(false);
              onCreateToken?.(payload);
            }}
          />,
          document.body,
        )}

      {/* Set-card-counter modal — from the "Set counters (X)..."
          submenu items. Submit sends Command_SetCardCounter with an
          absolute value. */}
      {setCounterModal &&
        createPortal(
          <SetCardCounterModal
            cardName={setCounterModal.cardName}
            counterLetter={setCounterModal.counterLetter}
            counterColor={COUNTER_COLORS[setCounterModal.counterId] ?? '#888'}
            currentValue={setCounterModal.currentValue}
            onCancel={() => setSetCounterModal(null)}
            onConfirm={(value) => {
              // Apply the same absolute value to every snapshotted
              // target — one atomic CommandContainer via the bulk
              // helper. Matches Cockatrice's actSetCardCounter which
              // batches per-card SetCardCounter into one command list.
              if (onBulkSetCardCounters) {
                const clamped = Math.max(0, value);
                onBulkSetCardCounters(
                  setCounterModal.targetIds.map((id) => ({
                    cardId: id,
                    counterId: setCounterModal.counterId,
                    value: clamped,
                  })),
                );
              }
              setSetCounterModal(null);
            }}
          />,
          document.body,
        )}

      {/* Move X cards from top modal — from the "X cards from the top
          of library..." submenu item. Submit sends Command_MoveCard
          with x=N to place the card at position N in the deck. */}
      {moveXModal &&
        createPortal(
          <MoveXCardsFromTopModal
            cardName={moveXModal.cardName}
            deckSize={moveXModal.deckSize}
            initial={Math.min(3, Math.max(0, moveXModal.deckSize))}
            onCancel={() => setMoveXModal(null)}
            onConfirm={(value) => {
              if (onMoveCard && playerId != null) {
                onMoveCard({
                  startPlayerId: playerId,
                  startZone: ZoneName.TABLE,
                  cardsToMove: { card: [{ cardId: moveXModal.cardId }] },
                  targetPlayerId: playerId,
                  targetZone: ZoneName.DECK,
                  x: value,
                  y: 0,
                  isReversed: false,
                });
              }
              setMoveXModal(null);
            }}
          />,
          document.body,
        )}

      {/* Set-PT modal — opens from the "Set power and toughness..."
          card context menu item. Input is passed through applyPTSet so
          Cockatrice's DSL (`+1/+1`, `3/4`, `2/*`) behaves identically. */}
      {ptModal &&
        createPortal(
          <SetPTModal
            cardName={ptModal.cardName}
            currentPT={ptModal.current}
            onCancel={() => setPTModal(null)}
            onConfirm={(value) => {
              // Apply applyPTSet to every snapshotted target — each
              // card uses ITS OWN current PT as the base for the DSL
              // (so `+1/+1` bumps a 2/2 to 3/3 and a 4/5 to 5/6 in
              // the same batch). Single onSetPT batch keeps the wire
              // atomic. Matches Cockatrice's actSetPT loop.
              if (onSetPT) {
                const entries: { cardId: number; pt: string }[] = [];
                for (const id of ptModal.targetIds) {
                  const bc = battlefieldDisplayList.find(
                    (x) => Number(x.id) === id,
                  );
                  const base =
                    bc?.pt ||
                    (bc ? cardMetaByName.get(bc.name)?.pt ?? '' : '');
                  entries.push({
                    cardId: id,
                    pt: applyPTSet(base, value),
                  });
                }
                if (entries.length > 0) onSetPT(entries);
              }
              setPTModal(null);
            }}
          />,
          document.body,
        )}

      {/* Card context menu — right-click a battlefield card to open.
          All actions apply to a single card via its real numeric id;
          the menu no-ops for optimistic mock cards without one. */}
      {cardContextMenu &&
        (() => {
          const cardIdNum = Number(cardContextMenu.cardId);
          const card = battlefieldDisplayList.find(
            (bc) => bc.id === cardContextMenu.cardId,
          );
          const numeric = Number.isFinite(cardIdNum) && card != null;
          const close = () => setCardContextMenu(null);
          // Opponent card menu — ports Cockatrice's
          // card_menu.cpp:183-194 `!canModifyCard` branch on the TABLE
          // zone. Minimal item set: things a viewer can do to an
          // opponent's battlefield card without modifying opponent
          // state (arrows, clone via own-side token, life bookkeeping,
          // selection). Excludes tap / flip / P/T / annotation /
          // counters / move / attach — all owner-only.
          if (!isSelf) {
            // Selection scope on an opponent battlefield: the same
            // rule as own-side — if the right-clicked card is part of
            // THIS battlefield's local selection, actions treat the
            // whole selection as targets; otherwise just this card.
            // Local selection state is scoped per PlayerBox, so an
            // opponent PlayerBox has its OWN selection here (used by
            // the viewer to visually group opponent cards).
            const targets: BattlefieldCard[] = card
              && selection?.zone === 'battlefield'
              && selection.ids.has(card.id)
              ? battlefieldDisplayList.filter((bc) => selection.ids.has(bc.id))
              : card
                ? [card]
                : [];
            const opponentItems: CardMenuItem[] = [
              {
                // Enters pending-arrow mode from the opponent's card.
                // Wire is symmetric: arrow is created by the LOCAL
                // player and points at any card or player. Fires the
                // same setDrawArrowPending flow as the own-side menu.
                label: 'Draw arrow...',
                shortcut: 'Alt+A',
                onClick: () => {
                  if (numeric && card) {
                    setDrawArrowPending({
                      sourceCardId: cardIdNum,
                      sourceCardName: card.name,
                      sourceZone: ZoneName.TABLE,
                    });
                  }
                  close();
                },
              },
              {
                // Creates a token on the LOCAL player's battlefield
                // that copies the opponent's card. Same wire as own-
                // side clone: Command_CreateToken is sent by the
                // local client so the server assigns local ownership.
                label: 'Clone',
                shortcut: 'Ctrl+J',
                onClick: () => {
                  if (onCloneCard && targets.length > 0) {
                    for (const bc of targets) {
                      if (!Number.isFinite(Number(bc.id))) {
                        continue;
                      }
                      onCloneCard({
                        name: bc.name,
                        providerId: bc.scryfallId,
                        color: bc.color ?? '',
                        pt: bc.pt ?? '',
                        annotation: bc.annotation ?? '',
                        y: bc.slot.row,
                      });
                    }
                  }
                  close();
                },
              },
              { divider: true },
              {
                // Ports actReduceLifeByPower (player_actions.cpp:1432-
                // 1455). Sums power over the selection (or just this
                // card) and fires one Command_IncCounter with a
                // negative delta. Cockatrice sends this against the
                // card owner's life counter id; Servatrice creates
                // the life counter with the same numeric id for every
                // seat, so calling `onDelta` on THIS PlayerBox's
                // lifeControl (which carries the opponent's life
                // counter id) routes through the local client and
                // modifies the LOCAL player's life counter — matching
                // desktop's "opponent creature just hit me, subtract
                // its power from my life" outcome. Same coincidence
                // Cockatrice itself relies on.
                label: 'Reduce life by power',
                shortcut: 'Ctrl+Shift+L',
                onClick: () => {
                  let total = 0;
                  for (const bc of targets) {
                    if (!bc.pt) {
                      continue;
                    }
                    const tokens = parsePT(bc.pt);
                    if (tokens.length === 0) {
                      continue;
                    }
                    const first = tokens[0];
                    const power = typeof first === 'number'
                      ? first
                      : parseInt(first, 10);
                    if (Number.isFinite(power)) {
                      total += Math.max(power, 0);
                    }
                  }
                  if (total > 0) {
                    lifeControl?.onDelta(-total);
                  }
                  close();
                },
              },
              { divider: true },
              {
                // Mirror the own-side handlers. Opponent PlayerBox
                // owns its own local marquee-selection state; setting
                // it here highlights the opponent's cards visually so
                // a subsequent Draw arrow / Clone can act on the group.
                label: 'Select All',
                shortcut: 'Ctrl+A',
                onClick: () => {
                  const ids = new Set(
                    battlefieldDisplayList.map((bc) => bc.id),
                  );
                  if (ids.size > 0) {
                    setSelection({ zone: 'battlefield', ids });
                  }
                  close();
                },
              },
              {
                label: 'Select Row',
                shortcut: 'Ctrl+Shift+X',
                onClick: () => {
                  if (!card) {
                    close();
                    return;
                  }
                  const ids = new Set(
                    battlefieldDisplayList
                      .filter((bc) => bc.slot.row === card.slot.row)
                      .map((bc) => bc.id),
                  );
                  if (ids.size > 0) {
                    setSelection({ zone: 'battlefield', ids });
                  }
                  close();
                },
              },
              { divider: true },
              // Cockatrice reads the card's `related` field from the
              // card DB and pops up a small dialog. We don't have that
              // wire yet; leave as a disabled placeholder so the menu
              // shape matches desktop 1:1 (card_menu.cpp:194).
              { label: 'View related cards' },
              // "Token: …" items — same shape as the own-card menu
              // below. Ports Cockatrice's addRelatedCardActions
              // (card_menu.cpp:407-479). Command_CreateToken fires as
              // the LOCAL player so the token lands on OUR
              // battlefield — matches desktop (right-clicking an
              // opponent's Avenger of Zendikar creates the Plant on
              // your side). See buildRelatedTokenItems for the label
              // format + count/persistent semantics. The Transform
              // item is included but it fires against the opponent's
              // card id — server processes as "replace opponent's
              // DFC with the new face" the same as own-side.
              ...(() => {
                if (!card) {
                  return [];
                }
                const items = [
                  ...buildRelatedTokenItems(
                    cardMetaByName.get(card.name)?.related ?? [],
                    tokenMetaByName,
                    onCreateToken,
                  ),
                  ...buildTransformItems(
                    cardMetaByName.get(card.name),
                    Number.isFinite(cardIdNum) ? cardIdNum : undefined,
                    card.name,
                    onCreateToken,
                  ),
                ];
                return items.length > 0
                  ? [{ divider: true } as CardMenuItem, ...items]
                  : [];
              })(),
            ];
            return createPortal(
              <CardContextMenuPopup
                items={opponentItems}
                anchorX={cardContextMenu.x}
                anchorY={cardContextMenu.y}
                disabled={!numeric}
              />,
              document.body,
            );
          }
          // Multi-card target set. Cockatrice's cardMenuAction pattern
          // (player_actions.cpp:1761-1808): if the right-clicked card
          // is part of the current marquee selection, actions apply to
          // every selected card; otherwise, they apply only to this
          // card. `targetCards` is filtered to numeric server ids —
          // optimistic mock-id cards silently drop out of the batch.
          const targetCards: BattlefieldCard[] =
            card &&
            selection?.zone === "battlefield" &&
            selection.ids.has(card.id)
              ? battlefieldDisplayList.filter((bc) =>
                  selection.ids.has(bc.id),
                )
              : card
                ? [card]
                : [];
          const targetIds: number[] = targetCards
            .map((c) => Number(c.id))
            .filter((n) => Number.isFinite(n));
          const dispatchMove = (
            targetZone: string,
            extra: { x?: number; y?: number; isReversed?: boolean } = {},
          ) => {
            if (targetIds.length === 0 || !onMoveCard || playerId == null) {
              return;
            }
            // Single Command_MoveCard with cards_to_move populated for
            // every selected card — matches Cockatrice's batched
            // move (cardsToMove is a repeated field).
            onMoveCard({
              startPlayerId: playerId,
              startZone: ZoneName.TABLE,
              cardsToMove: {
                card: targetIds.map((cardId) => ({ cardId })),
              },
              targetPlayerId: playerId,
              targetZone,
              x: extra.x ?? 0,
              y: extra.y ?? 0,
              isReversed: extra.isReversed ?? false,
            });
          };
          // Effective current PT — prefer server's tagged PT, fall back
          // to the Scryfall base so Inc/Dec/Flow have a starting value
          // even before the server has committed any AttrPT change.
          const currentPT =
            card?.pt || (card ? cardMetaByName.get(card.name)?.pt ?? '' : '');
          // Per-card PT delta batch: each card computes its own new PT
          // from its own current server PT (not the clicked card's PT).
          // Skips cards with an empty base so we don't stamp "1/1" onto
          // non-creatures. Single onSetPT batch keeps the wire atomic.
          const dispatchPTDelta = (dp: number, dt: number) => {
            if (targetCards.length === 0 || !onSetPT) return;
            const entries: { cardId: number; pt: string }[] = [];
            for (const bc of targetCards) {
              const bcId = Number(bc.id);
              if (!Number.isFinite(bcId)) continue;
              const bcCurrent =
                bc.pt || (cardMetaByName.get(bc.name)?.pt ?? '');
              if (!bcCurrent) continue;
              entries.push({
                cardId: bcId,
                pt: applyPTDelta(bcCurrent, dp, dt),
              });
            }
            if (entries.length > 0) onSetPT(entries);
          };
          // "Token: …" items from the card's related list PLUS the
          // "Token: Transform into …" item for DFC-family cards.
          // Both appear in Cockatrice's addRelatedCardActions block,
          // rendered as a flat list under "Card counters".
          const tokenItems: CardMenuItem[] = card
            ? [
              ...buildRelatedTokenItems(
                cardMetaByName.get(card.name)?.related ?? [],
                tokenMetaByName,
                onCreateToken,
              ),
              ...buildTransformItems(
                cardMetaByName.get(card.name),
                Number.isFinite(cardIdNum) ? cardIdNum : undefined,
                card.name,
                onCreateToken,
              ),
            ]
            : [];
          const menu = buildCardContextMenu({
            faceDown: card?.faceDown ?? false,
            doesntUntap: card?.doesntUntap ?? false,
            onTapUntap: () => {
              // Toggle all selected cards to the OPPOSITE of the
              // clicked card's tapped state (matches Cockatrice: the
              // clicked card drives the target value so a mixed
              // selection all lands in the same state).
              if (targetIds.length > 0 && card && onSetCardTapped) {
                onSetCardTapped(targetIds, !card.tapped);
              }
              close();
            },
            onFlip: () => {
              // Batch each selected card's flip individually — wire
              // takes a single cardId. Uses the clicked card's
              // current faceDown to drive the target value so a
              // mixed selection unifies.
              if (targetIds.length > 0 && onFlipCard) {
                const target = !card?.faceDown;
                for (const id of targetIds) onFlipCard(id, target);
              }
              close();
            },
            onSkipUntapping: () => {
              if (targetIds.length > 0 && onSetCardDoesntUntap) {
                const target = !card?.doesntUntap;
                for (const id of targetIds) {
                  onSetCardDoesntUntap(id, target);
                }
              }
              close();
            },
            onClone: () => {
              // Fire one Command_CreateToken per selected card,
              // preserving each card's own name / provider / color /
              // pt / annotation / row — matches Cockatrice's cmClone
              // which iterates the selection. Skips optimistic-mock
              // cards (no server card to clone).
              if (onCloneCard && targetCards.length > 0) {
                for (const bc of targetCards) {
                  if (!Number.isFinite(Number(bc.id))) continue;
                  onCloneCard({
                    name: bc.name,
                    providerId: bc.scryfallId,
                    color: bc.color ?? "",
                    pt: bc.pt ?? "",
                    annotation: bc.annotation ?? "",
                    y: bc.slot.row,
                  });
                }
              }
              close();
            },
            onSetAnnotation: () => {
              // Modal takes a single input, but the confirmed text is
              // applied to EVERY selected card. Snapshot targetIds
              // now so a mid-modal selection change doesn't shift the
              // target set. Pre-fill from the clicked card.
              if (targetIds.length > 0 && card) {
                setAnnotationModal({
                  targetIds,
                  cardName: card.name,
                  current: card.annotation ?? "",
                });
              }
              close();
            },
            onMoveToTop: () => {
              dispatchMove(ZoneName.DECK, { x: 0 });
              close();
            },
            onMoveToBottom: () => {
              dispatchMove(ZoneName.DECK, { x: 0, isReversed: true });
              close();
            },
            onMoveToXCardsFromTop: () => {
              if (numeric && card) {
                // Prefer the server-authoritative deck count from
                // Redux, fall back to the local library length. Matches
                // Cockatrice's `player->getDeckZone()->getCards().size()`.
                const deckSize = zoneCounts?.deck ?? 0;
                setMoveXModal({
                  cardId: cardIdNum,
                  cardName: card.name,
                  deckSize,
                });
              }
              close();
            },
            onMoveToTable: () => {
              dispatchMove(ZoneName.TABLE);
              close();
            },
            onMoveToHand: () => {
              dispatchMove(ZoneName.HAND);
              close();
            },
            onMoveToGrave: () => {
              dispatchMove(ZoneName.GRAVE);
              close();
            },
            onMoveToExile: () => {
              dispatchMove(ZoneName.EXILE);
              close();
            },
            onIncP: () => {
              dispatchPTDelta(1, 0);
              close();
            },
            onDecP: () => {
              dispatchPTDelta(-1, 0);
              close();
            },
            onFlowP: () => {
              dispatchPTDelta(1, -1);
              close();
            },
            onIncT: () => {
              dispatchPTDelta(0, 1);
              close();
            },
            onDecT: () => {
              dispatchPTDelta(0, -1);
              close();
            },
            onFlowT: () => {
              dispatchPTDelta(-1, 1);
              close();
            },
            onIncPT: () => {
              dispatchPTDelta(1, 1);
              close();
            },
            onDecPT: () => {
              dispatchPTDelta(-1, -1);
              close();
            },
            onSetPT: () => {
              // Modal takes a single input string — applied to every
              // selected card on confirm (each card uses its own
              // current PT as the applyPTSet base). Snapshot the
              // target ids at open time so a mid-modal selection
              // change doesn't shift the target set.
              if (targetIds.length > 0 && card) {
                setPTModal({
                  targetIds,
                  cardName: card.name,
                  current: currentPT,
                });
              }
              close();
            },
            onResetPT: () => {
              // Per-card reset: face-down cards reset to empty PT,
              // face-up cards reset to their own printed base PT
              // (each card has its own base from Scryfall). Skip cards
              // already at their reset value.
              if (targetCards.length === 0 || !onSetPT) {
                close();
                return;
              }
              const entries: { cardId: number; pt: string }[] = [];
              for (const bc of targetCards) {
                const bcId = Number(bc.id);
                if (!Number.isFinite(bcId)) continue;
                const base = bc.faceDown
                  ? ''
                  : cardMetaByName.get(bc.name)?.pt ?? '';
                if (base !== (bc.pt ?? '')) {
                  entries.push({ cardId: bcId, pt: base });
                }
              }
              if (entries.length > 0) onSetPT(entries);
              close();
            },
            onAttachToCard: () => {
              if (numeric && card) {
                setAttachPending({
                  sourceCardId: cardIdNum,
                  sourceCardName: card.name,
                });
              }
              close();
            },
            onDrawArrow: () => {
              if (numeric && card) {
                setDrawArrowPending({
                  sourceCardId: cardIdNum,
                  sourceCardName: card.name,
                  // Battlefield-card menu → source zone is always TABLE.
                  // The grave / exile pile-view menus fire their own
                  // setDrawArrowPending with the appropriate zone name.
                  sourceZone: ZoneName.TABLE,
                });
              }
              close();
            },
            onReduceLifeByPower: () => {
              // Cockatrice iterates the marquee selection so several
              // creatures' powers can sum. Mirror that: if this card is
              // part of the current battlefield selection, use every
              // selected card; otherwise just this card.
              const targetIds =
                card && selection?.zone === "battlefield" && selection.ids.has(card.id)
                  ? selection.ids
                  : card
                    ? new Set<string>([card.id])
                    : new Set<string>();
              // Sum powers from ONLY the server-set PT (`card.pt`).
              // Matches Cockatrice's `card->getPT()` — no fallback to
              // Scryfall printed PT. A creature the server hasn't
              // tagged with a PT contributes 0 (its `pt` is empty and
              // `parsePT` returns []). First token → power; negative
              // clamped to 0 via `Math.max(power, 0)` matching Cockatrice's
              // `qMax(parsed.first().toInt(), 0)`.
              let total = 0;
              for (const id of targetIds) {
                const bc = battlefieldDisplayList.find((x) => x.id === id);
                if (!bc || !bc.pt) continue;
                const tokens = parsePT(bc.pt);
                if (tokens.length === 0) continue;
                const first = tokens[0];
                const power =
                  typeof first === 'number' ? first : parseInt(first, 10);
                if (Number.isFinite(power)) {
                  total += Math.max(power, 0);
                }
              }
              if (total > 0) {
                lifeControl?.onDelta(-total);
              }
              close();
            },
            onSelectAll: () => {
              // Every card on this battlefield. Cross-battlefield
              // selection isn't a Cockatrice thing — actSelectAll
              // scopes to `card->getZone()` which is this player's
              // TABLE zone.
              const ids = new Set(battlefieldDisplayList.map((bc) => bc.id));
              if (ids.size > 0) {
                setSelection({ zone: "battlefield", ids });
                broadcastBattlefieldSelection?.(new Map());
              }
              close();
            },
            onSelectRow: () => {
              // Every battlefield card sharing this card's `slot.row`.
              // Cockatrice's `actSelectRow` uses a 50-scene-pixel
              // vertical threshold since positions can drift within a
              // row; our layout snaps cards to discrete rows via
              // `slot.row`, so exact match is equivalent.
              if (!card) {
                close();
                return;
              }
              const ids = new Set(
                battlefieldDisplayList
                  .filter((bc) => bc.slot.row === card.slot.row)
                  .map((bc) => bc.id),
              );
              if (ids.size > 0) {
                setSelection({ zone: "battlefield", ids });
                broadcastBattlefieldSelection?.(new Map());
              }
              close();
            },
            isAttached:
              card?.attachTargetCardId != null && card.attachTargetCardId >= 0,
            onUnattach: () => {
              // Fire per-card unattach for every selected card. Server
              // treats each unattach independently (no batch wire), so
              // we loop.
              if (onUnattachCard) {
                for (const id of targetIds) onUnattachCard(id);
              }
              close();
            },
            onAddCardCounter: (counterId: number) => {
              // Batch: each selected card computes its OWN cur+1
              // (independent of the clicked card's value) so a mixed
              // selection doesn't get truncated. Uses the atomic
              // bulk-set helper so all cards land in one wire.
              if (onBulkSetCardCounters && targetCards.length > 0) {
                const entries: {
                  cardId: number;
                  counterId: number;
                  value: number;
                }[] = [];
                for (const bc of targetCards) {
                  const bcId = Number(bc.id);
                  if (!Number.isFinite(bcId)) continue;
                  const cur =
                    bc.counters?.find((cc) => cc.id === counterId)?.value ??
                    0;
                  if (cur >= MAX_COUNTER_VALUE) continue;
                  entries.push({
                    cardId: bcId,
                    counterId,
                    value: cur + 1,
                  });
                }
                if (entries.length > 0) onBulkSetCardCounters(entries);
              }
              close();
            },
            onSetCardCounter: (counterId: number) => {
              // Modal takes a single input — applied to every selected
              // card on confirm. Pre-fills with the clicked card's
              // current value. Snapshot targetIds at open time.
              if (targetIds.length > 0 && card) {
                const cur =
                  card.counters?.find((cc) => cc.id === counterId)?.value ?? 0;
                const letters = ["A", "B", "C", "D", "E", "F"] as const;
                setSetCounterModal({
                  targetIds,
                  cardName: card.name,
                  counterId,
                  counterLetter: letters[counterId] ?? String(counterId),
                  currentValue: cur,
                });
              }
              close();
            },
            tokenItems,
          });
          return createPortal(
            <CardContextMenuPopup
              items={menu}
              anchorX={cardContextMenu.x}
              anchorY={cardContextMenu.y}
              disabled={!numeric}
            />,
            document.body,
          );
        })()}

      {/* Pile-view card context menu — right-click a card inside the
          graveyard / exile pile-view modal. View-only shape: Draw
          arrow / Clone / Select All / Select Column, matching
          Cockatrice's card-in-ZoneView menu. Uses the same
          CardContextMenuPopup renderer as the battlefield menu — only
          the item set differs. */}
      {pileCardMenu &&
        (() => {
          const cardIdNum = Number(pileCardMenu.cardId);
          const numeric = Number.isFinite(cardIdNum);
          const close = () => setPileCardMenu(null);
          const items: CardMenuItem[] = [
            {
              // "Draw arrow..." — enters pending-arrow mode with the
              // source pointing at THIS grave/exile card. The window-
              // level resolver above handles the target pick; the wire
              // fires with startZone = the pile's zone (GRAVE / EXILE)
              // so both clients render the arrow off the pile. Only
              // battlefield cards / player anchors are valid targets
              // — Cockatrice never lets you target grave/exile cards.
              label: "Draw arrow...",
              shortcut: "Alt+A",
              onClick: () => {
                if (numeric) {
                  setDrawArrowPending({
                    sourceCardId: cardIdNum,
                    sourceCardName: pileCardMenu.cardName,
                    sourceZone: pileCardMenu.zone,
                  });
                }
                close();
              },
            },
            {
              // "Clone" — creates a token copy on the LOCAL player's
              // battlefield (Command_CreateToken is sent by the local
              // client so the server assigns ownership accordingly).
              // Grave cards don't carry PT / color / annotation state
              // (they were reset when they left the battlefield per
              // resetCardState), so pass empties. Only wired when we
              // have a real numeric card id (mock-id no-op).
              label: "Clone",
              shortcut: isMac() ? "⌘J" : "Ctrl+J",
              onClick: () => {
                if (numeric) {
                  const graveCard =
                    pileView?.zone === "graveyard"
                      ? graveDisplayList.find(
                          (gc) => gc.id === pileCardMenu.cardId,
                        )
                      : exileDisplayList.find(
                          (gc) => gc.id === pileCardMenu.cardId,
                        );
                  if (graveCard) {
                    onCloneCard?.({
                      name: graveCard.name,
                      providerId: graveCard.scryfallId,
                      color: "",
                      pt: "",
                      annotation: "",
                      y: 0,
                    });
                  }
                }
                close();
              },
            },
            {
              // Cockatrice's actSelectAll / actSelectColumn set the
              // marquee selection inside the ZoneView so a subsequent
              // Draw arrow / Clone applies to every selected card.
              // The LibrarySearchDialog owns its own `selectedIds`
              // state internally; wiring these items would need to
              // expose an imperative setter from the dialog. Deferred
              // until a caller actually needs multi-select in this
              // flow — the menu shape stays 1:1 with Cockatrice.
              label: "Select All",
              shortcut: isMac() ? "⌘A" : "Ctrl+A",
            },
            {
              label: "Select Column",
              shortcut: isMac() ? "⌘⇧C" : "Ctrl+Shift+C",
            },
          ];
          return createPortal(
            <CardContextMenuPopup
              items={items}
              anchorX={pileCardMenu.x}
              anchorY={pileCardMenu.y}
              disabled={!numeric}
            />,
            document.body,
          );
        })()}

      {/* Drag ghost — a floating copy of the dragged card(s) tracking the
          pointer. Group drags stack the cards with a small diagonal offset
          so the count is visible without hiding the top card. Only shows
          after the pointer crosses the movement threshold, so a click
          without motion never flashes the ghost.
          Library is a HiddenZone: the server's positional cardId (0 =
          top of ITS shuffle) is authoritative, and the client's local
          mock shuffle can't be matched to it. Showing the local top's
          face here would mislead the user into thinking THAT specific
          card is being moved — so library-source drags render a card
          back instead, matching the pile visualization. */}
      {drag &&
        drag.moved &&
        createPortal(
          <>
            {drag.cards.map((c, i) => (
              <div
                key={c.id}
                style={{
                  position: "fixed",
                  left: drag.pointerX - drag.offsetX + i * 4,
                  top: drag.pointerY - drag.offsetY + i * 4,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  pointerEvents: "none",
                  // Above the search-library dialog (z-1000) so a card
                  // dragged out of the dialog is visible under the
                  // cursor from the moment the drag starts.
                  zIndex: 1100 + i,
                  transform: "rotate(2deg)",
                  filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))",
                }}
              >
                {drag.sourceZone === "library" &&
                drag.sourcePlayerId === undefined ? (
                  <img
                    src={CARD_BACK_URL}
                    alt=""
                    draggable={false}
                    className="w-full h-full select-none pointer-events-none"
                    style={{ borderRadius: CARD_CORNER_RADIUS }}
                  />
                ) : (
                  // Foreign library drag = a card we've already seen via
                  // reveal / lend. Show the face — hiding it would be
                  // confusing since we KNOW what card we're dragging.
                  <Card
                    name={c.name}
                    scryfallId={c.scryfallId}
                    pt={cardMetaByName.get(c.name)?.pt}
                    imageUri={resolveFaceImageUri(c.name)}
                  />
                )}
              </div>
            ))}
          </>,
          document.body,
        )}
    </div>
  );
}

export default forwardRef(PlayerBox);
