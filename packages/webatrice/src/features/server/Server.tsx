import { generatePath, useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

import { AuthGuard } from '@app/components';
import { useReduxEffect } from '@app/hooks';
import { Layout } from '@app/feature-wrappers/layout';
import { server, rooms } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Room } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';

import RoomsList from './RoomsList';
import ServerUsers from './ServerUsers';

/**
 * Server (lobby) page — reached when a user hasn't been auto-joined
 * into a room. Grid layout mirrors the Room page: rooms table top-
 * left, server MOTD bottom-left, connected users on the right
 * spanning both rows. All MUI (Paper, Table, ListItemButton,
 * VirtualList) removed; every panel is a Tailwind card.
 *
 * JOIN_ROOM effect stays as-is: on join success, redirect into the
 * corresponding /room/:roomId route.
 */
const Server = () => {
  const message = useAppSelector((state) => server.Selectors.getMessage(state));
  const roomsList = useAppSelector((state) => rooms.Selectors.getRooms(state));
  const joinedRooms = useAppSelector((state) => rooms.Selectors.getJoinedRooms(state));
  const users = useAppSelector((state) => server.Selectors.getSortedUsers(state));
  const navigate = useNavigate();

  useReduxEffect<{ roomInfo: ServerInfo_Room }>((action) => {
    const roomId = action.payload.roomInfo.roomId.toString();
    navigate(generatePath(RouteEnum.ROOM, { roomId }));
  }, rooms.Types.JOIN_ROOM, []);

  return (
    <Layout>
      <AuthGuard />

      <div
        className="grid h-full min-h-0 gap-3 p-3 bg-bg-base"
        style={{
          gridTemplateColumns: '1fr 320px',
          gridTemplateRows: '1fr 280px',
        }}
      >
        <div className="min-h-0 min-w-0">
          <RoomsList rooms={roomsList} joinedRooms={joinedRooms} />
        </div>
        <div className="row-span-2 min-h-0 min-w-0">
          <ServerUsers users={users} />
        </div>
        <div className="min-h-0 min-w-0">
          <ServerMotd message={message} />
        </div>
      </div>
    </Layout>
  );
};

interface ServerMotdProps {
  message: string;
}

/** Renders the server's Message of the Day. Content is DOMPurified
 *  upstream in websocket/events/session/serverMessage.ts, so
 *  dangerouslySetInnerHTML is safe here. Arbitrary-variant Tailwind
 *  classes recolor the raw `<a>` links so they use our accent instead
 *  of default browser blue. Inline `<span style="color:#...">` bits
 *  from the server still render their own colors (red for warnings,
 *  etc.) — that's intentional. */
function ServerMotd({ message }: ServerMotdProps) {
  return (
    <section className="flex h-full flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
        <Megaphone size={14} className="text-text-muted" />
        <h3 className="font-modern text-xs font-bold uppercase tracking-wider text-text-secondary">
          Server Announcements
        </h3>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm text-text-secondary [&_a]:text-accent [&_a]:underline [&_a:hover]:text-accent-hover [&_p]:my-1 [&_b]:text-text-primary [&_strong]:text-text-primary"
        dangerouslySetInnerHTML={{ __html: message }}
      />
    </section>
  );
}

export default Server;
