import type { WebClient } from '@cockatrice/sockatrice';
import type { GameEntry, PlayerEntry } from '@cockatrice/datatrice';

export interface GameDialogEnv {
  gameId: number | undefined;
  webClient: WebClient;
  readGame: () => GameEntry | undefined;
  readLocalPlayer: () => PlayerEntry | undefined;
  judgeTarget: (ownerPlayerId: number) => number | undefined;
}
