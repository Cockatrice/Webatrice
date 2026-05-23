import type { Event_ListRooms } from '../../generated';
import { joinRoom } from '../../commands/session';
import { WebClient } from '../../WebClient';

export function listRooms({ roomList }: Event_ListRooms): void {
  WebClient.instance.response.room.updateRooms(roomList);

  if (WebClient.instance.clientOptions.autojoinrooms) {
    roomList.forEach(({ autoJoin, roomId }) => {
      if (autoJoin) {
        joinRoom(roomId);
      }
    });
  }
}
