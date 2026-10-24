vi.mock('../../WebClient');

import { create } from '@bufbuild/protobuf';
import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { ServerInfo_ReplayMatchSchema } from '../../generated';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { replayList } from './replayList';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendSessionCommand as Mock);

describe('replayList request identity', () => {
  it('echoes each originating id when list replies arrive out of order', () => {
    const oldMatches = [create(ServerInfo_ReplayMatchSchema, { gameId: 1 })];
    const newMatches = [create(ServerInfo_ReplayMatchSchema, { gameId: 2 })];
    replayList('first');
    const first = getLastSendOpts();
    replayList('second');
    const second = getLastSendOpts();

    second.onSuccess({ matchList: newMatches });
    first.onSuccess({ matchList: oldMatches });

    expect(WebClient.instance.response.session.replayList).toHaveBeenNthCalledWith(1, newMatches, 'second');
    expect(WebClient.instance.response.session.replayList).toHaveBeenNthCalledWith(2, oldMatches, 'first');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'keeps an older failure %s tied to its own request', (failure) => {
      replayList('first');
      const first = getLastSendOpts();
      replayList('second');
      getLastSendOpts().onSuccess({ matchList: [] });
      first.onError(7, {}, failure);

      expect(WebClient.instance.response.session.replayListFailed).toHaveBeenCalledWith(7, failure, 'first');
    },
  );

  it('preserves callback arity when correlation is omitted', () => {
    replayList();
    getLastSendOpts().onSuccess({ matchList: [] });
    expect(WebClient.instance.response.session.replayList).toHaveBeenCalledWith([]);
    getLastSendOpts().onError(7, {}, undefined);
    expect(WebClient.instance.response.session.replayListFailed).toHaveBeenCalledWith(7, undefined);
  });
});
