import { create } from '@bufbuild/protobuf';
import type { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';

import { Command_ReplayDownload_ext, Command_ReplayDownloadSchema, Response_ReplayDownload_ext } from '../../generated';

export function replayDownload(
  replayId: number,
  onDownloaded?: (replayData: Uint8Array) => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReplayDownload_ext,
    create(Command_ReplayDownloadSchema, { replayId }),
    {
      responseExt: Response_ReplayDownload_ext,
      onSuccess: (response) => {
        if (onDownloaded) {
          onDownloaded(response.replayData);
        } else {
          WebClient.instance.response.session.replayDownloaded(replayId, response);
        }
      },
      onError: (responseCode, _raw, failure) => onFailure?.(responseCode, failure),
    }
  );
}
