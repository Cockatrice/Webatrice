import { create } from '@bufbuild/protobuf';
import { Command_UpdateServerMessage_ext, Command_UpdateServerMessageSchema } from '../../generated';
import { WebClient } from '../../WebClient';
export function updateServerMessage(): void {
  WebClient.instance.protobuf.sendAdminCommand(Command_UpdateServerMessage_ext, create(Command_UpdateServerMessageSchema), {
    onSuccess: () => {
      WebClient.instance.response.admin.updateServerMessage();
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.admin.commandFailed?.('updateServerMessage', responseCode, '', failure);
    },
  });
}
