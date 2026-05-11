import { create } from '@bufbuild/protobuf';
import { Data } from '@app/types';

import { roomsReducer } from './rooms.reducer';
import { Actions } from './rooms.actions';
import { makeGame, makeRoom, makeRoomsState, makeUser } from './__mocks__/rooms-fixtures';

describe('roomUpserted', () => {
  it('inserts a fresh RoomEntry with empty games/users when preserveGamesAndUsers is false', () => {
    const state = makeRoomsState({ rooms: {} });
    const info = create(Data.ServerInfo_RoomSchema, {
      roomId: 42,
      name: 'Fresh Room',
      description: 'New',
    });
    const gametypeMap = { 0: 'Constructed' };

    const result = roomsReducer(state, Actions.roomUpserted({
      roomId: 42,
      info,
      gametypeMap,
      order: 3,
      preserveGamesAndUsers: false,
    }));

    expect(result.rooms[42]).toBeDefined();
    expect(result.rooms[42].info).toBe(info);
    expect(result.rooms[42].gametypeMap).toBe(gametypeMap);
    expect(result.rooms[42].order).toBe(3);
    expect(result.rooms[42].games).toEqual({});
    expect(result.rooms[42].users).toEqual({});
  });

  it('preserves existing games/users on merge when preserveGamesAndUsers is true', () => {
    const existingGame = makeGame({ gameId: 7 });
    const existingUser = makeUser({ name: 'alice' });
    const existingRoom = makeRoom({
      roomId: 1,
      name: 'Old Name',
      games: { 7: existingGame },
      users: { alice: existingUser },
    });
    const state = makeRoomsState({ rooms: { 1: existingRoom } });

    const mergedInfo = create(Data.ServerInfo_RoomSchema, {
      roomId: 1,
      name: 'Old Name',
      playerCount: 42,
    });
    const result = roomsReducer(state, Actions.roomUpserted({
      roomId: 1,
      info: mergedInfo,
      gametypeMap: existingRoom.gametypeMap,
      order: 0,
      preserveGamesAndUsers: true,
    }));

    expect(result.rooms[1].info).toBe(mergedInfo);
    expect(result.rooms[1].games[7]).toBe(existingGame);
    expect(result.rooms[1].users['alice']).toBe(existingUser);
  });

  it('writes a fresh entry (dropping games/users) when preserveGamesAndUsers is false even if room exists', () => {
    // Defensive shape: listener may dispatch this if it intends a clean replace
    // (no current call site does, but the primitive should be symmetric).
    const existingGame = makeGame({ gameId: 7 });
    const existingRoom = makeRoom({
      roomId: 1,
      games: { 7: existingGame },
      users: { alice: makeUser({ name: 'alice' }) },
    });
    const state = makeRoomsState({ rooms: { 1: existingRoom } });

    const info = create(Data.ServerInfo_RoomSchema, { roomId: 1, name: 'Replaced' });
    const result = roomsReducer(state, Actions.roomUpserted({
      roomId: 1,
      info,
      gametypeMap: {},
      order: 0,
      preserveGamesAndUsers: false,
    }));

    expect(result.rooms[1].info).toBe(info);
    expect(result.rooms[1].games).toEqual({});
    expect(result.rooms[1].users).toEqual({});
  });

  it('treats preserveGamesAndUsers=true on a missing room as a fresh insert', () => {
    // Defensive: room was deleted between listener dispatch and primitive
    // application. Fall through to fresh-insert shape rather than no-op,
    // since the listener's intent was to make the room exist.
    const state = makeRoomsState({ rooms: {} });
    const info = create(Data.ServerInfo_RoomSchema, { roomId: 99, name: 'Recovered' });

    const result = roomsReducer(state, Actions.roomUpserted({
      roomId: 99,
      info,
      gametypeMap: {},
      order: 0,
      preserveGamesAndUsers: true,
    }));

    expect(result.rooms[99]).toBeDefined();
    expect(result.rooms[99].info).toBe(info);
    expect(result.rooms[99].games).toEqual({});
    expect(result.rooms[99].users).toEqual({});
  });
});

describe('roomGameUpserted', () => {
  it('inserts a new game entry into the room’s keyed games map', () => {
    const room = makeRoom({ roomId: 1, games: {} });
    const state = makeRoomsState({ rooms: { 1: room } });
    const game = makeGame({ gameId: 7, description: 'fresh' });

    const result = roomsReducer(state, Actions.roomGameUpserted({
      roomId: 1,
      gameId: 7,
      game,
    }));

    expect(result.rooms[1].games[7]).toBe(game);
    expect(Object.keys(result.rooms[1].games)).toHaveLength(1);
  });

  it('overwrites an existing game entry (listener already resolved the merge)', () => {
    const oldGame = makeGame({ gameId: 7, description: 'old' });
    const room = makeRoom({ roomId: 1, games: { 7: oldGame } });
    const state = makeRoomsState({ rooms: { 1: room } });
    const merged = makeGame({ gameId: 7, description: 'merged' });

    const result = roomsReducer(state, Actions.roomGameUpserted({
      roomId: 1,
      gameId: 7,
      game: merged,
    }));

    expect(result.rooms[1].games[7]).toBe(merged);
  });

  it('preserves sibling games on insert', () => {
    const other = makeGame({ gameId: 5, description: 'untouched' });
    const room = makeRoom({ roomId: 1, games: { 5: other } });
    const state = makeRoomsState({ rooms: { 1: room } });
    const newGame = makeGame({ gameId: 9, description: 'added' });

    const result = roomsReducer(state, Actions.roomGameUpserted({
      roomId: 1,
      gameId: 9,
      game: newGame,
    }));

    expect(result.rooms[1].games[5]).toBe(other);
    expect(result.rooms[1].games[9]).toBe(newGame);
  });

  it('is a no-op when the target room is missing', () => {
    // Defensive: room may have been deleted between listener dispatch and
    // primitive application.
    const state = makeRoomsState({ rooms: {} });
    const game = makeGame({ gameId: 7 });

    const result = roomsReducer(state, Actions.roomGameUpserted({
      roomId: 999,
      gameId: 7,
      game,
    }));

    expect(result.rooms[999]).toBeUndefined();
  });
});

describe('roomGameRemoved', () => {
  it('deletes the game from the room’s keyed games map', () => {
    const game = makeGame({ gameId: 7 });
    const room = makeRoom({ roomId: 1, games: { 7: game } });
    const state = makeRoomsState({ rooms: { 1: room } });

    const result = roomsReducer(state, Actions.roomGameRemoved({
      roomId: 1,
      gameId: 7,
    }));

    expect(result.rooms[1].games[7]).toBeUndefined();
  });

  it('clears selectedGameIds[roomId] when it equals the removed gameId', () => {
    const game = makeGame({ gameId: 7 });
    const room = makeRoom({ roomId: 1, games: { 7: game } });
    const state = makeRoomsState({
      rooms: { 1: room },
      selectedGameIds: { 1: 7 },
    });

    const result = roomsReducer(state, Actions.roomGameRemoved({
      roomId: 1,
      gameId: 7,
    }));

    expect(result.selectedGameIds[1]).toBeUndefined();
  });

  it('preserves selectedGameIds[roomId] when it points at a different game', () => {
    const room = makeRoom({
      roomId: 1,
      games: { 7: makeGame({ gameId: 7 }), 9: makeGame({ gameId: 9 }) },
    });
    const state = makeRoomsState({
      rooms: { 1: room },
      selectedGameIds: { 1: 9 },
    });

    const result = roomsReducer(state, Actions.roomGameRemoved({
      roomId: 1,
      gameId: 7,
    }));

    expect(result.rooms[1].games[7]).toBeUndefined();
    expect(result.selectedGameIds[1]).toBe(9);
  });

  it('still clears the selection when the room itself is missing', () => {
    // Defensive: selectedGameIds is keyed independently of rooms and may
    // outlive the room entry. The selection clear runs regardless.
    const state = makeRoomsState({
      rooms: {},
      selectedGameIds: { 42: 7 },
    });

    const result = roomsReducer(state, Actions.roomGameRemoved({
      roomId: 42,
      gameId: 7,
    }));

    expect(result.selectedGameIds[42]).toBeUndefined();
  });
});
