import type { Event_RoomSay, RoomEvent } from '../../generated';
import { WebClient } from '../../WebClient';

export function roomSay(data: Event_RoomSay, { roomId }: RoomEvent): void {
  const message = { ...data, timeReceived: Date.now() };
  WebClient.instance.response.room.addMessage(roomId, message);
}
