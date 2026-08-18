import { create } from '@bufbuild/protobuf';
import { Command_SetCardAttr_ext, Command_SetCardAttrSchema, type SetCardAttrParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function setCardAttr(
  gameId: number,
  params: SetCardAttrParams,
  judgeTargetId?: number,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_SetCardAttr_ext,
    create(Command_SetCardAttrSchema, params),
    { judgeTargetId, ...options },
  );
}
