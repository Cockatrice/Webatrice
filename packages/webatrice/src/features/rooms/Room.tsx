import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';

import GamesList from './components/GamesList';
import RoomChat from './components/RoomChat';
import RoomUsers from './components/RoomUsers';
import { useRoom } from './useRoom';

/**
 * Room page — reached after joining a server room (auto-join can send
 * users here directly on login if `clientOptions.autojoinrooms` is on).
 * Rebuilt on fancy webatrice's grid: games table top-left, room chat
 * bottom-left, users column on the right spanning both rows.
 *
 * og's `<Layout>` (LeftNav shell) is kept intact for this piece; a
 * follow-up will replace it with fancy's TopBar + Tabs.
 */
const Room = () => {
  const { room, roomMessages, handleRoomSay } = useRoom();

  if (!room) {
    return null;
  }

  return (
    <Layout className="room-view">
      <AuthGuard />

      <div
        className="grid h-full min-h-0 gap-3 p-3 bg-bg-base"
        style={{
          gridTemplateColumns: '1fr 320px',
          gridTemplateRows: '1fr 280px',
        }}
      >
        <div className="min-h-0 min-w-0">
          <GamesList room={room} />
        </div>
        <div className="row-span-2 min-h-0 min-w-0">
          <RoomUsers />
        </div>
        <div className="min-h-0 min-w-0">
          <RoomChat
            roomName={room.info.name}
            messages={roomMessages}
            onSay={handleRoomSay}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Room;
