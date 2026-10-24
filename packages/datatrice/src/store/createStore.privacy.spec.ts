vi.mock('@reduxjs/toolkit', { spy: true });

import { configureStore } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import { Response_DeckShareCreateSchema } from '@cockatrice/sockatrice/generated';
import { createStore } from './createStore';
import { Actions } from './server/server.actions';

beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
afterEach(() => vi.unstubAllEnvs());

function diagnostics() {
  createStore();
  const options = vi.mocked(configureStore).mock.calls.at(-1)![0].devTools;
  if (!options || typeof options !== 'object') {
    throw new Error('Diagnostic sanitizers are not configured');
  }
  return options;
}

describe('store diagnostics privacy', () => {
  it('disables Redux DevTools in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    createStore();
    expect(vi.mocked(configureStore).mock.calls.at(-1)![0].devTools).toBe(false);
  });

  it('redacts a protobuf share token without changing the action delivered to the app', () => {
    const { actionSanitizer } = diagnostics();
    const action = Actions.deckShareCreated({ share: create(Response_DeckShareCreateSchema, { token: 'secret-token' }) });
    const sanitized = actionSanitizer!(action, 0);
    expect(sanitized).toMatchObject({ payload: { share: { token: '[REDACTED]' } } });
    expect(action.payload.share.token).toBe('secret-token');
    expect(sanitized).not.toBe(action);
  });

  it.each(['deckShareList', 'deckShareDownload'] as const)('redacts the token target of %s failures', (command) => {
    const { actionSanitizer } = diagnostics();
    const action = Actions.sessionCommandFailed({ command, target: 'secret-token', responseCode: 7 });
    expect(actionSanitizer!(action, 0)).toMatchObject({ payload: { target: '[REDACTED]', command, responseCode: 7 } });
    expect(action.payload.target).toBe('secret-token');
  });

  it('keeps non-token failure targets useful', () => {
    const { actionSanitizer } = diagnostics();
    const action = Actions.sessionCommandFailed({ command: 'deckShareRemove', target: '42', responseCode: 7 });
    expect(actionSanitizer!(action, 0)).toEqual(action);
  });

  it.each([
    Actions.deckShareDownloaded({ token: 'secret-token', itemId: 1, deck: '<private-deck/>' }),
    Actions.publicDeckDownloaded({ deckId: 1, deck: '<private-deck/>' }),
    Actions.deckDownloaded({ deckId: 1, deck: '<private-deck/>' }),
  ])('redacts deck contents in $type diagnostic actions', (action) => {
    const { actionSanitizer } = diagnostics();
    const sanitized = actionSanitizer!(action, 0);
    expect(JSON.stringify(sanitized)).not.toContain('private-deck');
    expect(JSON.stringify(sanitized)).not.toContain('secret-token');
    expect(action.payload.deck).toBe('<private-deck/>');
  });

  it('redacts deck contents in state exports without changing live state', () => {
    const original = {
      server: { downloadedDeck: { deckId: 1, deck: '<private-deck/>' } },
      games: { entries: [{ deckList: '<private-deck/>', gameId: 1 }] },
    };
    const store = createStore({ reducer: () => original });
    const options = vi.mocked(configureStore).mock.calls.at(-1)![0].devTools;
    expect(options).toEqual(expect.objectContaining({ stateSanitizer: expect.any(Function) }));
    if (!options || typeof options !== 'object') {
      throw new Error('State sanitizer is not configured');
    }
    const exported = options.stateSanitizer!(store.getState(), 0);
    expect(exported).toEqual({
      server: { downloadedDeck: { deckId: 1, deck: '[REDACTED]' } },
      games: { entries: [{ deckList: '[REDACTED]', gameId: 1 }] },
    });
    expect(store.getState()).toBe(original);
    expect(original.server.downloadedDeck.deck).toBe('<private-deck/>');
    expect(original.games.entries[0].deckList).toBe('<private-deck/>');
  });
});
