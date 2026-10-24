import type { TFunction } from 'i18next';

import type { Game, Room } from '@cockatrice/datatrice';
import type { ServerInfo_DeckStorage_Folder, ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { hasOpenSeat } from '@app/components';
import { flattenBackendDecks } from '@app/hooks';
import type { RecentDeck } from '@app/services';
import { MTG_FORMAT_LABELS, normalizeFormat } from '@app/types';

export interface BuddyGame {
  room: Room;
  game: Game;
}

export interface OnlineBuddy {
  user: ServerInfo_User;
  hosting?: Game;
}

export function sortRooms(rooms: Record<number, Room>): Room[] {
  return Object.values(rooms).sort((a, b) => a.order - b.order || a.info.roomId - b.info.roomId);
}

export function pickUsualRoom(
  rooms: readonly Room[],
  joinedRoomIds: Readonly<Record<number, boolean>>,
  startupRoomName: string,
): Room | undefined {
  const name = startupRoomName.trim();
  return (name ? rooms.find((room) => room.info.name === name) : undefined)
    ?? rooms.find((room) => room.info.autoJoin && joinedRoomIds[room.info.roomId])
    ?? rooms.find((room) => joinedRoomIds[room.info.roomId])
    ?? rooms.find((room) => room.info.autoJoin)
    ?? rooms[0];
}

export function countOpenSeatGames(room: Room): number {
  return Object.values(room.games).filter((game) => hasOpenSeat(game.info)).length;
}

function gameRank(game: Game): number {
  if (hasOpenSeat(game.info)) {
    return 0;
  }
  return game.info.started ? 2 : 1;
}

export function buddyHostedGames(
  joinedRooms: readonly Room[],
  buddyNames: ReadonlySet<string>,
): BuddyGame[] {
  const out: BuddyGame[] = [];
  for (const room of joinedRooms) {
    for (const game of Object.values(room.games)) {
      const host = game.info.creatorInfo?.name;
      if (host && buddyNames.has(host)) {
        out.push({ room, game });
      }
    }
  }
  return out.sort((a, b) => gameRank(a.game) - gameRank(b.game) || b.game.info.gameId - a.game.info.gameId);
}

export function onlineBuddies(
  buddyList: Readonly<Record<string, ServerInfo_User>>,
  usersOnline: Readonly<Record<string, ServerInfo_User>>,
  hosted: readonly BuddyGame[],
  locale?: string,
): OnlineBuddy[] {
  const hostingByName = new Map<string, Game>();
  for (const { game } of hosted) {
    const host = game.info.creatorInfo?.name;
    if (host && !hostingByName.has(host)) {
      hostingByName.set(host, game);
    }
  }
  return Object.keys(buddyList)
    .filter((name) => usersOnline[name])
    .sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }))
    .map((name) => ({ user: usersOnline[name], hosting: hostingByName.get(name) }));
}

export function totalGames(rooms: readonly Room[]): number {
  return rooms.reduce((sum, room) => sum + room.info.gameCount, 0);
}

export function liveRecentDecks(recent: readonly RecentDeck[], root: ServerInfo_DeckStorage_Folder | undefined): RecentDeck[] {
  if (!root) {
    return [...recent];
  }
  const names = new Map(flattenBackendDecks(root).map((deck) => [deck.id, deck.name]));
  return recent
    .filter((deck) => names.has(deck.deckId))
    .map((deck) => ({ ...deck, name: names.get(deck.deckId) || deck.name }));
}

export function deckFormatLabel(format: string, t: TFunction): string {
  const known = MTG_FORMAT_LABELS.find((f) => f.value === normalizeFormat(format));
  return known ? known.label(t) : format.replace(/^\w/, (c) => c.toUpperCase());
}

export type BuddyGamesEmpty = 'noBuddies' | 'notJoined' | 'noneHosting';

export function buddyGamesEmptyKind(buddyCount: number, joinedRoomCount: number): BuddyGamesEmpty {
  if (buddyCount === 0) {
    return 'noBuddies';
  }
  return joinedRoomCount > 0 ? 'noneHosting' : 'notJoined';
}

export interface OpenGamesOptions {
  exclude: ReadonlySet<number>;
  isRegistered: boolean;
  limit: number;
}

export function joinableOpenGames(games: readonly Game[], { exclude, isRegistered, limit }: OpenGamesOptions): Game[] {
  return games
    .filter(({ info }) => hasOpenSeat(info)
      && !info.withPassword
      && !info.onlyBuddies
      && (isRegistered || !info.onlyRegistered)
      && !exclude.has(info.gameId))
    .sort((a, b) => (a.info.maxPlayers - a.info.playerCount) - (b.info.maxPlayers - b.info.playerCount)
      || b.info.gameId - a.info.gameId)
    .slice(0, limit);
}

export function serverDeckCount(root: ServerInfo_DeckStorage_Folder | undefined): number {
  return root ? flattenBackendDecks(root).length : 0;
}
