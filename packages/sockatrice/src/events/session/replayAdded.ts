import type { Event_ReplayAdded } from '../../generated';
import { WebClient } from '../../WebClient';

export function replayAdded({ matchInfo }: Event_ReplayAdded): void {
  WebClient.instance.response.session.replayAdded(matchInfo);
}
