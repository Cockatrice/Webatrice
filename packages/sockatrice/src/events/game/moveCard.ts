import { hasExtension } from '@bufbuild/protobuf';

import type { Event_MoveCard } from '../../generated';
import { Context_UndoDraw_ext } from '../../generated';
import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function moveCard(data: Event_MoveCard, meta: GameEventMeta): void {
  // Cockatrice tags an Event_MoveCard triggered by Command_UndoDraw
  // with `Context_UndoDraw` on the surrounding GameEventContext
  // (server_player.cpp:1116). The client uses that flag to log the
  // "X undoes their last draw" line instead of the generic move log
  // (see MessageLogWidget::logUndoDraw). Detect it here so the
  // reducer / listener can branch on it.
  const isUndoDraw =
    meta.context != null && hasExtension(meta.context, Context_UndoDraw_ext);
  WebClient.instance.response.game.cardMoved(meta.gameId, meta.playerId, data, isUndoDraw);
}
