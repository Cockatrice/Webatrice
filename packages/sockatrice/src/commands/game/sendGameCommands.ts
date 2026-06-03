import { WebClient } from '../../WebClient';
import type { GameCommandEntry } from '../../services/ProtobufService';

// Sends a batch of game commands as a single CommandContainer. See
// ProtobufService.sendGameCommands. Used by bulk card actions so a multi-card
// gesture is one atomic command, matching Cockatrice's cardMenuAction.
export function sendGameCommands(gameId: number, entries: ReadonlyArray<GameCommandEntry>): void {
  WebClient.instance.protobuf.sendGameCommands(gameId, entries);
}
