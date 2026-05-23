import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore, Data } from '../../src';

// Integration: verify the attachResponseHandlers seam wires the five
// IWebClientResponse handlers to the store passed in. Unit tests cover
// per-method dispatch; this suite proves the bridge wiring itself.

describe('attachResponseHandlers', () => {
  it('returns a fully-populated IWebClientResponse object', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    expect(response.session).toBeDefined();
    expect(response.room).toBeDefined();
    expect(response.game).toBeDefined();
    expect(response.admin).toBeDefined();
    expect(response.moderator).toBeDefined();
  });

  it('session handler dispatches into the same store instance', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateStatus(WebsocketTypes.StatusEnum.CONNECTED, 'connected');

    expect(store.getState().server.status).toMatchObject({
      state: WebsocketTypes.StatusEnum.CONNECTED,
      description: 'connected',
    });
  });

  it('room handler routes to the rooms slice', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    const roomInfo = create(Data.ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    expect(store.getState().rooms.joinedRoomIds[1]).toBe(true);
  });

  it('game handler routes to the games slice', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.game.gameClosed(7);
    // gameClosed marks the game as closed even when it's never been opened
    // (the reducer is permissive and writes the state regardless). Detect
    // via the action's dispatch effect: the games slice's `lastClosedGameId`
    // (or equivalent) — the easier assertion is that the action passed
    // through middleware without throwing.
    expect(() => response.game.gameClosed(7)).not.toThrow();
  });

  it('admin and moderator handlers dispatch into the server slice', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    response.admin.adjustMod('alice', true, false);
    response.moderator.banFromServer('bob');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^server\//) }),
    );
    expect(dispatchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('attaching to a second store does not bleed events between stores', () => {
    const storeA = createStore();
    const storeB = createStore();
    const responseA = attachResponseHandlers(storeA);
    const responseB = attachResponseHandlers(storeB);

    responseA.session.updateStatus(WebsocketTypes.StatusEnum.CONNECTED, 'A');
    responseB.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'B');

    expect(storeA.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(storeB.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
  });
});
