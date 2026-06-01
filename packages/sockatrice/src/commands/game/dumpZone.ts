import { create } from '@bufbuild/protobuf';
import {
  Command_DumpZone_ext,
  Command_DumpZoneSchema,
  Response_DumpZone_ext,
  type DumpZoneParams,
} from '../../generated';
import { WebClient } from '../../WebClient';

/**
 * Dumps a zone (e.g. "View library", "Dump top N"). The server returns the cards to the requester
 * in Response_DumpZone — for a hidden zone (the deck) the card list is face-up with list-index ids.
 * Those revealed cards are routed into the store; the card-less Event_DumpZone broadcast to other
 * players is handled separately (see events/game/dumpZone.ts).
 */
export function dumpZone(gameId: number, params: DumpZoneParams): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_DumpZone_ext,
    create(Command_DumpZoneSchema, params),
    {
      responseExt: Response_DumpZone_ext,
      onSuccess: (resp) =>
        WebClient.instance.response.game.zoneViewRevealed(
          gameId,
          params.playerId ?? -1,
          params.zoneName ?? '',
          resp.zoneInfo?.cardList ?? [],
        ),
    },
  );
}
