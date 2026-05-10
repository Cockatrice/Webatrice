import { createSelector } from '@reduxjs/toolkit';
import { App, type Data, type Enriched } from '@app/types';
import { GamesState } from './game.interfaces';

interface State {
  games: GamesState;
}

const EMPTY_ARRAY: Data.ServerInfo_Card[] = [];
const EMPTY_OBJECT = {} as Record<string, never>;
const EMPTY_ATTACHMENTS: ReadonlyMap<number, AttachedChild[]> = new Map();

/**
 * An attached child plus the player whose zone it actually lives in. The
 * server keeps cross-player attachments in the original owner's zone (only
 * the parent pointer crosses player boundaries — see Servatrice
 * `cmdAttachCard`), so a child rendered under an opponent's creature still
 * needs its own owner id for click/drag/arrow plumbing.
 */
export interface AttachedChild {
  card: Data.ServerInfo_Card;
  ownerPlayerId: number;
}

/**
 * Memoized cache for materialized zone card arrays. Keyed by the zone object
 * identity so that repeated selector calls on the same zone reuse the same
 * array reference — this preserves React referential equality and avoids
 * spurious re-renders when `getCards` is called from a selector.
 */
const zoneCardsCache = new WeakMap<Enriched.ZoneEntry, Data.ServerInfo_Card[]>();

function materializeZoneCards(zone: Enriched.ZoneEntry): Data.ServerInfo_Card[] {
  const cached = zoneCardsCache.get(zone);
  if (cached) {
    return cached;
  }
  const arr = zone.order.map(id => zone.byId[id]);
  zoneCardsCache.set(zone, arr);
  return arr;
}

/**
 * Memoized cache for the (parent-owner → parent-card-id → children) lookup.
 * Keyed by the game's `players` map identity. Immer rebuilds that map any
 * time a reducer mutates a nested zone, so this WeakMap entry naturally
 * invalidates whenever a card field changes anywhere in the game.
 *
 * Cross-player attachments are surfaced under the *parent's* owner — that
 * matches Cockatrice's `setAttachedTo` which calls
 * `attachedTo->getZone()->reorganizeCards()` so the child paints next to
 * the parent regardless of which player's table the child lives in.
 */
const attachmentsByParentCache = new WeakMap<
  { [playerId: number]: Enriched.PlayerEntry },
  ReadonlyMap<number, ReadonlyMap<number, AttachedChild[]>>
>();

function materializeAllAttachments(
  players: { [playerId: number]: Enriched.PlayerEntry },
): ReadonlyMap<number, ReadonlyMap<number, AttachedChild[]>> {
  const cached = attachmentsByParentCache.get(players);
  if (cached) {
    return cached;
  }
  const result = new Map<number, Map<number, AttachedChild[]>>();
  // Iterate players in id order so the order children appear in a parent's
  // bucket is deterministic across re-renders, even when two different
  // players have both attached cards onto the same parent.
  const playerIds = Object.keys(players).map(Number).sort((a, b) => a - b);
  for (const ownerPlayerId of playerIds) {
    const tableZone = players[ownerPlayerId]?.zones[App.ZoneName.TABLE];
    if (!tableZone) {
      continue;
    }
    // materializeZoneCards iterates in zone.order — i.e. the order each card
    // entered the zone. Pushing in that order matches Cockatrice's
    // `QListIterator` over `attachedCards`, which yields cards in the order
    // they were added to the parent's child list (table_zone.cpp:172). No
    // explicit sort needed; the bucket is naturally in insertion order.
    for (const card of materializeZoneCards(tableZone)) {
      if (card.attachCardId == null || card.attachCardId === -1) {
        continue;
      }
      if (card.attachZone !== App.ZoneName.TABLE) {
        continue;
      }
      const parentPlayerId = card.attachPlayerId;
      let byParentCard = result.get(parentPlayerId);
      if (!byParentCard) {
        byParentCard = new Map<number, AttachedChild[]>();
        result.set(parentPlayerId, byParentCard);
      }
      let bucket = byParentCard.get(card.attachCardId);
      if (!bucket) {
        bucket = [];
        byParentCard.set(card.attachCardId, bucket);
      }
      bucket.push({ card, ownerPlayerId });
    }
  }
  attachmentsByParentCache.set(players, result);
  return result;
}

export const Selectors = {
  getGames: ({ games }: State): { [gameId: number]: Enriched.GameEntry } => games.games,

  getGame: ({ games }: State, gameId: number): Enriched.GameEntry | undefined => games.games[gameId],

  getPlayers: ({ games }: State, gameId: number): { [playerId: number]: Enriched.PlayerEntry } | undefined =>
    games.games[gameId]?.players,

  getPlayer: ({ games }: State, gameId: number, playerId: number): Enriched.PlayerEntry | undefined =>
    games.games[gameId]?.players[playerId],

  getLocalPlayerId: ({ games }: State, gameId: number): number | undefined =>
    games.games[gameId]?.localPlayerId,

  getLocalPlayer: (state: State, gameId: number): Enriched.PlayerEntry | undefined => {
    const game = state.games.games[gameId];
    if (!game) {
      return undefined;
    }
    return game.players[game.localPlayerId];
  },

  getZones: (
    { games }: State,
    gameId: number,
    playerId: number
  ): { [zoneName: string]: Enriched.ZoneEntry } | undefined =>
    games.games[gameId]?.players[playerId]?.zones,

  getZone: (
    { games }: State,
    gameId: number,
    playerId: number,
    zoneName: string
  ): Enriched.ZoneEntry | undefined => games.games[gameId]?.players[playerId]?.zones[zoneName],

  getCards: ({ games }: State, gameId: number, playerId: number, zoneName: string): Data.ServerInfo_Card[] => {
    const zone = games.games[gameId]?.players[playerId]?.zones[zoneName];
    return zone ? materializeZoneCards(zone) : EMPTY_ARRAY;
  },

  /**
   * Returns attachments parented to cards owned by `parentPlayerId` — i.e.
   * the children that should render nested under that player's battlefield
   * cards. Children may live in a different player's TABLE zone (cross-player
   * attach: your aura on opponent's creature); the selector pulls them in
   * regardless and tags each with its owner via `AttachedChild.ownerPlayerId`.
   */
  getAttachmentsByParent: (
    { games }: State,
    gameId: number,
    parentPlayerId: number,
  ): ReadonlyMap<number, AttachedChild[]> => {
    const game = games.games[gameId];
    if (!game) {
      return EMPTY_ATTACHMENTS;
    }
    const all = materializeAllAttachments(game.players);
    return all.get(parentPlayerId) ?? EMPTY_ATTACHMENTS;
  },

  getCounters: ({ games }: State, gameId: number, playerId: number) =>
    games.games[gameId]?.players[playerId]?.counters ?? EMPTY_OBJECT,

  getArrows: ({ games }: State, gameId: number, playerId: number) =>
    games.games[gameId]?.players[playerId]?.arrows ?? EMPTY_OBJECT,

  getActivePlayerId: ({ games }: State, gameId: number): number | undefined =>
    games.games[gameId]?.activePlayerId,

  getActivePhase: ({ games }: State, gameId: number): number | undefined =>
    games.games[gameId]?.activePhase,

  getHostId: ({ games }: State, gameId: number): number | undefined =>
    games.games[gameId]?.hostId,

  getSecondsElapsed: ({ games }: State, gameId: number): number | undefined =>
    games.games[gameId]?.secondsElapsed,

  getJudge: ({ games }: State, gameId: number): boolean =>
    games.games[gameId]?.judge ?? false,

  getResuming: ({ games }: State, gameId: number): boolean =>
    games.games[gameId]?.resuming ?? false,

  isStarted: ({ games }: State, gameId: number): boolean =>
    games.games[gameId]?.started ?? false,

  isSpectator: ({ games }: State, gameId: number): boolean =>
    games.games[gameId]?.spectator ?? false,

  isReversed: ({ games }: State, gameId: number): boolean =>
    games.games[gameId]?.reversed ?? false,

  getMessages: ({ games }: State, gameId: number) =>
    games.games[gameId]?.messages ?? EMPTY_ARRAY,

  getActiveGameIds: createSelector(
    [({ games }: State) => games.games],
    (games) => Object.keys(games).map(Number)
  ),

  getActiveGames: createSelector(
    [({ games }: State) => games.games],
    (games): Enriched.GameEntry[] => Object.values(games)
  ),
};
