import { hasExtension } from '@bufbuild/protobuf';

import type { Event_PlayerPropertiesChanged } from '../../generated';
import { Context_DeckSelect_ext } from '../../generated';
import type { GameEventMeta } from '../../types/WebSocketConfig';
import { WebClient } from '../../WebClient';

export function playerPropertiesChanged(data: Event_PlayerPropertiesChanged, meta: GameEventMeta): void {
  const isDeckSelect = meta.context != null && hasExtension(meta.context, Context_DeckSelect_ext);
  WebClient.instance.response.game.playerPropertiesChanged(meta.gameId, meta.playerId, data.playerProperties, isDeckSelect);
}
