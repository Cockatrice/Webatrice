vi.mock('../../WebClient');

import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { nextTurn } from './nextTurn';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendGameCommand as Mock, 3);

describe('nextTurn request identity', () => {
  it('echoes each same-game success identity without sending it over the wire', () => {
    nextTurn(7, 'first');
    const first = getLastSendOpts();
    nextTurn(7, 'second');
    const second = getLastSendOpts();
    for (const call of vi.mocked(WebClient.instance.protobuf.sendGameCommand).mock.calls) {
      expect(call[2]).not.toHaveProperty('requestId');
    }
    second.onSuccess();
    first.onSuccess();
    expect(WebClient.instance.response.game.nextTurnAnswered).toHaveBeenNthCalledWith(1, 7, 'second');
    expect(WebClient.instance.response.game.nextTurnAnswered).toHaveBeenNthCalledWith(2, 7, 'first');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'identifies a late failure %s after a newer same-game pass succeeds', (failure) => {
      nextTurn(7, 'first');
      const first = getLastSendOpts();
      nextTurn(7, 'second');
      getLastSendOpts().onSuccess();
      first.onError(7, {}, failure);
      expect(WebClient.instance.response.game.nextTurnAnswered).toHaveBeenCalledWith(7, 'second');
      expect(WebClient.instance.response.game.nextTurnFailed).toHaveBeenCalledWith(7, 7, failure, 'first');
    },
  );

  it('preserves callback arity when correlation is omitted', () => {
    nextTurn(7);
    getLastSendOpts().onSuccess();
    expect(WebClient.instance.response.game.nextTurnAnswered).toHaveBeenCalledWith(7);
    getLastSendOpts().onError(7, {}, undefined);
    expect(WebClient.instance.response.game.nextTurnFailed).toHaveBeenCalledWith(7, 7, undefined);
  });

  it('supports response implementations without next-turn callbacks', () => {
    const game = WebClient.instance.response.game;
    const { nextTurnAnswered, nextTurnFailed } = game;
    try {
      game.nextTurnAnswered = undefined;
      game.nextTurnFailed = undefined;
      nextTurn(7, 'request');
      expect(() => getLastSendOpts().onSuccess()).not.toThrow();
      expect(() => getLastSendOpts().onError(7, {}, CommandFailure.NotSent)).not.toThrow();
    } finally {
      game.nextTurnAnswered = nextTurnAnswered;
      game.nextTurnFailed = nextTurnFailed;
    }
  });
});
