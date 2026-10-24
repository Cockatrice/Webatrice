import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_GetUserInfo_ext, Command_GetUserInfoSchema, Response_GetUserInfo_ext } from '../../generated';

export function getUserInfo(userName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_GetUserInfo_ext, create(Command_GetUserInfoSchema, { userName }), {
    responseExt: Response_GetUserInfo_ext,
    onSuccess: (response) => {
      WebClient.instance.response.session.getUserInfo(response.userInfo, ...correlation);
    },
    onError: (responseCode) => {
      WebClient.instance.response.session.getUserInfoFailed?.(userName, responseCode, ...correlation);
    },
  });
}
