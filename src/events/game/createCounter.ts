import type { Event_CreateCounter } from '../../generated';
import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function createCounter(data: Event_CreateCounter, meta: GameEventMeta): void {
  WebClient.instance.response.game.counterCreated(meta.gameId, meta.playerId, data);
}
