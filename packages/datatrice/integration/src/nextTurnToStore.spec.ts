import '@cockatrice/sockatrice/testing/setup-hooks';
import { create, setExtension } from '@bufbuild/protobuf';
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
import { describe, expect, it, vi } from 'vitest';
import { attachResponseHandlers, createStore, games } from '../../src';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeState } from '../../src/testing/fixtures/games';

function turnState() {
  return makeState({
    games: {
      42: makeGameEntry({
        info: create(Data.ServerInfo_GameSchema, { gameId: 42, roomId: 3, description: 'Turn actions' }),
        localPlayerId: 4,
        hostId: 9,
        started: true,
        activePlayerId: 9,
        activePhase: 4,
        reversed: true,
        players: {
          4: makePlayerEntry({ properties: makePlayerProperties({ playerId: 4, userInfo: { name: 'Alice' } }) }),
          9: makePlayerEntry({ properties: makePlayerProperties({ playerId: 9, userInfo: { name: 'Bob' } }) }),
        },
      }),
    },
  });
}

function setup() {
  connectAndLogin();
  const store = createStore({ preloadedState: { games: turnState() } });
  getWebClient().response.game = attachResponseHandlers(store).game;
  getMockWebSocket().send.mockClear();
  expect(store.getState().games).toEqual(turnState());
  return store;
}

function sendNextTurn(...correlation: [requestId?: string]): number {
  GameCommands.nextTurn(42, ...correlation);
  const { container, value, cmdId } = findLastGameCommand(Data.Command_NextTurn_ext);
  expect({ ...value }).toEqual({ $typeName: Data.Command_NextTurnSchema.typeName });
  const command = create(Data.GameCommandSchema);
  setExtension(command, Data.Command_NextTurn_ext, create(Data.Command_NextTurnSchema));
  expect(container).toEqual(create(Data.CommandContainerSchema, {
    cmdId: BigInt(cmdId), gameId: 42, gameCommand: [command],
  }));
  return cmdId;
}

function answer(cmdId: number, responseCode: Data.Response_ResponseCode): void {
  deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
}

describe('next-turn transport outcomes to the store', () => {
  it('dispatches reordered correlated outcomes without changing event-owned game state', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = sendNextTurn('turn-a');
      const second = sendNextTurn('turn-b');
      const third = sendNextTurn('turn-c');
      expect(new Set([first, second, third]).size).toBe(3);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(3);

      answer(second, Data.Response_ResponseCode.RespOk);
      expect(store.getState().games).toEqual(turnState());
      answer(third, Data.Response_ResponseCode.RespContextError);
      expect(store.getState().games).toEqual(turnState());
      answer(first, Data.Response_ResponseCode.RespOk);

      expect(dispatch.mock.calls).toEqual([
        [games.Actions.nextTurnAnswered({ gameId: 42, requestId: 'turn-b' })],
        [games.Actions.nextTurnFailed({
          gameId: 42, responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined, requestId: 'turn-c',
        })],
        [games.Actions.nextTurnAnswered({ gameId: 42, requestId: 'turn-a' })],
      ]);
      expect(store.getState().games).toEqual(turnState());
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });

  it('dispatches uncorrelated success and server rejection without advancing or resetting the turn', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      answer(sendNextTurn(), Data.Response_ResponseCode.RespOk);
      expect(store.getState().games).toEqual(turnState());
      answer(sendNextTurn(), Data.Response_ResponseCode.RespContextError);

      expect(getMockWebSocket().send.mock.calls).toHaveLength(2);
      expect(dispatch.mock.calls).toEqual([
        [games.Actions.nextTurnAnswered({ gameId: 42, requestId: undefined })],
        [games.Actions.nextTurnFailed({
          gameId: 42, responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined, requestId: undefined,
        })],
      ]);
      expect(store.getState().games).toEqual(turnState());
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });

  it('dispatches the transport failure reason and request identity when the socket cannot send', () => {
    const store = setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getMockWebSocket().readyState = WebSocket.CLOSED;
      GameCommands.nextTurn(42, 'unsent-turn');

      expect(getMockWebSocket().send.mock.calls).toEqual([]);
      expect(dispatch.mock.calls).toEqual([
        [games.Actions.nextTurnFailed({
          gameId: 42,
          responseCode: Data.Response_ResponseCode.RespNotConnected,
          failure: WebsocketTypes.CommandFailure.NotSent,
          requestId: 'unsent-turn',
        })],
      ]);
      expect(store.getState().games).toEqual(turnState());
      expect(error.mock.calls).toEqual([]);
    } finally {
      dispatch.mockRestore();
      error.mockRestore();
    }
  });
});
