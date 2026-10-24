import { compose } from 'redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

type DevToolsOptions = {
  actionSanitizer?: (action: unknown, id: number) => unknown;
  stateSanitizer?: (state: unknown, id: number) => unknown;
};

const browserWindow = window as typeof window & {
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: (options: DevToolsOptions) => typeof compose;
};
const originalDevToolsCompose = browserWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;

afterEach(() => {
  if (originalDevToolsCompose) {
    browserWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = originalDevToolsCompose;
  } else {
    delete browserWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('store diagnostic privacy', () => {
  it('passes complete sanitizers to the Redux DevTools hook without changing live values', async () => {
    const devToolsHook = vi.fn((_options: DevToolsOptions) => compose);
    browserWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = devToolsHook;
    vi.resetModules();
    const [{ createStore }, { Actions }] = await Promise.all([
      import('../../src/store/createStore'),
      import('../../src/store/server/server.actions'),
    ]);
    const store = createStore();
    expect(devToolsHook.mock.calls).toHaveLength(1);
    const options = devToolsHook.mock.calls[0][0];
    expect(options).toEqual({
      trace: true,
      actionSanitizer: expect.any(Function),
      stateSanitizer: expect.any(Function),
    });

    const action = Actions.sessionCommandFailed({
      command: 'deckShareDownload',
      target: 'secret-token',
      responseCode: 7,
    });
    store.dispatch(action);
    expect(options.actionSanitizer!(action, 1)).toEqual({
      type: 'server/sessionCommandFailed',
      payload: {
        command: 'deckShareDownload',
        target: '[REDACTED]',
        responseCode: 7,
      },
    });
    expect(action.payload.target).toBe('secret-token');

    store.dispatch(Actions.deckDownloaded({ deckId: 2, deck: '<stored-private/>' }));
    const liveState = store.getState();
    const exportedState = options.stateSanitizer!(liveState, 1) as typeof liveState;
    expect(exportedState.server.downloadedDeck).toEqual({ deckId: 2, deck: '[REDACTED]' });
    expect(liveState.server.downloadedDeck).toEqual({ deckId: 2, deck: '<stored-private/>' });

    const bytes = new Uint8Array([1, 2]);
    const diagnosticState = {
      nullValue: null,
      text: 'visible',
      bytes,
      shares: [{ token: 'token-a', $unknown: 'wire-secret' }],
      listFailure: { command: 'deckShareList', target: 'token-b' },
      unrelatedFailure: { command: 'deckShareRemove', target: '4' },
      download: { deck: '<private/>', deckList: '<private-list/>' },
      structuredDeck: { deck: { name: 'visible' } },
    };
    expect(options.stateSanitizer!(diagnosticState, 1)).toEqual({
      nullValue: null,
      text: 'visible',
      bytes,
      shares: [{ token: '[REDACTED]', $unknown: '[REDACTED]' }],
      listFailure: { command: 'deckShareList', target: '[REDACTED]' },
      unrelatedFailure: { command: 'deckShareRemove', target: '4' },
      download: { deck: '[REDACTED]', deckList: '[REDACTED]' },
      structuredDeck: { deck: { name: 'visible' } },
    });
    expect(diagnosticState.shares[0]).toEqual({ token: 'token-a', $unknown: 'wire-secret' });
    expect(diagnosticState.download).toEqual({ deck: '<private/>', deckList: '<private-list/>' });
  });

  it('does not connect a production store to Redux DevTools', async () => {
    const devToolsHook = vi.fn((_options: DevToolsOptions) => compose);
    browserWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = devToolsHook;
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { createStore } = await import('../../src/store/createStore');
    const store = createStore<{ value: number }>({ reducer: (state = { value: 1 }) => state });
    expect(store.getState()).toEqual({ value: 1 });
    expect(devToolsHook.mock.calls).toEqual([]);
  });
});
