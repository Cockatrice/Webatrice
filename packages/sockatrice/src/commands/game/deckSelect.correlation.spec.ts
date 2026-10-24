vi.mock('../../WebClient');

import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { deckSelect } from './deckSelect';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendGameCommand as Mock, 3);

describe('deckSelect request identity', () => {
  it('echoes each same-game success identity without sending it over the wire', () => {
    deckSelect(7, { deckId: 1 }, 'first');
    const first = getLastSendOpts();
    deckSelect(7, { deckId: 2 }, 'second');
    const second = getLastSendOpts();
    for (const call of vi.mocked(WebClient.instance.protobuf.sendGameCommand).mock.calls) {
      expect(call[2]).not.toHaveProperty('requestId');
    }
    second.onSuccess({ deck: 'new' });
    first.onSuccess({ deck: 'old' });
    expect(WebClient.instance.response.game.deckSelected).toHaveBeenNthCalledWith(1, 7, 'new', 'second');
    expect(WebClient.instance.response.game.deckSelected).toHaveBeenNthCalledWith(2, 7, 'old', 'first');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'identifies a late failure %s after a newer same-game pick succeeds', (failure) => {
      deckSelect(7, { deckId: 1 }, 'first');
      const first = getLastSendOpts();
      deckSelect(7, { deckId: 2 }, 'second');
      getLastSendOpts().onSuccess({ deck: 'new' });
      first.onError(7, {}, failure);
      expect(WebClient.instance.response.game.deckSelected).toHaveBeenCalledWith(7, 'new', 'second');
      expect(WebClient.instance.response.game.deckSelectFailed).toHaveBeenCalledWith(7, 7, failure, 'first');
    },
  );

  it('preserves callback arity when correlation is omitted', () => {
    deckSelect(7, { deck: 'legacy' });
    getLastSendOpts().onSuccess({ deck: 'legacy' });
    expect(WebClient.instance.response.game.deckSelected).toHaveBeenCalledWith(7, 'legacy');
    getLastSendOpts().onError(7, {}, undefined);
    expect(WebClient.instance.response.game.deckSelectFailed).toHaveBeenCalledWith(7, 7, undefined);
  });
});
