import { games, type GameEntry, type GamesState } from '@cockatrice/datatrice';

import type { ObservedAction } from './unreadEvents';

export interface GameReady {
  gameId: number;
  description: string;
  taken: number;
  max: number;
}

const seated = (game: GameEntry | undefined): number =>
  game ? Object.values(game.players).filter((player) => !player.properties.spectator).length : 0;

export function detectGameReady(action: ObservedAction, before: GamesState, after: GamesState): GameReady | null {
  if (action.type !== games.Types.PLAYER_JOINED) {
    return null;
  }
  const { gameId, playerProperties } = action.payload as { gameId: number; playerProperties: { spectator: boolean } };
  const game = after.games[gameId];
  if (playerProperties.spectator || !game || game.spectator || game.replay || game.started) {
    return null;
  }
  const max = game.info.maxPlayers;
  const taken = seated(game);
  if (!max || taken < max || seated(before.games[gameId]) >= max) {
    return null;
  }
  return { gameId, description: game.info.description, taken, max };
}
