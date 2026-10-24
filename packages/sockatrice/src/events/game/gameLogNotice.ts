import type { Event_GameLogNotice } from '../../generated';
import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function gameLogNotice(data: Event_GameLogNotice, meta: GameEventMeta): void {
  WebClient.instance.response.game.gameLogNotice?.(meta.gameId, meta.playerId, data.noticeType);
}
