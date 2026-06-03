import { createSelector, lruMemoize } from '@reduxjs/toolkit';
import { dequal } from 'dequal';
import { Enriched } from '../../types';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';

type State = { games: GamesState };

const EMPTY_ARRAY: ServerInfo_Card[] = [];
const EMPTY_OBJECT = {} as Record<string, never>;
const EMPTY_ATTACHMENTS: ReadonlyMap<number, AttachedChild[]> = new Map();
const EMPTY_PLAYERS: Enriched.PlayerEntry[] = [];

// Seated, in-play players in seat (join) order: a port of Cockatrice's
// collectActivePlayers (keep !spectator && !conceded) applied over the stored
// `seatOrder` so callers get a deterministic, server-authoritative ordering
// rather than the numeric-key order of the `players` map. Shared by the board
// layout (seating) and the reveal-target list.
export function seatedPlayersOf(game: Enriched.GameEntry): Enriched.PlayerEntry[] {
  return game.seatOrder
    .map((id) => game.players[id])
    .filter((p) => p != null && !p.properties.spectator && !p.properties.conceded);
}

// Seating changes far less often than the per-player entries it references, but
// `seatedPlayersOf` allocates a fresh array on every call — and reducers
// clone-and-reassign, so Immer hands a new `game` ref on every card mutation.
// A naive `getSeatedPlayers` would therefore return a new array on every tap /
// counter / P-T change, re-rendering seat/reveal consumers. Memoize so an
// unchanged seating returns the PRIOR array by reference. Unlike
// `selectAllAttachments` (derived data → `dequal`), this returns stored
// `PlayerEntry` refs, so a shallow per-element ref check is both correct — Immer
// reassigns any entry that actually changed, flipping its ref — and far cheaper
// than deep-walking every zone on each dispatch (the hot path this is meant to
// relieve). maxSize 1 fits the single on-screen game.
const seatedPlayersEqual = (a: Enriched.PlayerEntry[], b: Enriched.PlayerEntry[]): boolean =>
  a.length === b.length && a.every((p, i) => p === b[i]);

const selectSeatedPlayers = lruMemoize(seatedPlayersOf, { resultEqualityCheck: seatedPlayersEqual });

export interface AttachedChild {
  card: ServerInfo_Card;
  ownerPlayerId: number;
}

const zoneCardsCache = new WeakMap<Enriched.ZoneEntry, ServerInfo_Card[]>();

function materializeZoneCards(zone: Enriched.ZoneEntry): ServerInfo_Card[] {
  const cached = zoneCardsCache.get(zone);
  if (cached) {
    return cached;
  }
  const arr = zone.order.map(id => zone.byId[id]);
  zoneCardsCache.set(zone, arr);
  return arr;
}

// Attachment index, stabilized for render performance.
//
// `getAttachmentsByParent` feeds React.memo'd battlefield columns. Because reducers
// clone-and-reassign, Immer hands us a new `game.players` reference on EVERY card mutation,
// so a naive selector would rebuild and return a new Map on every tap, defeating the memo.
// We wrap the build in reselect's `lruMemoize` with a `resultEqualityCheck`: the scan reruns
// when `players` changes (it's cheap), but when the attachment graph is unchanged the PREVIOUS
// Map is returned by reference, so memoized columns skip. Map identity survives taps / P/T /
// counter changes (the hot path); a real attach/unattach allocates a fresh Map (rare). maxSize
// defaults to 1, which fits the single on-screen game — and the per-player calls within one
// render share the same `players` ref, hitting the input cache.
type AttachmentsResult = ReadonlyMap<number, ReadonlyMap<number, AttachedChild[]>>;

function buildAttachments(
  players: { [playerId: number]: Enriched.PlayerEntry },
): AttachmentsResult {
  const result = new Map<number, Map<number, AttachedChild[]>>();
  const playerIds = Object.keys(players).map(Number).sort((a, b) => a - b);
  for (const ownerPlayerId of playerIds) {
    const tableZone = players[ownerPlayerId]?.zones[Enriched.ZoneName.TABLE];
    if (!tableZone) {
      continue;
    }
    for (const card of materializeZoneCards(tableZone)) {
      if (card.attachCardId == null || card.attachCardId === -1) {
        continue;
      }
      if (card.attachZone !== Enriched.ZoneName.TABLE) {
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
  return result;
}

// `dequal` deep-compares the rebuilt attachment graph (it handles Maps). When the graph is
// unchanged, reselect's resultEqualityCheck returns the PRIOR Map, giving memoized battlefield
// columns a stable reference to skip on. The scan reruns on every mutation (cheap); only the
// output reference is what we're stabilizing here.
const selectAllAttachments = lruMemoize(buildAttachments, { resultEqualityCheck: dequal });

export const Selectors = {
  getGames: ({ games }: State): { [gameId: number]: Enriched.GameEntry } => games.games,

  getGame: ({ games }: State, gameId: number): Enriched.GameEntry | undefined => games.games[gameId],

  getPlayers: ({ games }: State, gameId: number): { [playerId: number]: Enriched.PlayerEntry } | undefined =>
    games.games[gameId]?.players,

  getSeatedPlayers: ({ games }: State, gameId: number): Enriched.PlayerEntry[] => {
    const game = games.games[gameId];
    return game ? selectSeatedPlayers(game) : EMPTY_PLAYERS;
  },

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

  getCards: ({ games }: State, gameId: number, playerId: number, zoneName: string): ServerInfo_Card[] => {
    const zone = games.games[gameId]?.players[playerId]?.zones[zoneName];
    return zone ? materializeZoneCards(zone) : EMPTY_ARRAY;
  },

  getRevealedCards: (
    { games }: State,
    gameId: number,
    playerId: number,
    zoneName: string
  ): ServerInfo_Card[] =>
    games.games[gameId]?.players[playerId]?.zones[zoneName]?.revealedCards ?? EMPTY_ARRAY,

  getAttachmentsByParent: (
    { games }: State,
    gameId: number,
    parentPlayerId: number,
  ): ReadonlyMap<number, AttachedChild[]> => {
    const game = games.games[gameId];
    if (!game) {
      return EMPTY_ATTACHMENTS;
    }
    const all = selectAllAttachments(game.players);
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
