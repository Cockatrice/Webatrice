import { create } from '@bufbuild/protobuf';

import { attachResponseHandlers, createStore, Data, rooms } from '../../src';

// Integration: drives every RoomResponseImpl handler method through the real
// store — room join/leave/update lifecycle, the updateGames listener path,
// chat (add / remove messages), user join/leave, and the create/join-game
// flow. Assertions go through rooms.selectors so the SortUtil + gameFilters
// selector layer is exercised. The filter/select-game selectors are seeded
// via the slice actions they belong to (no bridge handler exposes them yet).

function makeRoom(roomId: number, name: string): Data.ServerInfo_Room {
  return create(Data.ServerInfo_RoomSchema, {
    roomId, name, description: `${name} room`,
    gameCount: 0, playerCount: 0, permissionlevel: 'none',
    gametypeList: [create(Data.ServerInfo_GameTypeSchema, { gameTypeId: 1, description: 'Standard' })],
    gameList: [], userList: [],
  });
}

function makeGame(gameId: number, overrides: Partial<Data.ServerInfo_Game> = {}): Data.ServerInfo_Game {
  return create(Data.ServerInfo_GameSchema, {
    gameId, roomId: 1, description: `game ${gameId}`,
    gameTypes: [1], playerCount: 1, maxPlayers: 4, started: false,
    ...overrides,
  });
}

function makeRoomUser(name: string): Data.ServerInfo_User {
  return create(Data.ServerInfo_UserSchema, { name, accountageSecs: 0n });
}

// --- room lifecycle ------------------------------------------------------

describe('integration: room lifecycle', () => {
  it('joinRoom places the room in the slice and marks it joined', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    const state = store.getState();
    expect(rooms.Selectors.getJoinedRoomIds(state)[1]).toBe(true);
    expect(rooms.Selectors.getRoom(state, 1)?.info.name).toBe('Main');
    expect(rooms.Selectors.getJoinedRooms(state).map(r => r.info.roomId)).toEqual([1]);
  });

  it('updateRooms upserts new rooms and partial-merges existing ones', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.room.joinRoom(makeRoom(1, 'Main'));
    // updateRooms emits only changed fields for an existing room.
    response.room.updateRooms([
      create(Data.ServerInfo_RoomSchema, { roomId: 1, playerCount: 12 }),
      makeRoom(2, 'Secondary'),
    ]);

    const state = store.getState();
    // Existing room keeps its name; only playerCount merged.
    expect(rooms.Selectors.getRoom(state, 1)?.info.name).toBe('Main');
    expect(rooms.Selectors.getRoom(state, 1)?.info.playerCount).toBe(12);
    // New room added wholesale.
    expect(rooms.Selectors.getRoom(state, 2)?.info.name).toBe('Secondary');
  });

  it('leaveRoom clears joined state and the room contents', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));
    response.room.userJoined(1, makeRoomUser('alice'));

    response.room.leaveRoom(1);
    const state = store.getState();
    expect(rooms.Selectors.getJoinedRoomIds(state)[1]).toBeUndefined();
    expect(Object.keys(rooms.Selectors.getRoomUsers(state, 1))).toHaveLength(0);
  });

  it('clearStore resets the rooms slice', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));
    response.room.clearStore();
    expect(Object.keys(rooms.Selectors.getRooms(store.getState()))).toHaveLength(0);
  });
});

// --- games within a room -------------------------------------------------

describe('integration: room games', () => {
  it('updateGames normalizes and stores games, removing closed ones', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    response.room.updateGames(1, [makeGame(10), makeGame(11)]);
    let games = rooms.Selectors.getRoomGames(store.getState(), 1);
    expect(Object.keys(games).sort()).toEqual(['10', '11']);
    // gameType resolved from the room's gametypeMap.
    expect(games[10].gameType).toBe('Standard');

    // A closed game in a later listing is removed.
    response.room.updateGames(1, [makeGame(10, { closed: true })]);
    games = rooms.Selectors.getRoomGames(store.getState(), 1);
    expect(games[10]).toBeUndefined();
    expect(games[11]).toBeDefined();
  });

  it('getSortedRoomGames orders games by the rooms sort field', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));
    response.room.updateGames(1, [
      makeGame(10, { startTime: 300 }),
      makeGame(11, { startTime: 100 }),
      makeGame(12, { startTime: 200 }),
    ]);

    // Default sort is START_TIME DESC.
    const sorted = rooms.Selectors.getSortedRoomGames(store.getState(), 1);
    expect(sorted.map(g => g.info.gameId)).toEqual([10, 12, 11]);
  });

  it('getFilteredRoomGames applies a seeded filter against the sorted list', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));
    response.room.updateGames(1, [
      makeGame(10, { playerCount: 1, maxPlayers: 4 }),
      makeGame(11, { playerCount: 4, maxPlayers: 4 }),
    ]);
    store.dispatch(rooms.Actions.setGameFilters({
      roomId: 1, filters: { ...rooms.DEFAULT_GAME_FILTERS, hideFullGames: true },
    }));

    expect(rooms.Selectors.isGameFilterActive(store.getState(), 1)).toBe(true);
    const visible = rooms.Selectors.getFilteredRoomGames(store.getState(), 1);
    expect(visible.map(g => g.info.gameId)).toEqual([10]);
    expect(rooms.Selectors.getRoomGameCounts(store.getState(), 1)).toEqual({ visible: 1, total: 2 });

    store.dispatch(rooms.Actions.clearGameFilters({ roomId: 1 }));
    expect(rooms.Selectors.isGameFilterActive(store.getState(), 1)).toBe(false);
  });

  it('selectGame / roomGameRemoved keep the selected game id consistent', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));
    response.room.updateGames(1, [makeGame(10)]);

    store.dispatch(rooms.Actions.selectGame({ roomId: 1, gameId: 10 }));
    expect(rooms.Selectors.getSelectedGameId(store.getState(), 1)).toBe(10);

    // Removing the selected game clears the selection.
    response.room.updateGames(1, [makeGame(10, { closed: true })]);
    expect(rooms.Selectors.getSelectedGameId(store.getState(), 1)).toBeUndefined();
  });

  it('gameCreated and join-game flow drive joinedGameIds + join state', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    response.room.gameCreated(1);
    response.room.setJoinGamePending(true);
    expect(rooms.Selectors.getJoinGamePending(store.getState())).toBe(true);

    response.room.joinedGame(1, 55);
    expect(rooms.Selectors.getJoinedGameIds(store.getState())[1][55]).toBe(true);

    response.room.setJoinGameError(7, 'game full');
    const state = store.getState();
    expect(rooms.Selectors.getJoinGameError(state)).toEqual({ code: 7, message: 'game full' });
    // setJoinGameError also clears the pending flag.
    expect(rooms.Selectors.getJoinGamePending(state)).toBe(false);
  });
});

// --- chat + users --------------------------------------------------------

describe('integration: room chat and users', () => {
  it('addMessage appends to the room message list', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    response.room.addMessage(1, { senderName: 'alice', message: 'hello', timeReceived: 1 });
    response.room.addMessage(1, { senderName: 'bob', message: 'hi', timeReceived: 2 });

    const messages = rooms.Selectors.getRoomMessages(store.getState(), 1);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ senderName: 'bob', message: 'hi' });
  });

  it('removeMessages drops the most recent N messages from a sender', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    response.room.addMessage(1, { name: 'troll', message: 'spam1', timeReceived: 1 });
    response.room.addMessage(1, { senderName: 'alice', message: 'real', timeReceived: 2 });
    response.room.addMessage(1, { name: 'troll', message: 'spam2', timeReceived: 3 });

    response.room.removeMessages(1, 'troll', 2);
    const messages = rooms.Selectors.getRoomMessages(store.getState(), 1);
    // Both `troll:`-prefixed messages are removed; alice's survives. Her
    // message used `senderName` (not `name`) so normalizeUserMessage left it
    // unprefixed.
    expect(messages.map(m => m.message)).toEqual(['real']);
  });

  it('userJoined and userLeft maintain the sorted room user list', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.joinRoom(makeRoom(1, 'Main'));

    response.room.userJoined(1, makeRoomUser('charlie'));
    response.room.userJoined(1, makeRoomUser('alice'));
    let users = rooms.Selectors.getSortedRoomUsers(store.getState(), 1);
    expect(users.map(u => u.name)).toEqual(['alice', 'charlie']);

    response.room.userLeft(1, 'charlie');
    users = rooms.Selectors.getSortedRoomUsers(store.getState(), 1);
    expect(users.map(u => u.name)).toEqual(['alice']);
  });

  it('room events for an unknown room id are ignored without throwing', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(() => {
      response.room.userJoined(999, makeRoomUser('ghost'));
      response.room.userLeft(999, 'ghost');
      response.room.updateGames(999, [makeGame(1)]);
    }).not.toThrow();
  });
});
