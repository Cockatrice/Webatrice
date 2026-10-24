import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_Message_ext, Command_MessageSchema, Response_ResponseCode } from '../../generated';
import { outlivedSession } from '../outlivedSession';

const REPORTED_FAILURES = [
  Response_ResponseCode.RespInIgnoreList,
  Response_ResponseCode.RespNameNotFound,
  Response_ResponseCode.RespChatFlood,
];

export function message(userName: string, message: string): void {
  const { session } = WebClient.instance.response;
  const onResponseCode: { [code: number]: () => void } = {};
  for (const code of REPORTED_FAILURES) {
    onResponseCode[code] = () => session.privateMessageFailed?.(userName, message, code);
  }

  WebClient.instance.protobuf.sendSessionCommand(Command_Message_ext, create(Command_MessageSchema, { userName, message }), {
    onResponseCode,
    onError: (responseCode, _raw, failure) => {
      if (failure && !outlivedSession(failure)) {
        session.privateMessageFailed?.(userName, message, responseCode, failure);
      }
    },
  });
}
