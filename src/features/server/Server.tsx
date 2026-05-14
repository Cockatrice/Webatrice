import { useMemo } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';

import { AuthGuard, ThreePaneLayout, UserDisplay, VirtualList } from '@app/components';
import { useReduxEffect } from '@app/hooks';
import { Layout } from '@app/feature-core';
import { server, rooms } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Room } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';
import RoomsList from './RoomsList';

import './Server.css';

const Server = () => {
  const message = useAppSelector(state => server.Selectors.getMessage(state));
  const roomsList = useAppSelector(state => rooms.Selectors.getRooms(state));
  const joinedRooms = useAppSelector(state => rooms.Selectors.getJoinedRooms(state));
  const users = useAppSelector(state => server.Selectors.getSortedUsers(state));
  const navigate = useNavigate();

  useReduxEffect<{ roomInfo: ServerInfo_Room }>((action) => {
    const roomId = action.payload.roomInfo.roomId.toString();
    navigate(generatePath(RouteEnum.ROOM, { roomId }));
  }, rooms.Types.JOIN_ROOM, []);

  const userItems = useMemo(
    () => users.map((user) => (
      <ListItemButton key={user.name} dense>
        <UserDisplay user={user} />
      </ListItemButton>
    )),
    [users],
  );

  return (
    <Layout className="server-rooms">
      <AuthGuard />

      <ThreePaneLayout
        top={(
          <Paper className="serverRoomWrapper overflow-scroll">
            <RoomsList rooms={roomsList} joinedRooms={joinedRooms} />
          </Paper>
        )}

        bottom={(
          <Paper className="serverMessage overflow-scroll">
            {/* message is sanitized via DOMPurify in websocket/events/session/serverMessage.ts */}
            <div className="serverMessage__content" dangerouslySetInnerHTML={{ __html: message }} />
          </Paper>
        )}

        side={(
          <Paper className="server-rooms__side overflow-scroll">
            <div className="server-rooms__side-label">
              Users connected to server: {users.length}
            </div>
            <VirtualList items={userItems} />
          </Paper>
        )}
      />
    </Layout>
  );
}

export default Server;
