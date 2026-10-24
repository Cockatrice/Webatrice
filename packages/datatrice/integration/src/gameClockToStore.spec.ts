import { create, fromBinary, setExtension, toBinary } from '@bufbuild/protobuf';
import { WebClient } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import {
  buildGameEventMessage,
  buildSessionEventMessage,
  installMockWebSocketHarness,
} from '@cockatrice/sockatrice/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachResponseHandlers, createStore } from '../../src';

describe('game clocks through the WebClient and store', () => {
  let store: ReturnType<typeof createStore>;
  let client: WebClient;
  let socket: ReturnType<typeof installMockWebSocketHarness>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    socket = installMockWebSocketHarness();
    store = createStore();
    client = new WebClient(
      attachResponseHandlers(store),
      { clientid: 'clock-test', clientver: '1', clientfeatures: [] },
      { autojoinrooms: false, keepalive: 5_000 },
    );
    client.connect({ host: 'localhost', port: '4748' });
    socket.mockInstance.onopen?.(new Event('open'));
  });

  afterEach(() => {
    WebClient.dispose();
    socket.restore();
    vi.useRealTimers();
  });

  function deliver(bytes: Uint8Array): void {
    socket.mockInstance.onmessage?.({ data: bytes.buffer } as MessageEvent);
  }

  function chat(message: string): Data.GameEvent {
    const event = create(Data.GameEventSchema, { playerId: 7 });
    setExtension(event, Data.Event_GameSay_ext, create(Data.Event_GameSaySchema, { message }));
    return event;
  }

  function replay(eventList: Data.GameEvent[], secondsElapsed?: number, gameId = -1001): void {
    const container = create(Data.GameEventContainerSchema, { eventList });
    if (secondsElapsed !== undefined) {
      container.secondsElapsed = secondsElapsed;
    }
    client.replayGameEventContainer(
      fromBinary(Data.GameEventContainerSchema, toBinary(Data.GameEventContainerSchema, container)),
      gameId,
    );
  }

  it('timestamps replay events from their container, ignores snapshot time, and can rewind the clock to zero', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      client.loadReplayGame(-1001, create(Data.ServerInfo_GameSchema, { gameId: 77 }));
      expect(store.getState().games.games[-1001].secondsElapsed).toBe(0);
      expect(store.getState().games.games[-1001].secondsElapsedAt).toBeUndefined();
      expect(store.getState().games.games[-1001].messages.map(message => message.message))
        .toEqual(['You are watching a replay of game #77.']);

      const snapshot = create(Data.GameEventSchema, { playerId: -1 });
      setExtension(snapshot, Data.Event_GameStateChanged_ext, create(Data.Event_GameStateChangedSchema, {
        secondsElapsed: 4_000,
        activePhase: 3,
      }));
      const closed = create(Data.GameEventSchema, { playerId: -1 });
      setExtension(closed, Data.Event_GameClosed_ext, create(Data.Event_GameClosedSchema));
      vi.setSystemTime(9_000);
      replay([snapshot, chat('Later in the recording'), closed], 95);

      expect(store.getState().games.games[-1001].secondsElapsed).toBe(95);
      expect(store.getState().games.games[-1001].secondsElapsedAt).toBe(9_000);
      expect(store.getState().games.games[-1001].activePhase).toBe(3);

      vi.setSystemTime(12_000);
      replay([chat('Back at the start')], 0);
      expect(store.getState().games.games[-1001].secondsElapsed).toBe(0);
      expect(store.getState().games.games[-1001].secondsElapsedAt).toBe(12_000);

      vi.setSystemTime(13_900);
      replay([chat('No recorded timestamp')]);
      expect(store.getState().games.games[-1001].secondsElapsed).toBe(0);
      expect(store.getState().games.games[-1001].secondsElapsedAt).toBe(12_000);
      expect(store.getState().games.games[-1001].messages.slice(1)).toEqual([
        {
          playerId: 7, message: 'Later in the recording', timeReceived: 9_000,
          gameSeconds: 95, kind: 'chat', senderName: undefined,
        },
        {
          playerId: -1, message: 'The game has been closed.', timeReceived: 9_000,
          gameSeconds: 95, kind: 'event', segments: [{ text: 'The game has been closed.', kind: 'plain' }],
          descriptor: { kind: 'gameClosed', params: {} },
        },
        {
          playerId: 7, message: 'Back at the start', timeReceived: 12_000,
          gameSeconds: 0, kind: 'chat', senderName: undefined,
        },
        {
          playerId: 7, message: 'No recorded timestamp', timeReceived: 13_900,
          gameSeconds: 1, kind: 'chat', senderName: undefined,
        },
      ]);
      expect(socket.mockInstance.send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('ignores a recorded clock for a local game that has not been loaded', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      replay([], 95);

      expect(store.getState().games).toEqual({ games: {}, pings: {}, incomingReveal: null });
      expect(socket.mockInstance.send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('timestamps live chat from the latest server clock and preserves its anchor when a snapshot omits time', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      deliver(buildSessionEventMessage(Data.Event_GameJoined_ext, create(Data.Event_GameJoinedSchema, {
        gameInfo: create(Data.ServerInfo_GameSchema, { gameId: 42 }),
        playerId: 7,
      })));
      deliver(buildGameEventMessage({
        gameId: 42, playerId: 7, ext: Data.Event_GameSay_ext,
        value: create(Data.Event_GameSaySchema, { message: 'Before clock sync' }),
      }));
      deliver(buildGameEventMessage({
        gameId: 42, ext: Data.Event_GameStateChanged_ext,
        value: create(Data.Event_GameStateChangedSchema, { secondsElapsed: 60 }),
      }));
      expect(store.getState().games.games[42].secondsElapsed).toBe(60);
      expect(store.getState().games.games[42].secondsElapsedAt).toBe(5_000);

      vi.setSystemTime(8_900);
      deliver(buildGameEventMessage({
        gameId: 42, ext: Data.Event_GameStateChanged_ext,
        value: create(Data.Event_GameStateChangedSchema, { activePhase: 2 }),
      }));
      deliver(buildGameEventMessage({
        gameId: 42, playerId: 7, ext: Data.Event_GameSay_ext,
        value: create(Data.Event_GameSaySchema, { message: 'After clock sync' }),
      }));

      expect(store.getState().games.games[42].secondsElapsed).toBe(60);
      expect(store.getState().games.games[42].secondsElapsedAt).toBe(5_000);
      expect(store.getState().games.games[42].activePhase).toBe(2);
      expect(store.getState().games.games[42].messages).toEqual([
        {
          playerId: 7, message: 'Before clock sync', timeReceived: 5_000,
          gameSeconds: 0, kind: 'chat', senderName: undefined,
        },
        {
          playerId: 7, message: 'After clock sync', timeReceived: 8_900,
          gameSeconds: 63, kind: 'chat', senderName: undefined,
        },
      ]);
      expect(socket.mockInstance.send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
});
