import '@cockatrice/sockatrice/testing/setup-hooks';
import { create } from '@bufbuild/protobuf';
import { GameCommands } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  buildResponse,
  buildResponseMessage,
  connectAndLogin,
  deliverMessage,
  findLastGameCommand,
  getMockWebSocket,
  getWebClient,
} from '@cockatrice/sockatrice/testing';

import { attachResponseHandlers, createStore } from '../../src';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeState } from '../../src/testing/fixtures/games';

function lobbyState(localPlayerId: number, deckList = 'previous deck') {
  return makeState({
    games: {
      7: makeGameEntry({
        localPlayerId,
        players: {
          1: makePlayerEntry({ deckList }),
          2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2 }), deckList: 'other player deck' }),
        },
      }),
    },
  });
}

function setup(localPlayerId = 1) {
  connectAndLogin();
  const store = createStore({ preloadedState: { games: lobbyState(localPlayerId) } });
  getWebClient().response.game = attachResponseHandlers(store).game;
  getMockWebSocket().send.mockClear();
  return store;
}

function selectDeck(gameId: number, ...correlation: [requestId?: string]) {
  GameCommands.deckSelect(gameId, { deckId: 9 }, ...correlation);
  expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
  const command = findLastGameCommand(Data.Command_DeckSelect_ext);
  expect(command.gameId).toBe(gameId);
  expect({ ...command.value }).toEqual({ $typeName: 'Command_DeckSelect', deckId: 9 });
  return command.cmdId;
}

function succeed(cmdId: number, deck: string) {
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId,
    responseCode: Data.Response_ResponseCode.RespOk,
    ext: Data.Response_DeckDownload_ext,
    value: create(Data.Response_DeckDownloadSchema, { deck }),
  })));
}

describe('deck selection responses through the socket and store', () => {
  it('replaces only the local deck with the server response, including an empty deck', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error');
    try {
      expect(store.getState().games).toEqual(lobbyState(1, 'previous deck'));
      const cmdId = selectDeck(7, 'pick-empty');
      succeed(cmdId, '');
      expect(dispatch.mock.calls).toEqual([[
        { type: 'games/deckSelected', payload: { gameId: 7, deckList: '', requestId: 'pick-empty' } },
      ]]);
      expect(store.getState().games).toEqual(lobbyState(1, ''));
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });

  it.each([
    { name: 'game is unknown', gameId: 99, localPlayerId: 1 },
    { name: 'local player has left', gameId: 7, localPlayerId: 3 },
  ])('ignores the returned deck when the $name', ({ gameId, localPlayerId }) => {
    const store = setup(localPlayerId);
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error');
    try {
      expect(store.getState().games).toEqual(lobbyState(localPlayerId, 'previous deck'));
      const cmdId = selectDeck(gameId);
      succeed(cmdId, 'returned deck');
      expect(dispatch.mock.calls).toEqual([[
        { type: 'games/deckSelected', payload: { gameId, deckList: 'returned deck', requestId: undefined } },
      ]]);
      expect(store.getState().games).toEqual(lobbyState(localPlayerId, 'previous deck'));
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });

  it('reports a server rejection with its request identity and retains the selected deck', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error');
    try {
      expect(store.getState().games).toEqual(lobbyState(1, 'previous deck'));
      const cmdId = selectDeck(7, 'pick-rejected');
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespInvalidData })));
      expect(dispatch.mock.calls).toEqual([[
        {
          type: 'games/deckSelectFailed',
          payload: { gameId: 7, responseCode: Data.Response_ResponseCode.RespInvalidData, failure: undefined, requestId: 'pick-rejected' },
        },
      ]]);
      expect(store.getState().games).toEqual(lobbyState(1, 'previous deck'));
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });

  it('reports an unsent legacy selection with the transport reason and retains the selected deck', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error');
    try {
      expect(store.getState().games).toEqual(lobbyState(1, 'previous deck'));
      getMockWebSocket().readyState = WebSocket.CLOSED;
      GameCommands.deckSelect(7, { deck: 'replacement deck' });
      expect(getMockWebSocket().send.mock.calls).toEqual([]);
      expect(dispatch.mock.calls).toEqual([[
        {
          type: 'games/deckSelectFailed',
          payload: {
            gameId: 7,
            responseCode: Data.Response_ResponseCode.RespNotConnected,
            failure: WebsocketTypes.CommandFailure.NotSent,
            requestId: undefined,
          },
        },
      ]]);
      expect(store.getState().games).toEqual(lobbyState(1, 'previous deck'));
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });
});
