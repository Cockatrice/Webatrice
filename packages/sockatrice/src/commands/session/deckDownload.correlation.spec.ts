vi.mock('../../WebClient');

import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { deckDownload } from './deckDownload';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendSessionCommand as Mock);

describe('deckDownload request identity', () => {
  it('echoes the originating id when same-deck replies arrive out of order', () => {
    deckDownload(7, 'first');
    const first = getLastSendOpts();
    deckDownload(7, 'second');
    const second = getLastSendOpts();
    second.onSuccess({ deck: 'new' });
    first.onSuccess({ deck: 'old' });
    expect(WebClient.instance.response.session.downloadServerDeck).toHaveBeenNthCalledWith(1, 7, { deck: 'new' }, 'second');
    expect(WebClient.instance.response.session.downloadServerDeck).toHaveBeenNthCalledWith(2, 7, { deck: 'old' }, 'first');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'echoes the identity for failure %s', (failure) => {
      deckDownload(7, 'request');
      getLastSendOpts().onError(7, {}, failure);
      expect(WebClient.instance.response.session.deckDownloadFailed).toHaveBeenCalledWith(7, 7, failure, 'request');
    },
  );

  it('preserves response arity when correlation is omitted', () => {
    deckDownload(7);
    getLastSendOpts().onSuccess({ deck: 'legacy' });
    expect(WebClient.instance.response.session.downloadServerDeck).toHaveBeenCalledWith(7, { deck: 'legacy' });
    getLastSendOpts().onError(7, {}, undefined);
    expect(WebClient.instance.response.session.deckDownloadFailed).toHaveBeenCalledWith(7, 7, undefined);
  });
});
