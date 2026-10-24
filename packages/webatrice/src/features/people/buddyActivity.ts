import type { Enriched } from '@cockatrice/datatrice';
import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';

export type Activity =
  | { kind: 'waiting'; game: ServerInfo_Game; room: string; hosting: boolean; open: number }
  | { kind: 'playing'; game: ServerInfo_Game; room: string; hosting: boolean; startTime: number }
  | { kind: 'idle' }
  | { kind: 'unknown' };

export interface KnownGames {
  games: Enriched.Game[];
  roomNames: Readonly<Record<number, string>>;
}

export type RowAction = 'join' | 'watch' | 'invite' | null;

const UNKNOWN: Activity = { kind: 'unknown' };
const IDLE: Activity = { kind: 'idle' };

export function activityOf(name: string, known: KnownGames | undefined): Activity {
  if (!known) {
    return UNKNOWN;
  }
  const infos = known.games.map((game) => game.info).sort((a, b) => b.gameId - a.gameId);
  const room = (game: ServerInfo_Game) => known.roomNames[game.roomId] ?? '';
  const waiting = infos.find((game) => !game.started && game.playerCount < game.maxPlayers);
  if (waiting) {
    return {
      kind: 'waiting',
      game: waiting,
      room: room(waiting),
      hosting: waiting.creatorInfo?.name === name,
      open: waiting.maxPlayers - waiting.playerCount,
    };
  }
  const playing = infos[0];
  if (playing) {
    return {
      kind: 'playing',
      game: playing,
      room: room(playing),
      hosting: playing.creatorInfo?.name === name,
      startTime: playing.startTime,
    };
  }
  return IDLE;
}

export function rowAction(activity: Activity, canInvite: boolean, overrideRestrictions: boolean): RowAction {
  if (activity.kind === 'waiting') {
    return 'join';
  }
  if (activity.kind === 'playing') {
    return activity.game.spectatorsAllowed || overrideRestrictions ? 'watch' : null;
  }
  return canInvite ? 'invite' : null;
}

export function minutesSince(startTime: number, nowMs: number): number {
  if (!startTime) {
    return 0;
  }
  return Math.max(1, Math.round((nowMs / 1000 - startTime) / 60));
}
