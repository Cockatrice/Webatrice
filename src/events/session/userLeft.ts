import type { Event_UserLeft } from '../../generated';
import { WebClient } from '../../WebClient';

export function userLeft({ name }: Event_UserLeft): void {
  WebClient.instance.response.session.userLeft(name);
}
