import { create, setExtension } from '@bufbuild/protobuf';
import { WebClient } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import {
  buildGameEventMessage,
  CLIENT_CONFIG,
  CLIENT_OPTIONS,
  installMockWebSocketHarness,
} from '@cockatrice/sockatrice/testing';

import { attachResponseHandlers, createStore } from '../../src';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeState, makeZoneEntry } from '../../src/testing';

const LIVE_GAME_ID = 42;
const REPLAY_GAME_ID = -1000;
const PLAYER_ID = 3;
const REPLAY_CARD_ID = 17;
const LIVE_CARD_ID = 9;
const REPLAY_SECONDS = 12;
const FIRST_POSITION = 0;

function liveReveal() {
  return {
    gameId: LIVE_GAME_ID,
    sourceOwnerId: PLAYER_ID,
    zoneName: 'hand',
    cards: [create(Data.ServerInfo_CardSchema, { id: LIVE_CARD_ID, name: 'Mountain' })],
    grantWriteAccess: true,
  };
}

function replayReveal(gameId = REPLAY_GAME_ID) {
  return {
    gameId,
    sourceOwnerId: PLAYER_ID,
    zoneName: 'hand',
    cards: [create(Data.ServerInfo_CardSchema, { id: REPLAY_CARD_ID, name: 'Island' })],
    grantWriteAccess: false,
  };
}

function setup() {
  const socket = installMockWebSocketHarness();
  const player = () => makePlayerEntry({
    properties: makePlayerProperties({ playerId: PLAYER_ID, userInfo: { name: 'Alice' } }),
    zones: {
      hand: makeZoneEntry({
        name: 'hand',
        cards: [create(Data.ServerInfo_CardSchema, { id: REPLAY_CARD_ID })],
        cardCount: 1,
      }),
    },
  });
  const store = createStore({
    preloadedState: {
      games: makeState({
        games: {
          [LIVE_GAME_ID]: makeGameEntry({ players: { [PLAYER_ID]: player() } }),
          [REPLAY_GAME_ID]: makeGameEntry({ replay: true, players: { [PLAYER_ID]: player() } }),
        },
      }),
    },
  });
  const client = new WebClient(attachResponseHandlers(store), CLIENT_CONFIG, CLIENT_OPTIONS);
  const event = create(Data.GameEventSchema, { playerId: PLAYER_ID });
  setExtension(event, Data.Event_RevealCards_ext, create(Data.Event_RevealCardsSchema, {
    zoneName: 'hand', cards: [{ id: REPLAY_CARD_ID, name: 'Island' }],
  }));
  const container = create(Data.GameEventContainerSchema, {
    gameId: LIVE_GAME_ID, secondsElapsed: REPLAY_SECONDS, eventList: [event],
  });
  client.connect({ host: 'localhost', port: '4748' });
  socket.mockInstance.onopen!(new Event('open'));
  const deliverLiveReveal = () => {
    const binary = buildGameEventMessage({
      gameId: LIVE_GAME_ID,
      playerId: PLAYER_ID,
      ext: Data.Event_RevealCards_ext,
      value: create(Data.Event_RevealCardsSchema, {
        zoneName: 'hand', cards: [{ id: LIVE_CARD_ID, name: 'Mountain' }], grantWriteAccess: true,
      }),
    });
    socket.mockInstance.onmessage!({ data: binary.buffer } as MessageEvent);
  };
  return { client, container, store, socket, deliverLiveReveal };
}

function expectRecordedReveal(store: ReturnType<typeof setup>['store']) {
  const game = store.getState().games.games[REPLAY_GAME_ID];
  expect(game.messages.map(({ message, gameSeconds }) => ({ message, gameSeconds }))).toEqual([
    { message: 'Alice reveals their hand.', gameSeconds: REPLAY_SECONDS },
  ]);
  expect(game.players[PLAYER_ID].zones.hand.byId).toEqual({
    [REPLAY_CARD_ID]: create(Data.ServerInfo_CardSchema, { id: REPLAY_CARD_ID, name: 'Island' }),
  });
  expect(game.players[PLAYER_ID].zones.hand.revealedCards).toEqual([
    create(Data.ServerInfo_CardSchema, { id: FIRST_POSITION, name: 'Island' }),
  ]);
  expect(game.players[PLAYER_ID].zones.hand.revealedIsReversed).toBe(false);
}

describe('replay reveals through the WebClient and store', () => {
  it.each([undefined, {}, { skipRevealWindow: false }])(
    'playback with options %j replaces the live reveal dialog',
    (options) => {
      const { client, container, store, socket, deliverLiveReveal } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        deliverLiveReveal();
        expect(store.getState().games.incomingReveal).toEqual(liveReveal());

        client.replayGameEventContainer(container, REPLAY_GAME_ID, options);

        expect(store.getState().games.incomingReveal).toEqual(replayReveal());
        expectRecordedReveal(store);
        expect(socket.mockInstance.send.mock.calls).toEqual([]);
        expect(errorSpy.mock.calls).toEqual([]);
      } finally {
        WebClient.dispose();
        socket.restore();
        errorSpy.mockRestore();
      }
    },
  );

  it('seeking preserves the live dialog while recording the reveal, and subsequent playback shows it', () => {
    const { client, container, store, socket, deliverLiveReveal } = setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      deliverLiveReveal();
      expect(store.getState().games.incomingReveal).toEqual(liveReveal());

      client.replayGameEventContainer(container, REPLAY_GAME_ID, { skipRevealWindow: true });

      expect(store.getState().games.incomingReveal).toEqual(liveReveal());
      expectRecordedReveal(store);

      client.replayGameEventContainer(container, REPLAY_GAME_ID);

      expect(store.getState().games.incomingReveal).toEqual(replayReveal());
      deliverLiveReveal();
      expect(store.getState().games.incomingReveal).toEqual(liveReveal());
      expect(socket.mockInstance.send.mock.calls).toEqual([]);
      expect(errorSpy.mock.calls).toEqual([]);
    } finally {
      WebClient.dispose();
      socket.restore();
      errorSpy.mockRestore();
    }
  });

  it('does not suppress a live game reveal when skipRevealWindow is true', () => {
    const { client, container, store, socket, deliverLiveReveal } = setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      deliverLiveReveal();
      expect(store.getState().games.incomingReveal).toEqual(liveReveal());

      client.replayGameEventContainer(container, LIVE_GAME_ID, { skipRevealWindow: true });

      expect(store.getState().games.incomingReveal).toEqual(replayReveal(LIVE_GAME_ID));
      expect(socket.mockInstance.send.mock.calls).toEqual([]);
      expect(errorSpy.mock.calls).toEqual([]);
    } finally {
      WebClient.dispose();
      socket.restore();
      errorSpy.mockRestore();
    }
  });
});
