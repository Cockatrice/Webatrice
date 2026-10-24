import { rooms, server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import type { RootState } from '@app/store';
import type { HomeSnapshot } from '../../services/storage/homeSnapshot';
import { buddyHostedGames, joinableOpenGames, pickUsualRoom, sortRooms, totalGames } from './homeModel';

export function captureHomeSnapshot(state: RootState, host: string, startupRoom: string): HomeSnapshot | null {
  const user = server.Selectors.getUser(state);
  if (!user || !server.Selectors.getIsConnected(state)) {
    return null;
  }
  const roomList = sortRooms(rooms.Selectors.getRooms(state));
  const joined = rooms.Selectors.getJoinedRoomIds(state);
  const usual = pickUsualRoom(roomList, joined, startupRoom);
  const buddies = new Set(Object.keys(server.Selectors.getBuddyList(state)));
  const users = server.Selectors.getUsers(state);
  const buddyGames = buddyHostedGames(rooms.Selectors.getJoinedRooms(state), buddies);
  const openGames = usual && joined[usual.info.roomId]
    ? joinableOpenGames(rooms.Selectors.getFilteredRoomGames(state, usual.info.roomId), {
      exclude: new Set(buddyGames.map(({ game }) => game.info.gameId)),
      isRegistered: (user.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) !== 0,
      limit: 2,
    }) : [];
  return {
    version: 1,
    host,
    userName: user.name,
    serverName: server.Selectors.getName(state) ?? '',
    onlineCount: Object.keys(users).length,
    gamesRunning: totalGames(roomList),
    rooms: roomList.slice(0, 256).map(({ info }) => ({
      id: info.roomId, name: info.name.slice(0, 512), games: info.gameCount, people: info.playerCount,
    })),
    usualRoomId: usual && joined[usual.info.roomId] ? usual.info.roomId : null,
    openGames: openGames.map(({ info }) => ({
      id: info.gameId, name: info.description.slice(0, 512), players: info.playerCount, maxPlayers: info.maxPlayers,
    })),
    buddiesOnline: [...buddies].filter(name => users[name]).length,
    buddyCount: buddies.size,
  };
}
