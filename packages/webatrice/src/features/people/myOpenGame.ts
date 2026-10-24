import type { Enriched } from '@cockatrice/datatrice';

export interface MyOpenGame {
  gameId: number;
  description: string;
  seated: number;
  max: number;
  hosting: boolean;
}

export function myOpenGame(games: Readonly<Record<number, Enriched.GameEntry>>): MyOpenGame | null {
  const candidates = Object.values(games)
    .filter((game) => !game.replay && !game.spectator && !game.started)
    .map((game) => ({
      gameId: game.info.gameId,
      description: game.info.description,
      seated: Math.max(game.seatOrder.length, Object.keys(game.players).length),
      max: game.info.maxPlayers,
      hosting: game.hostId === game.localPlayerId,
    }))
    .filter((game) => game.seated < game.max)
    .sort((a, b) => Number(b.hosting) - Number(a.hosting) || b.gameId - a.gameId);
  return candidates[0] ?? null;
}
