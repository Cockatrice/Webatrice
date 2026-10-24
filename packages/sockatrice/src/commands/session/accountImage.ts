import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { CommandFailure } from '../../types/CommandFailure';

import { Command_AccountImage_ext, Command_AccountImageSchema } from '../../generated';

export function accountImage(
  image: Uint8Array,
  onChanged?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_AccountImage_ext, create(Command_AccountImageSchema, { image }), {
    onSuccess: () => {
      WebClient.instance.response.session.accountImageChanged(image);
      onChanged?.();
    },
    onError: onFailure && ((responseCode, _raw, failure) => onFailure(responseCode, failure)),
  });
}
