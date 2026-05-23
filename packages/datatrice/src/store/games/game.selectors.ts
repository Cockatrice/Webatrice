import { createSelector } from '@reduxjs/toolkit';
import { Enriched, type Data } from '../../types';
import { GamesState } from './game.interfaces';

type State = { games: GamesState };

const EMPTY_ARRAY: Data.ServerInfo_Card[] = [];
const EMPTY_OBJECT = {} as Record<string, never>;
const EMPTY_ATTACHMENTS: ReadonlyMap<number, AttachedChild[]> = new Map();

export interface AttachedChild {
  card: Data.ServerInfo_Card;
  ownerPlayerId: number;
}

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
