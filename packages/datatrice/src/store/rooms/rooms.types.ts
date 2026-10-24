import { Actions } from './rooms.actions';

const a = Actions;

export const Types = {
  CLEAR_STORE: a.clearStore.type,
  UPDATE_ROOMS: a.updateRooms.type,
  JOIN_ROOM: a.joinRoom.type,
  LEAVE_ROOM: a.leaveRoom.type,
  ADD_MESSAGE: a.addMessage.type,
  ROOM_SAY_RECEIVED: a.roomSayReceived.type,
  ROOM_SAY_FAILED: a.roomSayFailed.type,
  UPDATE_GAMES: a.updateGames.type,
  USER_JOINED: a.userJoined.type,
  USER_LEFT: a.userLeft.type,
  SORT_GAMES: a.sortGames.type,
  REMOVE_MESSAGES: a.removeMessages.type,
  GAME_CREATED: a.gameCreated.type,
  JOIN_ROOM_FAILED: a.joinRoomFailed.type,
  CREATE_GAME_FAILED: a.createGameFailed.type,
  JOINED_GAME: a.joinedGame.type,
  SELECT_GAME: a.selectGame.type,
  SET_GAME_FILTERS: a.setGameFilters.type,
  CLEAR_GAME_FILTERS: a.clearGameFilters.type,
  SET_JOIN_GAME_PENDING: a.setJoinGamePending.type,
  SET_JOIN_GAME_ERROR: a.setJoinGameError.type,
  CLEAR_JOIN_GAME_ERROR: a.clearJoinGameError.type,
  CLEAR_JOIN_ROOM_ERROR: a.clearJoinRoomError.type,
} as const;

export { MAX_ROOM_MESSAGES } from './rooms.reducer';
