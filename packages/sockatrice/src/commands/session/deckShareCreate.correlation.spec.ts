vi.mock('../../WebClient');

import { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { deckShareCreate } from './deckShareCreate';

const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendSessionCommand as Mock);

describe('deckShareCreate request identity', () => {
  it('carries the identity with out-of-order successes', () => {
    deckShareCreate({ name: 'A' }, 'request-a');
    const first = getLastSendOpts();
    deckShareCreate({ name: 'B' }, 'request-b');
    const second = getLastSendOpts();
    second.onSuccess({ token: 'token-b' });
    first.onSuccess({ token: 'token-a' });
    expect(WebClient.instance.response.session.deckShareCreated).toHaveBeenNthCalledWith(1, { token: 'token-b' }, 'request-b');
    expect(WebClient.instance.response.session.deckShareCreated).toHaveBeenNthCalledWith(2, { token: 'token-a' }, 'request-a');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'carries the identity with a late failure (%s)', (failure) => {
      deckShareCreate({ folderPath: 'folder-a' }, 'request-a');
      const first = getLastSendOpts();
      deckShareCreate({ folderPath: 'folder-b' }, 'request-b');
      first.onError(7, {}, failure);
      expect(WebClient.instance.response.session.commandFailed).toHaveBeenCalledWith(
        'deckShareCreate', 7, 'folder-a', failure, 'request-a',
      );
    },
  );
});
