import { WebClient } from '../WebClient';
import { CommandFailure } from '../types/CommandFailure';
import { StatusEnum } from '../types/StatusEnum';

export function outlivedSession(failure?: CommandFailure): boolean {
  return failure === CommandFailure.Disconnected && WebClient.instance.status === StatusEnum.DISCONNECTED;
}
