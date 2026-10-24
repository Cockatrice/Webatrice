vi.mock('../../WebClient');

import { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { deckUpload } from './deckUpload';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendSessionCommand as Mock);

describe('deckUpload request identity', () => {
  it('carries the request identity even when the server replaces the name', () => {
    deckUpload('', 0, '<deck/>', undefined, undefined, 'import-a');
    const first = getLastSendOpts();
    deckUpload('', 0, '<deck/>', undefined, undefined, 'import-b');
    const second = getLastSendOpts();
    second.onSuccess({ newFile: { id: 2, name: 'Unnamed deck' } });
    first.onSuccess({ newFile: { id: 1, name: 'Unnamed deck' } });
    expect(WebClient.instance.response.session.uploadServerDeck).toHaveBeenNthCalledWith(
      1, '', { id: 2, name: 'Unnamed deck' }, 'import-b',
    );
    expect(WebClient.instance.response.session.uploadServerDeck).toHaveBeenNthCalledWith(
      2, '', { id: 1, name: 'Unnamed deck' }, 'import-a',
    );
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'carries the request identity on failure (%s)', (failure) => {
      deckUpload('', 0, '<deck/>', undefined, undefined, 'import-a');
      getLastSendOpts().onError(7, {}, failure);
      expect(WebClient.instance.response.session.deckUploadFailed).toHaveBeenCalledWith('', 7, failure, 'import-a');
    },
  );
});
