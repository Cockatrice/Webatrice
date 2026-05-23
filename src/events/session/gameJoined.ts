import type { Event_GameJoined } from '../../generated';
import { WebClient } from '../../WebClient';

export function gameJoined(gameJoined: Event_GameJoined): void {
  WebClient.instance.response.session.gameJoined(gameJoined);
}
