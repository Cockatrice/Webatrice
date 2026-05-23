import type { Event_Kicked } from '../../generated';

import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function kicked(_data: Event_Kicked, meta: GameEventMeta): void {
  WebClient.instance.response.game.kicked(meta.gameId);
}
