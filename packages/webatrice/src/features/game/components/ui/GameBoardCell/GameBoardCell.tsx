import { memo, useEffect, useMemo } from 'react';
import { useStore } from 'react-redux';
import { generatePath, useNavigate } from 'react-router-dom';

import { cx } from '@app/utils';
import { games, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppDispatch, useAppSelector, type RootState } from '@app/store';
import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute, Command_CreateToken_TargetMode } from '@cockatrice/sockatrice/generated';
import type {
  MoveCardParams,
  ServerInfo_DeckStorage_Folder,
  ServerInfo_DeckStorage_TreeItem,
} from '@cockatrice/sockatrice/generated';
import { ArrowColor, RouteEnum } from '@app/types';

import { CardDTO } from '@app/services';
import { BoardCell } from '../../../hooks/useGameBoardLayout';
import { BoardCellProvider } from '../BoardCellContext';
import { useGameId } from '../GameIdContext';
import PlayerBox, {
  type BattlefieldCard,
  type HandCard,
} from '../../PlayerBox/PlayerBox';
import type {
  DeckCard,
  RoomMemberWithProfile,
} from '../../PlayerBox/mockTypes';
import { getPickedMockDeck } from '../../../mockDeckStore';
import { parseCod } from '@app/features/decks';

import './GameBoardCell.css';

// Life is just a counter named "life" (case-insensitive) in Cockatrice's
// protocol — no special-cased life field on players. Mirrors the check
// used by the old PlayerInfoPanel.
function isLifeCounter(c: { name: string }): boolean {
  return c.name.trim().toLowerCase() === 'life';
}

// Flatten Servatrice's backend deck tree into `{id, name}` rows. Same
// walk GameLobby / My Decks use — the tree can nest folders indefinitely,
// but the library-context "Open in deck editor" menu only cares about
// leaf files. Kept as a plain function (not a hook) so the memoization
// call site upstream still owns the reference stability.
function flattenBackendDecks(
  folder: ServerInfo_DeckStorage_Folder | undefined,
): { id: number; name: string }[] {
  const out: { id: number; name: string }[] = [];
  const walk = (items: ServerInfo_DeckStorage_TreeItem[] | undefined) => {
    if (!items) return;
    for (const item of items) {
      if (item.file) out.push({ id: item.id, name: item.name });
      else if (item.folder) walk(item.folder.items);
    }
  };
  walk(folder?.items);
  return out;
}

// Stable empty reference for the pre-hydration transient — keeps
// referential equality when a player has no zone data yet so
// downstream memos don't invalidate on every render.
const EMPTY_HAND_CARDS: HandCard[] = [];

// Project a Cockatrice zone (byId + order) into the PlayerBox HandCard
// shape used for pile-visualization art. `order` runs bottom → top,
// which matches PlayerBox's convention that the last entry is the
// top of the pile.
function zoneToHandCards(
  zone: { order: number[]; byId: Record<number, { name: string; providerId: string }> } | undefined,
): HandCard[] {
  if (!zone) return EMPTY_HAND_CARDS;
  return zone.order.map((id) => {
    const card = zone.byId[id];
    return {
      id: String(id),
      name: card?.name ?? '',
      scryfallId: card?.providerId ?? '',
    };
  });
}

/** Project a `zone.revealedCards` snapshot (populated by Response_DumpZone)
 *  into the HandCard shape LibrarySearchDialog consumes. Used for the
 *  "View top / bottom cards..." library flow — Cockatrice's ZoneView
 *  reads from the same server-side dump. Falls back to the array index
 *  if the server didn't set an id (Cockatrice reveal-list quirk). */
function revealedCardsToHandCards(
  cards: readonly { id: number; name: string; providerId: string }[] | undefined,
): HandCard[] {
  if (!cards || cards.length === 0) return EMPTY_HAND_CARDS;
  return cards.map((c, idx) => ({
    id: String(c.id ?? idx),
    name: c.name ?? '',
    scryfallId: c.providerId ?? '',
  }));
}

const EMPTY_BATTLEFIELD_CARDS: BattlefieldCard[] = [];

// Project a Cockatrice TABLE zone into the PlayerBox BattlefieldCard
// shape. ServerInfo_Card.x maps to slot.col, .y to slot.row — that's
// Cockatrice's coord convention (x horizontal, y vertical).
function zoneToBattlefieldCards(
  zone:
    | {
        order: number[];
        byId: Record<
          number,
          {
            name: string;
            providerId: string;
            x: number;
            y: number;
            tapped: boolean;
            faceDown: boolean;
            pt: string;
            doesntUntap: boolean;
            color: string;
            annotation: string;
            attachPlayerId: number;
            attachZone: string;
            attachCardId: number;
            counterList: readonly { id: number; value: number }[];
          }
        >;
      }
    | undefined,
): BattlefieldCard[] {
  if (!zone) return EMPTY_BATTLEFIELD_CARDS;
  return zone.order.map((id) => {
    const card = zone.byId[id];
    // Cockatrice packs multiple cards per visual column via
    // `wire_x / 3` = stack column and `wire_x % 3` = sub-slot inside
    // that column. Decode both so we can render a stack at the
    // correct diagonal offset even when the server sends a mid-stack
    // card ordering.
    const wireX = Math.max(0, card?.x ?? 0);
    // Attach target: `attachCardId === -1` is the unattached sentinel
    // (matches datatrice's `cardAttached` unattach path). Only surface
    // valid ids so downstream render code can treat presence as truth.
    const attachCardId = card?.attachCardId ?? -1;
    const attachPlayerId = card?.attachPlayerId ?? -1;
    return {
      id: String(id),
      name: card?.name ?? '',
      scryfallId: card?.providerId ?? '',
      slot: {
        row: Math.max(0, card?.y ?? 0),
        col: Math.floor(wireX / 3),
      },
      subSlot: wireX % 3,
      tapped: card?.tapped ?? false,
      faceDown: card?.faceDown ?? false,
      pt: card?.pt || undefined,
      doesntUntap: card?.doesntUntap ?? false,
      color: card?.color || undefined,
      annotation: card?.annotation || undefined,
      attachTargetCardId: attachCardId >= 0 ? attachCardId : undefined,
      attachTargetPlayerId: attachCardId >= 0 ? attachPlayerId : undefined,
      // Wire `counterList` is a repeated ServerInfo_CardCounter — passes
      // through verbatim. Servatrice strips zero-valued counters so the
      // list only contains active ones (matches Cockatrice's iteration).
      counters: card?.counterList,
    };
  });
}

export interface GameBoardCellProps {
  cell: BoardCell;
  /** Total seated player count. Used to decide whether opponent
   *  hand card backs render rotated 180° — flipped for 2 / 4+
   *  player layouts (opponent conceptually "across the table"),
   *  normal for 3-player (opponents on the sides, flipping looks
   *  off). */
  totalPlayers: number;
  // Callbacks kept in the API so Game.tsx's existing wiring compiles
  // through this transitional slice. The ported PlayerBox is
  // wiring-free in step 1; these props will be re-consumed once the
  // ported PlayerBox is wired to og's Cockatrice data model.
  onPlayerContextMenu?: (event: React.MouseEvent) => void;
  onPlayerClick?: (playerId: number) => boolean;
  onHandContextMenu?: (event: React.MouseEvent) => void;
}

/**
 * One seat in the adaptive board grid. Feeds the ported fancy PlayerBox
 * from real Cockatrice state (player identity, life counter, zone
 * counts) plus a picked mock deck for the PlayerBox's still-local
 * zone contents (library / hand / battlefield / etc.).
 *
 * Wiring status:
 *   ✅ Slice 1  — player identity (real name), active-turn glow, life
 *                 counter (reads value, +/- and set dispatch
 *                 Command_IncCounter / Command_SetCounter).
 *   ✅ Slice 2a — library / graveyard / exile card counts read from
 *                 `player.zones.<name>.cardCount`.
 *   ✅ Slice 3a — library-source drag-drops dispatch Command_MoveCard.
 *   ⏳ Slice 2b+ — hand / battlefield / stack / command-zone contents,
 *                  drag+drop from those sources, tap/untap, marquee,
 *                  arrows, card counters, context menus. Still on
 *                  PlayerBox's internal state seeded from the picked
 *                  mock deck.
 */

// Mock deck — enough cards to fill a Commander library so the
// PlayerBox's zone counts / draw animation / library search look
// real. Every entry uses a Scryfall id we know resolves.
const MOCK_DECK: DeckCard[] = [
  // Commander
  {
    id: 'cmd-1',
    card_scryfall_id: '89ef7247-9c56-4ce0-a3f9-9e7a5b0e6e97',
    name: 'Animar, Soul of Elements',
    mana_cost: '{U}{B}{G}{R}',
    type_line: 'Legendary Creature — Elemental',
    cmc: 4,
    colors: ['U', 'R', 'G'],
    set: null,
    collector_number: null,
    power: '1',
    toughness: '1',
    quantity: 1,
    category: 'main',
  },
  // Main deck fillers — Scryfall resolves all these by name too, so
  // even bad/missing ids fall back gracefully.
  ...[
    'Sol Ring',
    'Arcane Signet',
    'Command Tower',
    'Cultivate',
    'Kodama\'s Reach',
    'Rhystic Study',
    'Mystic Remora',
    'Counterspell',
    'Swords to Plowshares',
    'Lightning Bolt',
    'Brainstorm',
    'Ponder',
    'Sensei\'s Divining Top',
    'Path to Exile',
    'Cyclonic Rift',
    'Beast Whisperer',
    'Eternal Witness',
    'Birds of Paradise',
    'Elvish Mystic',
    'Llanowar Elves',
    'Forest',
    'Island',
    'Mountain',
    'Steam Vents',
    'Stomping Ground',
    'Breeding Pool',
    'Wooded Foothills',
    'Scalding Tarn',
    'Misty Rainforest',
    'Yavimaya Coast',
    'Sulfur Falls',
    'Rootbound Crag',
    'Shivan Reef',
    'Prismatic Vista',
    'Chromatic Orrery',
    'Panharmonicon',
    'Deadeye Navigator',
    'Peregrine Drake',
    'Cloud of Faeries',
    'Fblthp, the Lost',
  ].map(
    (name, i): DeckCard => ({
      id: `main-${i}`,
      card_scryfall_id: `mock-${i}`,
      name,
      mana_cost: null,
      type_line: null,
      cmc: null,
      colors: [],
      set: null,
      collector_number: null,
      power: null,
      toughness: null,
      quantity: 1,
      category: 'main',
    }),
  ),
];

function GameBoardCell({ cell, totalPlayers }: GameBoardCellProps) {
  const gameId = useGameId();
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  // Store handle for reading snapshots inside async wire callbacks
  // (rollback closures need the pre-change state; `useAppSelector`
  // can't be called from inside an event handler). Only used by the
  // optimistic-update flows below — never called for reactive reads,
  // which stay on `useAppSelector`.
  const store = useStore<RootState>();

  const cellInfo = useMemo(
    () => ({ playerId: cell.playerId, mirrored: cell.mirrored, isLocal: cell.isLocal }),
    [cell.playerId, cell.mirrored, cell.isLocal],
  );

  // --- Real Cockatrice reads (identity + life + active turn). Selectors
  // return undefined when the player hasn't hydrated in Redux yet — the
  // downstream memos handle that transient by leaving lifeControl /
  // zoneCounts undefined and PlayerBox falls back to local mock state.
  const realPlayer = useAppSelector((state) =>
    gameId != null
      ? games.Selectors.getPlayer(state, gameId, cell.playerId)
      : undefined,
  );
  const countersMap = useAppSelector((state) =>
    gameId != null
      ? games.Selectors.getCounters(state, gameId, cell.playerId)
      : undefined,
  );
  const activePlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePlayerId(state, gameId) : undefined,
  );
  // Every seated player at the table (including self). Used to enumerate
  // reveal/lend targets in the library context menu — filtered to
  // "others only" in the memo below since Cockatrice's Reveal-library
  // submenu excludes the current player (library_menu.cpp:271-273).
  const allSeatedPlayers = useAppSelector((state) =>
    gameId != null ? games.Selectors.getSeatedPlayers(state, gameId) : undefined,
  );
  const revealTargets = useMemo(
    () =>
      (allSeatedPlayers ?? [])
        .filter((p) => p.properties.playerId !== cell.playerId)
        .map((p) => ({
          playerId: p.properties.playerId,
          name:
            p.properties.userInfo?.name ??
            `Player ${p.properties.playerId}`,
        })),
    [allSeatedPlayers, cell.playerId],
  );

  const lifeCounter = useMemo(
    () =>
      countersMap
        ? Object.values(countersMap).find(isLifeCounter)
        : undefined,
    [countersMap],
  );

  // Mana counters. Servatrice pre-creates counters 1-7 with wire names
  // "w"/"u"/"b"/"r"/"g"/"x"/"storm" (see `server_player.cpp:96-102`),
  // so they always exist as soon as the player is seated. We look them
  // up by internal name and expose an id+count per pool color for
  // PlayerBox to render + click-modify. The 7th ("storm") is labeled
  // "Other" in the Cockatrice desktop UI — we use 'O' as its symbol
  // to match, tinted orange like desktop's makeColor(255,150,30).
  const manaCounters = useMemo(() => {
    if (!countersMap) return undefined;
    const byWireName: Record<string, 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O'> = {
      w: 'W',
      u: 'U',
      b: 'B',
      r: 'R',
      g: 'G',
      x: 'C',
      storm: 'O',
    };
    const out: Partial<
      Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O', { id: number; count: number }>
    > = {};
    for (const c of Object.values(countersMap)) {
      const symbol = byWireName[c.name.trim().toLowerCase()];
      if (symbol) out[symbol] = { id: c.id, count: c.count };
    }
    return out;
  }, [countersMap]);

  // Fire `Command_IncCounter` with a signed delta. Left-click on a
  // mana pip → +1, right-click → -1. Only wire for the local player;
  // opponents' pips are display-only.
  const onModifyCounter = useMemo(() => {
    if (gameId == null) return undefined;
    return (counterId: number, delta: number) => {
      webClient.request.game.incCounter(gameId, { counterId, delta });
    };
  }, [gameId, webClient]);
  // "Untap all permanents" — same wire the phase-tracker's untap-step
  // double-click fires (usePhaseBar.ts:41-51). One Command_SetCardAttr
  // with cardId=-1 tells Servatrice to untap every card in TABLE
  // while respecting per-card `doesntUntap` flags server-side.
  const onUntapAll = useMemo(() => {
    if (gameId == null) return undefined;
    return () => {
      webClient.request.game.setCardAttr(gameId, {
        zone: ZoneName.TABLE,
        cardId: -1,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      });
    };
  }, [gameId, webClient]);
  // "Flip coin" — Cockatrice models a coin flip as a d2 roll
  // (player_actions.cpp:866-872). Server broadcasts Event_RollDie and
  // the chat log renders the outcome.
  const onFlipCoin = useMemo(() => {
    if (gameId == null) return undefined;
    return () => {
      webClient.request.game.rollDie(gameId, { sides: 2, count: 1 });
    };
  }, [gameId, webClient]);
  // Absolute-value variant — fires `Command_SetCounter` for the
  // mana pool's "Set counter..." rows. Server clamps to
  // [0, MAX_COUNTER_VALUE] so callers can pass raw sums.
  const onSetPlayerCounter = useMemo(() => {
    if (gameId == null) return undefined;
    return (counterId: number, value: number) => {
      webClient.request.game.setCounter(gameId, { counterId, value });
    };
  }, [gameId, webClient]);
  // Batched set-card-counter — packs every entry into one
  // CommandContainer via bulkSetCardCounterEntries. Powers the
  // "Increment all card counters" flow; the whole increment ships
  // atomically like Cockatrice's actIncrementAllCardCounters
  // (player_actions.cpp:1618-1620). Only ever fires against this
  // player's own battlefield (TABLE zone) — cross-player card
  // counters aren't in scope for the current wiring.
  const onBulkSetCardCounters = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    const owner = cell.playerId;
    return (
      entries: readonly {
        cardId: number;
        counterId: number;
        value: number;
      }[],
    ) => {
      if (entries.length === 0) return;
      webClient.request.game.bulkSetCardCounterEntries(
        gameId,
        entries.map((e) => ({
          ownerPlayerId: owner,
          zone: ZoneName.TABLE,
          cardId: e.cardId,
          counterId: e.counterId,
          counterValue: e.value,
        })),
      );
    };
  }, [gameId, webClient, cell.playerId]);

  const realName = realPlayer?.properties.userInfo?.name;
  const isActive = realPlayer != null && cell.playerId === activePlayerId;

  // Room-member shape the ported PlayerBox expects. Uses the real
  // display name when available; the "You" / "Player N" fallback
  // covers the transient window before the player's userInfo has
  // hydrated in Redux.
  const playerForBox = useMemo<RoomMemberWithProfile>(
    () => ({
      user_id: String(cell.playerId),
      profile: {
        id: String(cell.playerId),
        display_name:
          realName ?? (cell.isLocal ? 'You' : `Player ${cell.playerId}`),
        username: realName ?? (cell.isLocal ? 'you' : `player-${cell.playerId}`),
        avatar_url: null,
      },
    }),
    [cell.playerId, cell.isLocal, realName],
  );

  // Controlled life — only for real players. `incCounter` sends a
  // delta; `setCounter` sends an absolute value. Both round-trip
  // through the server, so the displayed life updates when the
  // server broadcasts the new counter value.
  const lifeControl = useMemo(() => {
    if (gameId == null || !lifeCounter) return undefined;
    return {
      // ServerInfo_Counter stores the current amount in `count`
      // (the reducer copies `Event_SetCounter.value` → `counter.count`).
      value: lifeCounter.count,
      onDelta: (delta: number) => {
        webClient.request.game.incCounter(gameId, {
          counterId: lifeCounter.id,
          delta,
        });
      },
      onSet: (value: number) => {
        webClient.request.game.setCounter(gameId, {
          counterId: lifeCounter.id,
          value,
        });
      },
    };
  }, [gameId, lifeCounter, webClient]);

  // Slice 2a: read the server-authoritative card counts for the three
  // pile-visualized zones. `cardCount` is the wire-authoritative total
  // (hidden zones like the library expose it even when `order` is
  // empty). Undefined for zones that haven't been created yet — the
  // PlayerBox falls back to its local mock zone lengths in that case.
  const zoneCounts = useMemo(
    () =>
      realPlayer
        ? {
            deck: realPlayer.zones[ZoneName.DECK]?.cardCount,
            grave: realPlayer.zones[ZoneName.GRAVE]?.cardCount,
            rfg: realPlayer.zones[ZoneName.EXILE]?.cardCount,
            hand: realPlayer.zones[ZoneName.HAND]?.cardCount,
          }
        : undefined,
    [realPlayer],
  );

  // Slice 2c: read the server-authoritative graveyard/exile card
  // lists. These are PublicZones so every card carries its full
  // `name` + `providerId` (Scryfall id when the server has one), and
  // the reducer's `cardMovedBetweenZones` push order matches the
  // in-zone order (last = top of pile). PlayerBox reads the last
  // entry for its pile-visualization art, so cards played by
  // opponents show their real face — not a stale local mock. Select
  // the zone object (stable Redux reference) and derive the
  // HandCard[] shape in a useMemo so a new array only gets built
  // when the zone itself changes.
  const graveZone = realPlayer?.zones[ZoneName.GRAVE];
  const exileZone = realPlayer?.zones[ZoneName.EXILE];
  const sideboardZone = realPlayer?.zones[ZoneName.SIDEBOARD];
  const graveCards = useMemo<HandCard[]>(
    () => zoneToHandCards(graveZone),
    [graveZone],
  );
  const exileCards = useMemo<HandCard[]>(
    () => zoneToHandCards(exileZone),
    [exileZone],
  );
  // Sideboard is a HiddenZone — Servatrice only sends cardCount in
  // the initial state (server_cardzone.cpp:343-361, `zonesSelfCanSee`
  // is false for HiddenZone). Same pattern as View library: fire
  // Command_DumpZone(zone=SIDEBOARD, numberCards=-1) on open and read
  // the response from `sideboardZone.revealedCards`; clear the snapshot
  // on close so re-opening always re-dumps fresh.
  const sideboardCards = useMemo<HandCard[]>(
    () => revealedCardsToHandCards(sideboardZone?.revealedCards),
    [sideboardZone?.revealedCards],
  );

  // Slice 2b: read the local player's own hand cards from Redux.
  // Hand is a PrivateZone so contents only land in the owner's
  // client state — opponent cells get an empty array (their count
  // comes through zoneCounts.hand). PlayerBox uses this for the
  // face-up hand render on the self seat and as the drag payload
  // for hand-source drops (real numeric ids flow to Command_MoveCard).
  const handZone = realPlayer?.zones[ZoneName.HAND];
  const handCards = useMemo<HandCard[]>(
    () => zoneToHandCards(handZone),
    [handZone],
  );

  // Revealed cards from the DECK zone — populated by Response_DumpZone
  // when the local player asks to view top/bottom N cards of their
  // library. Passed to PlayerBox so its "View top cards" dialog can
  // render actual server data instead of the local mock deck.
  const deckZone = realPlayer?.zones[ZoneName.DECK];
  const revealedDeckCards = useMemo<HandCard[]>(
    () => revealedCardsToHandCards(deckZone?.revealedCards),
    [deckZone],
  );
  // "Always reveal top card" / "Always look at top card" state for
  // this player's DECK, plus the currently-known top card (if any).
  // Populated by the cardsRevealed reducer from Servatrice's auto-
  // reveal (revealTopCardIfNeeded, server_abstract_player.cpp:553-580).
  const alwaysRevealTopCard = deckZone?.alwaysRevealTopCard ?? false;
  const alwaysLookAtTopCard = deckZone?.alwaysLookAtTopCard ?? false;
  const deckTopCard = useMemo<{ name: string; scryfallId: string } | null>(
    () => {
      const c = deckZone?.topRevealedCard;
      if (!c) return null;
      return { name: c.name, scryfallId: c.providerId };
    },
    [deckZone],
  );

  // Slice 2d: read the battlefield (TABLE) zone from Redux. PublicZone
  // so all players see every card's face, position, and tapped state.
  // Each cell renders its own player's board — no cross-player merging.
  const tableZone = realPlayer?.zones[ZoneName.TABLE];
  const battlefieldCards = useMemo<BattlefieldCard[]>(
    () => zoneToBattlefieldCards(tableZone),
    [tableZone],
  );

  // Slice 2e: read stack cards from Redux. PublicZone — visible to
  // all players. Order runs bottom → top matching the reducer's
  // push convention (last-in resolves first in MTG).
  const stackZone = realPlayer?.zones[ZoneName.STACK];
  const stackCards = useMemo<HandCard[]>(
    () => zoneToHandCards(stackZone),
    [stackZone],
  );

  // Prefer the deck the local player picked in the lobby (dev tool via
  // mockDeckStore). Falls back to the hard-coded MOCK_DECK when nothing
  // has been picked yet — first-open, or after a fresh clear.
  const cards = useMemo<DeckCard[]>(
    () => getPickedMockDeck() ?? MOCK_DECK,
    [],
  );

  // Slice 3a: wire library-source drag-drops. When PlayerBox drops a
  // library card into another zone, it calls this instead of splicing
  // local mock state. Optimistic: the client dispatches the move
  // locally BEFORE the server's Event_MoveCard arrives, so drags feel
  // instant. If the server rejects, `onError` rolls the card back to
  // its snapshotted source zone. The listener middleware consumes the
  // pending marker when the server echo arrives:
  //   • cardMovedInSameZone (hand/stack/grave/exile reorder): idempotent,
  //     re-dispatched safely
  //   • cardMovedBetweenZones (cross-zone AND battlefield-same-zone):
  //     NOT idempotent, listener skips the second dispatch entirely
  const onMoveCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (baseParams: MoveCardParams) => {
      // Resolve the stack sub-slot at the drop site using the target
      // player's battlefield state from Redux — works for our own
      // battlefield AND for gifts onto an opponent's board. PlayerBox
      // only has visibility into the local seat's zones, so it can't
      // do this cross-seat resolution itself. Without this, opponent
      // gifts always land at sub-slot 0 and only settle into the true
      // sub-slot when Servatrice's echo arrives.
      let params = baseParams;
      if (baseParams.targetZone === ZoneName.TABLE) {
        const requestedCol = Math.floor(baseParams.x / 3);
        const row = baseParams.y;
        const targetBattlefield = games.Selectors.getZone(
          store.getState(),
          gameId,
          baseParams.targetPlayerId,
          ZoneName.TABLE,
        );
        if (targetBattlefield) {
          const excludeIds = new Set(
            (baseParams.cardsToMove?.card ?? []).map((c) => c.cardId),
          );
          const sameZoneSource =
            baseParams.startPlayerId === baseParams.targetPlayerId &&
            baseParams.startZone === ZoneName.TABLE;
          // Map col → Set<occupied sub-slots> for the whole row, so
          // overflow can walk to neighboring columns without rescanning.
          const occupiedByCol = new Map<number, Set<number>>();
          for (const id of targetBattlefield.order) {
            if (sameZoneSource && excludeIds.has(id)) {
              continue;
            }
            const c = targetBattlefield.byId[id];
            if (!c || c.y !== row) {
              continue;
            }
            const c_col = Math.floor(c.x / 3);
            let slots = occupiedByCol.get(c_col);
            if (!slots) {
              slots = new Set();
              occupiedByCol.set(c_col, slots);
            }
            slots.add(c.x % 3);
          }
          const freeSubSlotAt = (c: number): number | null => {
            const slots = occupiedByCol.get(c);
            if (!slots) {
              return 0;
            }
            for (let sub = 0; sub < 3; sub++) {
              if (!slots.has(sub)) {
                return sub;
              }
            }
            return null;
          };
          // Try requested column first; on overflow (3 cards already
          // stacked there), walk outward — right first, then left —
          // and take the first neighbor with a free sub-slot. Servatrice
          // doesn't cleanly overflow either, so this mirrors what a
          // human would expect: the card lands as close to the drop as
          // possible instead of quietly stacking on top of another. If
          // the entire row is somehow full (rare — grid is wide) fall
          // back to `col*3` so the wire is legal and the listener's
          // field-patch fallback picks up whatever Servatrice decided.
          let resolvedX = requestedCol * 3;
          const requestedFree = freeSubSlotAt(requestedCol);
          if (requestedFree != null) {
            resolvedX = requestedCol * 3 + requestedFree;
          } else {
            // Walk outward in rings: +1, -1, +2, -2, ...
            let found = false;
            for (let step = 1; step < 32 && !found; step++) {
              for (const dir of [1, -1]) {
                const c = requestedCol + step * dir;
                if (c < 0) {
                  continue;
                }
                const free = freeSubSlotAt(c);
                if (free != null) {
                  resolvedX = c * 3 + free;
                  found = true;
                  break;
                }
              }
            }
          }
          params = { ...baseParams, x: resolvedX };
        }
      }

      const {
        startPlayerId, startZone, cardsToMove,
        targetPlayerId, targetZone, x, y,
      } = params;

      // HiddenZone sources (library, sideboard) address cards
      // positionally, not by real card id — those need the server to
      // hand us the true identity in Event_MoveCard. Skip the
      // optimistic path for them; they'll wait for the server as
      // before. Same for the batch case where cardsToMove is empty.
      const cardIdsFromParams = cardsToMove?.card ?? [];
      const isHiddenSource =
        startZone === ZoneName.DECK || startZone === ZoneName.SIDEBOARD;
      const canGoOptimistic =
        !isHiddenSource && cardIdsFromParams.length === 1;

      if (!canGoOptimistic) {
        webClient.request.game.moveCard(gameId, params);
        return;
      }

      const cardId = cardIdsFromParams[0].cardId;
      const sourceZoneEntry = games.Selectors.getZone(
        store.getState(),
        gameId,
        startPlayerId,
        startZone,
      );
      const sourceCard = sourceZoneEntry?.byId[cardId];
      const sourceIndex = sourceZoneEntry?.order.indexOf(cardId) ?? -1;

      // Missing snapshot (card not in Redux yet, or in a foreign zone
      // we can't read) → fall back to the wait-for-server path.
      if (!sourceCard || sourceIndex < 0) {
        webClient.request.game.moveCard(gameId, params);
        return;
      }

      // Tokens (destroyOnZoneChange=true) get an Event_DestroyCard
      // from the server when they leave the battlefield, NOT an
      // Event_MoveCard. If we optimistically dispatched
      // cardMovedBetweenZones(TABLE→GRAVE) here, the token would
      // land in the graveyard visually — and then the incoming
      // destroy event would look for it in TABLE, find nothing, and
      // no-op, leaving the token stuck in GRAVE. Skip the optimistic
      // path for those; the server round-trip briefly delays the
      // token's vanish but the correctness is worth it.
      const leavingBattlefield =
        startZone === ZoneName.TABLE && targetZone !== ZoneName.TABLE;
      if (sourceCard.destroyOnZoneChange && leavingBattlefield) {
        webClient.request.game.moveCard(gameId, params);
        return;
      }

      const sameZone =
        startPlayerId === targetPlayerId && startZone === targetZone;
      const isPositionalReorderZone =
        targetZone === ZoneName.HAND ||
        targetZone === ZoneName.STACK ||
        targetZone === ZoneName.GRAVE ||
        targetZone === ZoneName.EXILE;

      // Optimistic card object — same id, updated x/y for battlefield
      // drops. The listener's own path builds this from the server's
      // Event_MoveCard using cloneWith; we replicate the shape here.
      const optimisticCard = { ...sourceCard, x, y };
      const opKey = games.moveOpKey(startPlayerId, cardId);

      if (sameZone && isPositionalReorderZone) {
        // Same-zone reorder in a positional zone → cardMovedInSameZone.
        // Idempotent; server echo will re-apply harmlessly.
        dispatch(games.Actions.cardMovedInSameZone({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          cardId,
          toIndex: x,
          card: optimisticCard,
        }));
        games.beginOptimistic(opKey, () => {
          // Rollback: put the card back at its original index.
          dispatch(games.Actions.cardMovedInSameZone({
            gameId,
            playerId: startPlayerId,
            zoneName: startZone,
            cardId,
            toIndex: sourceIndex,
            card: sourceCard,
          }));
        });
      } else {
        // Cross-zone move OR battlefield same-zone re-slot →
        // cardMovedBetweenZones. Listener dedup skips the echo so the
        // reducer isn't double-applied (cardCount + duplicate order).
        dispatch(games.Actions.cardMovedBetweenZones({
          gameId,
          fromPlayerId: startPlayerId,
          fromZone: startZone,
          fromCardId: cardId,
          toPlayerId: targetPlayerId,
          toZone: targetZone,
          card: optimisticCard,
        }));
        games.beginOptimistic(opKey, () => {
          // Rollback: reverse the move (target → source with the
          // pre-move card snapshot).
          dispatch(games.Actions.cardMovedBetweenZones({
            gameId,
            fromPlayerId: targetPlayerId,
            fromZone: targetZone,
            fromCardId: cardId,
            toPlayerId: startPlayerId,
            toZone: startZone,
            card: sourceCard,
          }));
        });
      }

      webClient.request.game.moveCard(gameId, params, undefined, {
        onError: (responseCode) => {
          console.warn(
            `Command_MoveCard rejected with code ${responseCode}; rolling back cardId ${cardId}`,
          );
          games.rollbackOptimistic(opKey);
        },
      });
    };
  }, [gameId, webClient, dispatch, store]);

  // Library-management wires. PlayerBox fires these when the player
  // hits Draw/Mulligan/Shuffle in the library context menu (or the
  // Ctrl+D/M/S shortcuts) alongside its local mock mutation. The
  // server broadcasts the resulting card moves back; the reducer
  // updates `hand.byId` and `deck.cardCount`, and the wired
  // `handCards` / `zoneCounts.hand` props re-read them. Undefined
  // during the pre-hydration transient before the game id is known.
  const onDrawCards = useMemo(() => {
    if (gameId == null) return undefined;
    return (number: number) => {
      webClient.request.game.drawCards(gameId, { number });
    };
  }, [gameId, webClient]);
  const onMulligan = useMemo(() => {
    if (gameId == null) return undefined;
    return (number: number) => {
      webClient.request.game.mulligan(gameId, { number });
    };
  }, [gameId, webClient]);
  // Cockatrice's `Command_UndoDraw` has no payload — server pops the
  // most-recently-drawn card back onto the top of the library.
  // Mirrors `PlayerActions::actUndoDraw` (player_actions.cpp:371-374).
  const onUndoDraw = useMemo(() => {
    if (gameId == null) return undefined;
    return () => {
      webClient.request.game.undoDraw(gameId);
    };
  }, [gameId, webClient]);
  // "View top / bottom N cards of library" wire — dumps a slice of the
  // DECK zone and stores the result in `zone.revealedCards`. Mirrors
  // Cockatrice's `actViewTopCards` / `actViewBottomCards`
  // (player_actions.cpp:182-197) which emit `requestZoneViewToggle`
  // with a `numberCards` and reversed flag; server sends
  // `Response_DumpZone` back and datatrice's listener writes it into
  // `revealedCards`.
  const onDumpTopCards = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    return (numberCards: number, isReversed: boolean) => {
      webClient.request.game.dumpZone(gameId, {
        playerId: cell.playerId,
        zoneName: ZoneName.DECK,
        numberCards,
        isReversed,
      });
    };
  }, [gameId, webClient, cell.playerId]);
  // Clears the `revealedCards` snapshot after the view dialog closes,
  // so re-opening always re-dumps fresh. Matches Cockatrice's
  // `zoneViewCleared` broadcast on `handleCloseZoneView`.
  const onClearRevealedDeck = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    return () => {
      dispatch(
        games.Actions.zoneViewCleared({
          gameId,
          playerId: cell.playerId,
          zoneName: ZoneName.DECK,
        }),
      );
    };
  }, [gameId, dispatch, cell.playerId]);
  // "View sideboard" wire — sideboard is a HiddenZone so we dump it
  // the same way as View library. numberCards=-1 requests the whole
  // pile. Response populates `sideboardZone.revealedCards` which the
  // sideboard modal reads. Clear on close so the next open re-dumps.
  const onDumpSideboard = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    return () => {
      webClient.request.game.dumpZone(gameId, {
        playerId: cell.playerId,
        zoneName: ZoneName.SIDEBOARD,
        numberCards: -1,
        isReversed: false,
      });
    };
  }, [gameId, webClient, cell.playerId]);
  const onClearRevealedSideboard = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    return () => {
      dispatch(
        games.Actions.zoneViewCleared({
          gameId,
          playerId: cell.playerId,
          zoneName: ZoneName.SIDEBOARD,
        }),
      );
    };
  }, [gameId, dispatch, cell.playerId]);
  const onShuffle = useMemo(() => {
    if (gameId == null) return undefined;
    return () => {
      webClient.request.game.shuffle(gameId, {
        zoneName: ZoneName.DECK,
        start: 0,
        end: -1,
      });
    };
  }, [gameId, webClient]);
  // "Shuffle top N" / "Shuffle bottom N" — Cockatrice's Command_Shuffle
  // accepts inclusive [start, end] positions; negative indices count
  // from the end. Top uses `[0, N-1]`, bottom uses `[-N, -1]`
  // (player_actions.cpp:267-268, 298-299). The full-shuffle `onShuffle`
  // wire above stays as its own convenience — that's the F5 flow and
  // reads cleaner as a nullary call.
  const onShuffleRange = useMemo(() => {
    if (gameId == null) return undefined;
    return (start: number, end: number) => {
      webClient.request.game.shuffle(gameId, {
        zoneName: ZoneName.DECK,
        start,
        end,
      });
    };
  }, [gameId, webClient]);

  // "Open deck in deck editor" — webatrice-specific divergence from
  // Cockatrice desktop. Cockatrice's version reconstructs the deck
  // in-app from the game state; we don't own an in-place editor here,
  // so we route to the same `/deck/:deckId` page a My Decks row-click
  // opens. Requires the deck to already be saved to Servatrice under
  // this user's account — the menu item disables when we can't find a
  // matching row (foreign deck, .cod-upload path, or backendDecks not
  // yet fetched). Match strategy: parse the game's `<deckname>` from
  // `player.deckList` (the server-broadcast raw XML) and look up the
  // FIRST My Deck with that name. Name is a stable enough identifier
  // for the common case (each user's own deck saved once); the
  // proper deckHash algorithm (SHA1 → base32, deck_list_node_tree.cpp:73)
  // would be more correct but requires hashing every candidate — a
  // trade-off we're not paying for right now. Gated to isLocal so the
  // fetch and parse only run for the local player's own cell.
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  useEffect(() => {
    if (cell.isLocal && isConnected && !backendDecks) {
      webClient.request.session.deckList();
    }
  }, [cell.isLocal, isConnected, backendDecks, webClient]);
  const gameDeckName = useMemo<string | null>(() => {
    if (!cell.isLocal) return null;
    const xml = realPlayer?.deckList;
    if (!xml) return null;
    try {
      return parseCod(xml).name || null;
    } catch {
      return null;
    }
  }, [cell.isLocal, realPlayer?.deckList]);
  const openDeckInEditorDeckId = useMemo<number | null>(() => {
    if (!cell.isLocal || !gameDeckName || !backendDecks) return null;
    const rows = flattenBackendDecks(backendDecks.root);
    const target = gameDeckName.trim().toLowerCase();
    const match = rows.find((r) => r.name.trim().toLowerCase() === target);
    return match?.id ?? null;
  }, [cell.isLocal, gameDeckName, backendDecks]);
  const navigate = useNavigate();
  const onOpenDeckInEditor = useMemo(() => {
    if (openDeckInEditorDeckId == null) return undefined;
    return () => {
      navigate(
        generatePath(RouteEnum.DECK, {
          deckId: String(openDeckInEditorDeckId),
        }),
      );
    };
  }, [openDeckInEditorDeckId, navigate]);

  // "Reveal library to..." — dispatches Command_RevealCards with the
  // full deck (no cardId list, no topCards). For a specific target,
  // set player_id; for "All players" (targetPlayerId === -1), OMIT
  // player_id entirely — Servatrice checks proto2 field presence via
  // has_player_id() (server_abstract_player.cpp:1476) and treats an
  // explicit -1 as "look up player -1" → RespNameNotFound (silent
  // reject). Mirrors Cockatrice's PlayerActions::actRevealLibrary
  // (player_actions.cpp:1712-1721).
  const onRevealLibrary = useMemo(() => {
    if (gameId == null) return undefined;
    return (targetPlayerId: number) => {
      const params = { zoneName: ZoneName.DECK };
      if (targetPlayerId !== -1) {
        (params as { zoneName: string; playerId?: number }).playerId =
          targetPlayerId;
      }
      webClient.request.game.revealCards(gameId, params);
    };
  }, [gameId, webClient]);
  // Zone-agnostic reveal — same wire as onRevealLibrary but the source
  // zone is a parameter. Powers the battlefield menu's "Reveal hand
  // to..." submenu. `targetPlayerId === -1` reveals to every player
  // and omits `playerId` from the wire (proto2 field presence trap —
  // same reason as reveal-library above).
  const onRevealZone = useMemo(() => {
    if (gameId == null) return undefined;
    return (zoneName: string, targetPlayerId: number) => {
      const params: { zoneName: string; playerId?: number } = { zoneName };
      if (targetPlayerId !== -1) params.playerId = targetPlayerId;
      webClient.request.game.revealCards(gameId, params);
    };
  }, [gameId, webClient]);
  // "Reveal random card to..." for the graveyard — fires the same
  // Command_RevealCards wire but with card_id=[-2] as a sentinel.
  // Servatrice recognises this exact single-element `card_id`
  // (server_abstract_player.cpp:1498-1508: "If there is a single
  // card_id with value -2, pick a random card") and picks a random
  // entry from the zone. Same proto2 field-presence trap as reveal-
  // library: "All players" → OMIT playerId; otherwise set it.
  // Mirrors PlayerActions::actRevealRandomGraveyardCard
  // (player_actions.cpp:1750-1758) which sends
  // `card_id.add(RANDOM_CARD_FROM_ZONE)` — RANDOM_CARD_FROM_ZONE = -2
  // (player_actions.h:42).
  const RANDOM_CARD_FROM_ZONE = -2;
  const onRevealRandomFromZone = useMemo(() => {
    if (gameId == null) return undefined;
    return (zoneName: string, targetPlayerId: number) => {
      const params: {
        zoneName: string;
        cardId: number[];
        playerId?: number;
      } = { zoneName, cardId: [RANDOM_CARD_FROM_ZONE] };
      if (targetPlayerId !== -1) {
        params.playerId = targetPlayerId;
      }
      webClient.request.game.revealCards(gameId, params);
    };
  }, [gameId, webClient]);
  // "Lend library to..." — same command as reveal, but with
  // grant_write_access=true so Servatrice adds the target to the
  // zone's playersWithWritePermission set (server_abstract_player.cpp:1566).
  // Target then passes cmdMoveCard's `startZone->getPlayersWithWritePermission()`
  // check (:779) and can move cards from the lent deck to their OWN
  // zones or reorder within the lent deck. Permission persists until
  // ANY shuffle of the zone clears it (server_cardzone.cpp:72) —
  // Cockatrice has no explicit "un-lend". Never called with -1 (the
  // PlayerBox menu doesn't offer it), so player_id is always set.
  // Mirrors PlayerActions::actLendLibrary (player_actions.cpp:1723-1733).
  const onLendLibrary = useMemo(() => {
    if (gameId == null) return undefined;
    return (targetPlayerId: number) => {
      webClient.request.game.revealCards(gameId, {
        zoneName: ZoneName.DECK,
        playerId: targetPlayerId,
        grantWriteAccess: true,
      });
    };
  }, [gameId, webClient]);
  // "Reveal top cards to..." — dispatches Command_RevealCards with
  // top_cards set to the picked count. Server iterates deck positions
  // 0..top_cards-1 (server_abstract_player.cpp:1488-1495) and sends
  // full card details to the target / originator, count-only summary
  // to spectators. `card_id: [0]` is a backward-compat sentinel
  // Cockatrice desktop sends (player_actions.cpp:1745) — old clients
  // that ignore top_cards fall back on the card_id list. Handles the
  // same proto2 field-presence trap as reveal-library: -1 means "All
  // players" → OMIT player_id entirely (Servatrice's has_player_id
  // check at server_abstract_player.cpp:1476).
  const onRevealTopCards = useMemo(() => {
    if (gameId == null) return undefined;
    return (targetPlayerId: number, count: number) => {
      const params: {
        zoneName: string;
        topCards: number;
        cardId: number[];
        playerId?: number;
      } = {
        zoneName: ZoneName.DECK,
        topCards: count,
        cardId: [0],
      };
      if (targetPlayerId !== -1) {
        params.playerId = targetPlayerId;
      }
      webClient.request.game.revealCards(gameId, params);
    };
  }, [gameId, webClient]);
  // "Always reveal top card" / "Always look at top card" toggles.
  // Fire Command_ChangeZoneProperties with the picked flag set. Server
  // broadcasts Event_ChangeZoneProperties back (zonePropertiesChanged
  // reducer flips the zone flag) and immediately re-emits
  // Event_RevealCards via revealTopCardIfNeeded so the top-card face
  // populates on the pile (broadcast for always-reveal, private to
  // owner for always-look-at). Mirrors PlayerActions::actAlwaysReveal /
  // actAlwaysLookAt (player_actions.cpp:199-215).
  const onSetAlwaysRevealTopCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (value: boolean) => {
      webClient.request.game.changeZoneProperties(gameId, {
        zoneName: ZoneName.DECK,
        alwaysRevealTopCard: value,
      });
    };
  }, [gameId, webClient]);
  const onSetAlwaysLookAtTopCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (value: boolean) => {
      webClient.request.game.changeZoneProperties(gameId, {
        zoneName: ZoneName.DECK,
        alwaysLookAtTopCard: value,
      });
    };
  }, [gameId, webClient]);

  // Tap/untap battlefield cards. Cockatrice's protocol addresses one
  // card per Command_SetCardAttr (or cardId=-1 for "all in zone"), so
  // a group tap dispatches one command per card. Optimistic: the
  // client flips `tapped` locally BEFORE the server's Event_SetCardAttr
  // arrives, so the rotation animation fires without waiting on the
  // network round-trip. If the server rejects (RespFunctionNotAllowed
  // etc.), the `onError` callback rolls back to the snapshotted
  // previous value. The listener middleware consumes the pending
  // marker when the server's echo arrives; cardFieldsUpdated is
  // idempotent so the second dispatch is a no-op.
  const onSetCardTapped = useMemo(() => {
    if (gameId == null) return undefined;
    return (cardIds: number[], tapped: boolean) => {
      const attrValue = tapped ? '1' : '0';
      for (const cardId of cardIds) {
        // Snapshot the current tapped value for potential rollback.
        // Missing cards (not in Redux yet) skip the optimistic path
        // entirely and just fire the wire.
        const battlefieldZone = games.Selectors.getZone(
          store.getState(),
          gameId,
          cell.playerId,
          ZoneName.TABLE,
        );
        const currentCard = battlefieldZone?.byId[cardId];
        if (currentCard == null) {
          webClient.request.game.setCardAttr(gameId, {
            zone: ZoneName.TABLE,
            cardId,
            attribute: CardAttribute.AttrTapped,
            attrValue,
          });
          continue;
        }
        const previousTapped = currentCard.tapped;
        // Skip the optimistic dance when the target value already
        // matches — no visual change to make, no rollback risk.
        if (previousTapped === tapped) {
          webClient.request.game.setCardAttr(gameId, {
            zone: ZoneName.TABLE,
            cardId,
            attribute: CardAttribute.AttrTapped,
            attrValue,
          });
          continue;
        }

        // 1) Apply the optimistic change locally.
        dispatch(games.Actions.cardFieldsUpdated({
          gameId,
          playerId: cell.playerId,
          zoneName: ZoneName.TABLE,
          cardId,
          fields: { tapped },
        }));

        // 2) Register the rollback closure.
        const opKey = games.attrOpKey(cell.playerId, cardId, CardAttribute.AttrTapped);
        games.beginOptimistic(opKey, () => {
          dispatch(games.Actions.cardFieldsUpdated({
            gameId,
            playerId: cell.playerId,
            zoneName: ZoneName.TABLE,
            cardId,
            fields: { tapped: previousTapped },
          }));
        });

        // 3) Fire the wire with an onError callback that rolls back.
        webClient.request.game.setCardAttr(
          gameId,
          {
            zone: ZoneName.TABLE,
            cardId,
            attribute: CardAttribute.AttrTapped,
            attrValue,
          },
          undefined,
          {
            onError: (responseCode) => {
              console.warn(
                `Command_SetCardAttr(tapped=${tapped}) rejected with code ${responseCode}; rolling back cardId ${cardId}`,
              );
              games.rollbackOptimistic(opKey);
            },
          },
        );
      }
    };
  }, [gameId, webClient, dispatch, store, cell.playerId]);

  // Flip a battlefield card face-up or face-down via Command_FlipCard.
  // Server broadcasts Event_FlipCard back and the reducer flips
  // `zone.byId[id].faceDown`, which flows through `battlefieldCards`
  // to render the card back on face-down cards.
  const onFlipCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (cardId: number, faceDown: boolean) => {
      webClient.request.game.flipCard(gameId, {
        zone: ZoneName.TABLE,
        cardId,
        faceDown,
      });
    };
  }, [gameId, webClient]);

  // Toggle `AttrDoesntUntap` on a battlefield card via
  // `Command_SetCardAttr`. Server broadcasts `Event_SetCardAttr` and
  // the reducer flips `zone.byId[id].doesntUntap`, which flows through
  // `battlefieldCards` into the highlight state on the card render.
  const onSetCardDoesntUntap = useMemo(() => {
    if (gameId == null) return undefined;
    return (cardId: number, doesntUntap: boolean) => {
      webClient.request.game.setCardAttr(gameId, {
        zone: ZoneName.TABLE,
        cardId,
        attribute: CardAttribute.AttrDoesntUntap,
        attrValue: doesntUntap ? '1' : '0',
      });
    };
  }, [gameId, webClient]);

  // Clone a battlefield card. Mirrors Cockatrice's `cmClone`
  // (`player_actions.cpp:1812`): send `Command_CreateToken` with the
  // source card's identity fields and `destroy_on_zone_change: true`,
  // so the clone behaves like a token — it vanishes if it ever
  // leaves the battlefield. Server picks the column (`x: -1`); the
  // clone lands on the same row (`y`) as its source.
  const onCloneCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (source: {
      name: string;
      providerId: string;
      color: string;
      pt: string;
      annotation: string;
      y: number;
    }) => {
      webClient.request.game.createToken(gameId, {
        zone: ZoneName.TABLE,
        cardName: source.name,
        cardProviderId: source.providerId,
        color: source.color,
        pt: source.pt,
        annotation: source.annotation,
        destroyOnZoneChange: true,
        x: -1,
        y: source.y,
      });
    };
  }, [gameId, webClient]);

  // "Create token..." — mirrors Cockatrice's actCreateToken /
  // actCreateAnotherToken (player_actions.cpp:878-916). Sends
  // Command_CreateToken with x=-1 (server picks a free column) and
  // y = tableRowToGridY(tablerow-from-card-db), so a token lands in
  // the correct row (0=other/top, 1=creatures/middle, 2=lands/bottom).
  // Face-down tokens always land on row 2 (=y 0) regardless of type,
  // matching desktop. tableRow > 2 (stack) folds to creatures/middle
  // per TableZone::tableRowToGridY (table_zone.cpp:409-415). Async
  // Dexie lookup only for the y coord; unknown names default to the
  // top row (visualY=0) so the wire never blocks on a missing card.
  const onCreateToken = useMemo(() => {
    if (gameId == null) {
      return undefined;
    }
    return async (args: {
      name: string;
      color: string;
      pt: string;
      annotation: string;
      destroyOnZoneChange: boolean;
      faceDown: boolean;
      providerId?: string;
      targetCardId?: number;
      targetMode?: 'transform_into' | 'attach_to';
    }) => {
      let visualY = 0;
      if (args.faceDown) {
        // Face-down → tableRow 2 → tableRowToGridY(2) = 0.
        visualY = 0;
      } else {
        const meta = await CardDTO.get(args.name).catch(() => undefined);
        const tablerowRaw = meta?.tablerow?.value;
        const tablerow =
          tablerowRaw != null && /^\d+$/.test(tablerowRaw) ? Number(tablerowRaw) : null;
        // tableRow > 2 folds to 1 (creatures); unknown defaults to
        // top row like playCardViaTableRow does.
        const clampedTableRow =
          tablerow === 0 || tablerow === 1 || tablerow === 2
            ? tablerow
            : tablerow != null && tablerow > 2
              ? 1
              : null;
        visualY = clampedTableRow == null ? 0 : 2 - clampedTableRow;
      }
      // Transform mode: Cockatrice sends target_zone alongside
      // target_card_id + target_mode = TRANSFORM_INTO
      // (player_actions.cpp:1198-1206). Server processes as
      // "replace the source card with the new token."
      const isTransform = args.targetCardId != null && args.targetMode === 'transform_into';
      webClient.request.game.createToken(gameId, {
        zone: ZoneName.TABLE,
        cardName: args.name,
        cardProviderId: args.providerId ?? '',
        color: args.color,
        pt: args.pt,
        annotation: args.annotation,
        destroyOnZoneChange: args.destroyOnZoneChange,
        faceDown: args.faceDown,
        x: -1,
        y: visualY,
        ...(isTransform
          ? {
            targetZone: ZoneName.TABLE,
            targetCardId: args.targetCardId,
            targetMode: Command_CreateToken_TargetMode.TRANSFORM_INTO,
          }
          : {}),
      });
    };
  }, [gameId, webClient]);

  // Set a card's free-form annotation via `Command_SetCardAttr` with
  // `AttrAnnotation`. Empty string clears it. Mirrors Cockatrice's
  // `PlayerActions::actSetAnnotation`.
  const onSetAnnotation = useMemo(() => {
    if (gameId == null) return undefined;
    return (cardId: number, annotation: string) => {
      webClient.request.game.setCardAttr(gameId, {
        zone: ZoneName.TABLE,
        cardId,
        attribute: CardAttribute.AttrAnnotation,
        attrValue: annotation,
      });
    };
  }, [gameId, webClient]);

  // Set per-card power/toughness via `Command_SetCardAttr` with `AttrPT`.
  // PlayerBox computes each card's new PT string (P/T submenu: increase,
  // decrease, flow, set..., reset) using its local card metadata and
  // passes the pre-computed batch through here. Mirrors Cockatrice's
  // `PlayerActions::actIncPT` which packages one command per card into a
  // single game command list.
  const onSetPT = useMemo(() => {
    if (gameId == null) return undefined;
    return (items: { cardId: number; pt: string }[]) => {
      for (const { cardId, pt } of items) {
        webClient.request.game.setCardAttr(gameId, {
          zone: ZoneName.TABLE,
          cardId,
          attribute: CardAttribute.AttrPT,
          attrValue: pt,
        });
      }
    };
  }, [gameId, webClient]);

  // Clear every arrow the LOCAL player created — mirrors Cockatrice's
  // `GameScene::clearArrowsForPlayer` triggered by `TabGame::actRemoveLocalArrows`
  // (bound to Ctrl+R). Arrows are keyed on the creator in Redux via
  // `player.arrows`, so we iterate this player's own arrows and fire one
  // Command_DeleteArrow per id. Opponents' arrows live under their own
  // `player.arrows` maps and are untouched, matching Cockatrice's
  // "local arrows only" scope.
  const onClearOwnArrows = useMemo(() => {
    if (gameId == null) return undefined;
    return () => {
      if (!realPlayer) return;
      for (const arrowId of Object.keys(realPlayer.arrows)) {
        const id = Number(arrowId);
        if (!Number.isFinite(id)) continue;
        webClient.request.game.deleteArrow(gameId, { arrowId: id });
      }
    };
  }, [gameId, webClient, realPlayer]);

  // Resolves the "Attach to card..." card-menu flow. Cockatrice's
  // `ArrowAttachItem::attachCards` (arrow_item.cpp:374-392) sends
  // Command_AttachCard with the source in TABLE zone and the target's
  // player + zone + card id. We assume the source is already on the
  // TABLE (the menu is only reachable from a battlefield card); if the
  // source were in another zone Cockatrice plays it to the table
  // first — that path lives on the pending-arrow flow, not here.
  const onAttachCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (
      sourceCardId: number,
      target: { playerId: number; cardId: number },
    ) => {
      webClient.request.game.attachCard(gameId, {
        startZone: ZoneName.TABLE,
        cardId: sourceCardId,
        targetPlayerId: target.playerId,
        targetZone: ZoneName.TABLE,
        targetCardId: target.cardId,
      });
    };
  }, [gameId, webClient]);

  // Detach a card. Cockatrice's `PlayerActions::actUnattach`
  // (player_actions.cpp:1503-1517) sends `Command_AttachCard` with only
  // `start_zone + card_id` — no target fields — and Servatrice
  // interprets the missing target as "clear this card's attachedTo".
  // Datatrice's `cardAttached` listener already handles the unattach
  // sentinels (empty targetZone → set attachPlayerId=-1 etc.) so the
  // client picks up the state change through the same event.
  const onUnattachCard = useMemo(() => {
    if (gameId == null) return undefined;
    return (sourceCardId: number) => {
      // proto2 field-presence: OMIT the target fields entirely so
      // Servatrice's `has_target_zone()` / `has_target_card_id()` /
      // `has_target_player_id()` return false and the server routes
      // this as an unattach. Passing `-1` / `''` explicitly would
      // MARK the fields as set and the server would treat it as an
      // invalid attach target instead. Matches Cockatrice's
      // `PlayerActions::actUnattach` which only calls set_start_zone
      // and set_card_id.
      webClient.request.game.attachCard(gameId, {
        startZone: ZoneName.TABLE,
        cardId: sourceCardId,
      } as Parameters<typeof webClient.request.game.attachCard>[1]);
    };
  }, [gameId, webClient]);

  // Absolute-set for card counters. Maps 1:1 to
  // `Command_SetCardCounter`. Cockatrice's actAddCardCounter /
  // actRemoveCardCounter both funnel through this too (they read the
  // current value client-side, add ±1, and send the resulting absolute
  // value). We do the same in PlayerBox's onAddCardCounter handler.
  const onSetCardCounter = useMemo(() => {
    if (gameId == null) return undefined;
    return (cardId: number, counterId: number, value: number) => {
      webClient.request.game.setCardCounter(gameId, {
        zone: ZoneName.TABLE,
        cardId,
        counterId,
        counterValue: Math.max(0, value),
      });
    };
  }, [gameId, webClient]);

  // Fires the wire arrow-create command for the "Draw arrow..." card
  // menu flow. Card targets set targetZone + targetCardId; player
  // targets OMIT those two so Servatrice's `has_target_zone()` /
  // `has_target_card_id()` return false and route the arrow to the
  // player anchor (matches the same proto2 trick used by
  // useGameArrowInteractions). Color defaults to red — the menu-driven
  // path doesn't expose modifiers.
  const onCreateArrow = useMemo(() => {
    if (gameId == null || cell.playerId == null) return undefined;
    return (
      sourceCardId: number,
      sourceZone: string,
      target:
        | { kind: 'card'; playerId: number; cardId: number }
        | { kind: 'player'; playerId: number },
    ) => {
      const base = {
        startPlayerId: cell.playerId,
        // Wire zone name from caller — TABLE for battlefield arrows,
        // GRAVE / EXILE when the arrow originates from a pile-view
        // modal. Cockatrice allows arrows FROM any public zone but
        // never TO grave/exile (arrows target battlefield cards or
        // player anchors only, matching ArrowDragItem::mouseReleaseEvent
        // resolution).
        startZone: sourceZone,
        startCardId: sourceCardId,
        targetPlayerId: target.playerId,
        arrowColor: ArrowColor.RED,
      };
      const params =
        target.kind === 'card'
          ? { ...base, targetZone: ZoneName.TABLE, targetCardId: target.cardId }
          : base;
      webClient.request.game.createArrow(gameId, params as Parameters<typeof webClient.request.game.createArrow>[1]);
    };
  }, [gameId, webClient, cell.playerId]);

  return (
    <div
      className={cx('game__board-cell', { 'game__board-cell--mirrored': cell.mirrored })}
      style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
    >
      <BoardCellProvider value={cellInfo}>
        <PlayerBox
          player={playerForBox}
          isSelf={cell.isLocal}
          isActive={isActive}
          handOnTop={cell.mirrored}
          flipHandCardBacks={totalPlayers !== 3}
          cards={cards}
          lifeControl={lifeControl}
          zoneCounts={zoneCounts}
          graveCards={graveCards}
          sideboardCards={sideboardCards}
          onDumpSideboard={onDumpSideboard}
          onClearRevealedSideboard={onClearRevealedSideboard}
          exileCards={exileCards}
          handCards={handCards}
          battlefieldCards={battlefieldCards}
          stackCards={stackCards}
          playerId={cell.playerId}
          onMoveCard={onMoveCard}
          onDrawCards={onDrawCards}
          onMulligan={onMulligan}
          onShuffle={onShuffle}
          onShuffleRange={onShuffleRange}
          onOpenDeckInEditor={onOpenDeckInEditor}
          onRevealRandomFromZone={onRevealRandomFromZone}
          onRevealZone={onRevealZone}
          onUndoDraw={onUndoDraw}
          onDumpTopCards={onDumpTopCards}
          onClearRevealedDeck={onClearRevealedDeck}
          revealedDeckCards={revealedDeckCards}
          revealTargets={revealTargets}
          onRevealLibrary={onRevealLibrary}
          onLendLibrary={onLendLibrary}
          onRevealTopCards={onRevealTopCards}
          alwaysRevealTopCard={alwaysRevealTopCard}
          alwaysLookAtTopCard={alwaysLookAtTopCard}
          onSetAlwaysRevealTopCard={onSetAlwaysRevealTopCard}
          onSetAlwaysLookAtTopCard={onSetAlwaysLookAtTopCard}
          deckTopCard={deckTopCard}
          onSetCardTapped={onSetCardTapped}
          onFlipCard={onFlipCard}
          onSetCardDoesntUntap={onSetCardDoesntUntap}
          onCloneCard={onCloneCard}
          onSetAnnotation={onSetAnnotation}
          onSetPT={onSetPT}
          onClearOwnArrows={onClearOwnArrows}
          onAttachCard={onAttachCard}
          onUnattachCard={onUnattachCard}
          onCreateArrow={onCreateArrow}
          onSetCardCounter={onSetCardCounter}
          manaCounters={manaCounters}
          onModifyCounter={onModifyCounter}
          onSetPlayerCounter={onSetPlayerCounter}
          onBulkSetCardCounters={onBulkSetCardCounters}
          onUntapAll={onUntapAll}
          onFlipCoin={onFlipCoin}
          onCreateToken={onCreateToken}
          drawSeq={realPlayer?.drawSeq ?? 0}
          lastDrawCount={realPlayer?.lastDrawCount ?? 0}
        />
      </BoardCellProvider>
    </div>
  );
}

export default memo(GameBoardCell);
