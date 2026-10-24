import { create } from '@bufbuild/protobuf';
import { SessionCommands, WebClient } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import {
  buildGameEventMessage,
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  CLIENT_CONFIG,
  CLIENT_OPTIONS,
  connectRaw,
  deliverMessage,
  findLastSessionCommand,
  installMockWebSocket,
} from '@cockatrice/sockatrice/testing';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore, games, server } from '../../src';
import { makeServerState, makeUser } from '../../src/testing/fixtures/server';
import { ServerInfo_RoomSchema } from '@cockatrice/sockatrice/generated';

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

    const roomInfo = create(ServerInfo_RoomSchema, { roomId: 1, name: 'Main' });
    response.room.joinRoom(roomInfo);

    expect(store.getState().rooms.joinedRoomIds[1]).toBe(true);
  });

  it('admin and moderator handlers dispatch into the server slice', () => {
    const { IsRegistered, IsJudge, IsModerator } = Data.ServerInfo_User_UserLevelFlag;
    const alice = makeUser({ name: 'alice', userLevel: IsRegistered | IsJudge });
    const bob = makeUser({ name: 'bob', userLevel: IsRegistered });
    const store = createStore({
      preloadedState: { server: makeServerState({ users: { alice, bob }, userInfo: { alice } }) },
    });
    const before = store.getState().server;
    const response = attachResponseHandlers(store);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    try {
      response.admin.adjustMod('alice', true, false);
      response.moderator.banFromServer('bob');

      expect(dispatchSpy.mock.calls).toStrictEqual([
        [server.Actions.adjustMod({
          userName: 'alice', shouldBeMod: true, shouldBeJudge: false, shouldBeDeveloper: undefined, requestId: undefined,
        })],
        [server.Actions.banFromServer({ userName: 'bob' })],
      ]);
      const updatedAlice = makeUser({ name: 'alice', userLevel: IsRegistered | IsModerator });
      expect(store.getState().server).toEqual({
        ...before,
        users: { alice: updatedAlice, bob },
        userInfo: { alice: updatedAlice },
        banUser: 'bob',
      });
    } finally {
      dispatchSpy.mockRestore();
    }
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

describe('socket response bridge for playmats and latency', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    installMockWebSocket();
  });

  afterEach(() => {
    WebClient.dispose();
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  function connectStore(store = createStore()) {
    const client = new WebClient(attachResponseHandlers(store), CLIENT_CONFIG, CLIENT_OPTIONS);
    connectRaw();
    return { client, store };
  }

  function joinPlayer() {
    deliverMessage(buildSessionEventMessage(Data.Event_GameJoined_ext, create(Data.Event_GameJoinedSchema, {
      gameInfo: { gameId: 42, roomId: 1 }, playerId: 7, hostId: 7,
    })));
    deliverMessage(buildGameEventMessage({
      gameId: 42, ext: Data.Event_GameStateChanged_ext,
      value: create(Data.Event_GameStateChangedSchema, {
        playerList: [{ properties: { playerId: 7, userInfo: { name: 'Alice' } } }],
      }),
    }));
  }

  function announcePlaymat(playmatParams: Data.ServerInfo_PlayerProperties_PlaymatParams) {
    deliverMessage(buildGameEventMessage({
      gameId: 42, playerId: 7, ext: Data.Event_PlayerPropertiesChanged_ext,
      value: create(Data.Event_PlayerPropertiesChangedSchema, { playerProperties: { playerId: 7, playmatParams } }),
    }));
  }

  it('returns no playmat for an absent game, absent player, and a joined player without an announcement', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { store } = connectStore();
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toBeNull();
      joinPlayer();
      expect(store.getState().games.games[42].players[7].properties).toEqual(
        create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 7, userInfo: { name: 'Alice' } }),
      );
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 99)).toBeNull();
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toBeNull();
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it('clears an announced playmat when an empty card name arrives over the socket', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { store } = connectStore();
      joinPlayer();
      announcePlaymat(create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, {
        cardName: 'Island', cardProviderId: 'island-1', marginPctL: 0.25, marginPctR: 0.5, verticalOffset: 0.75, zoom: 2,
      }));
      expect(store.getState().games.games[42].players[7].properties.playmatParams).toEqual(
        create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, {
          cardName: 'Island', cardProviderId: 'island-1', marginPctL: 0.25, marginPctR: 0.5, verticalOffset: 0.75, zoom: 2,
        }),
      );
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toEqual({
        cardName: 'Island', cardProviderId: 'island-1',
        params: { marginPctL: 0.25, marginPctR: 0.5, verticalOffset: 0.75, zoom: 2 },
      });
      announcePlaymat(create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, { cardName: '' }));
      expect(store.getState().games.games[42].players[7].properties.playmatParams).toEqual(
        create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, { cardName: '' }),
      );
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toBeNull();
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it('defaults non-finite crop fields and clamps finite out-of-range fields received over the socket', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { store } = connectStore();
      joinPlayer();
      announcePlaymat(create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, {
        cardName: 'Forest', cardProviderId: 'forest-1',
        marginPctL: NaN, marginPctR: Infinity, verticalOffset: -Infinity, zoom: NaN,
      }));
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toEqual({
        cardName: 'Forest', cardProviderId: 'forest-1',
        params: { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 },
      });
      announcePlaymat(create(Data.ServerInfo_PlayerProperties_PlaymatParamsSchema, {
        cardName: 'Swamp', cardProviderId: 'swamp-1', marginPctL: 2, marginPctR: -1, verticalOffset: -4, zoom: 8,
      }));
      expect(games.Selectors.getPlayerPlaymat(store.getState(), 42, 7)).toEqual({
        cardName: 'Swamp', cardProviderId: 'swamp-1',
        params: { marginPctL: 0.95, marginPctR: 0, verticalOffset: 0, zoom: 4 },
      });
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it('selects a zero window from legacy state, then stores measured latency and clears it on disconnect', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = createStore({ preloadedState: { server: makeServerState({ latency: undefined }) } });
      expect(store.getState().server.latency).toBeUndefined();
      expect(server.Selectors.getLatency(store.getState())).toEqual({
        stats: { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, samplesMs: [],
      });
      const { client } = connectStore(store);
      const answered = vi.fn();
      SessionCommands.ping(answered);
      const ping = findLastSessionCommand(Data.Command_Ping_ext);
      expect({ ...ping.value }).toEqual({ $typeName: 'Command_Ping' });
      vi.advanceTimersByTime(25);
      deliverMessage(buildResponseMessage(buildResponse({ cmdId: ping.cmdId })));
      expect(answered.mock.calls).toEqual([[]]);
      expect(store.getState().server.latency).toEqual({
        stats: { lastMs: 25, medianMs: 25, p95Ms: 25, maxMs: 25, sampleCount: 1 }, samplesMs: [25],
      });
      expect(server.Selectors.getLatency(store.getState())).toEqual({
        stats: { lastMs: 25, medianMs: 25, p95Ms: 25, maxMs: 25, sampleCount: 1 }, samplesMs: [25],
      });
      client.disconnect();
      expect(store.getState().server.latency).toEqual({
        stats: { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, samplesMs: [],
      });
      expect(server.Selectors.getLatency(store.getState())).toEqual({
        stats: { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, samplesMs: [],
      });
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });
});
