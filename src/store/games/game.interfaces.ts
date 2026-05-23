import type { Enriched } from '../../types';

export interface GamesState {
  games: { [gameId: number]: Enriched.GameEntry };
}
