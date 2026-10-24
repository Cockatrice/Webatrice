import type { Event_ReplayAdded } from '../../generated';
import { replayList } from '../../commands/session';
import { WebClient } from '../../WebClient';

export function replayAdded({ matchInfo }: Event_ReplayAdded): void {
  if (!matchInfo) {
    replayList();
    return;
  }
  WebClient.instance.response.session.replayAdded(matchInfo);
}
