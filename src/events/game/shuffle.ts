import type { Event_Shuffle } from '../../generated';
import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function shuffle(data: Event_Shuffle, meta: GameEventMeta): void {
  WebClient.instance.response.game.zoneShuffled(meta.gameId, meta.playerId, data);
}
