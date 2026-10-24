import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_SetCardArtParams_ext, Command_SetCardArtParamsSchema, type SetCardArtParamsParams } from '../../generated';

export function setCardArtParams(
  params: SetCardArtParamsParams,
  onSuccess?: () => void,
  onFailure?: (responseCode: number) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_SetCardArtParams_ext,
    create(Command_SetCardArtParamsSchema, params),
    {
      onSuccess,
      onError: onFailure,
    }
  );
}
