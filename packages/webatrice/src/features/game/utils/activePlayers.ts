import { GameEntry, PlayerEntry } from '@cockatrice/datatrice';

// The seated, in-play players: a port of Cockatrice's collectActivePlayers
// (GameScene), which keeps players that are neither spectating nor conceded.
// Shared by the board layout (which seats them) and the reveal dialog (which
// lists them as reveal targets) so the predicate lives in exactly one place.
export function activePlayersOf(game: GameEntry): PlayerEntry[] {
  return Object.values(game.players).filter(
    (p) => !p.properties.spectator && !p.properties.conceded,
  );
}
