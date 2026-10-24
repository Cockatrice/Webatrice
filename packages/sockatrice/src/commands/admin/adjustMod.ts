import { create } from '@bufbuild/protobuf';
import { Command_AdjustMod_ext, Command_AdjustModSchema } from '../../generated';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

export function adjustMod(
  userName: string, shouldBeMod?: boolean, shouldBeJudge?: boolean, shouldBeDeveloper?: boolean,
  ...correlation: [requestId?: RequestId]
): void {
  WebClient.instance.protobuf.sendAdminCommand(
    Command_AdjustMod_ext,
    create(Command_AdjustModSchema, { userName, shouldBeMod, shouldBeJudge, shouldBeDeveloper }),
    {
      onSuccess: () => {
        WebClient.instance.response.admin.adjustMod(userName, shouldBeMod, shouldBeJudge, shouldBeDeveloper, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.admin.commandFailed?.('adjustMod', responseCode, userName, failure, ...correlation);
      },
    }
  );
}
