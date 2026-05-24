import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { useStore } from 'react-redux';
import { createSlice, type Reducer } from '@reduxjs/toolkit';
import { WebClient } from '@cockatrice/sockatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { 
  DatatriceProvider,
  WebClientProvider,
  useWebClient,
  useAppDispatch,
  useAppSelector,
  createTypedHooks,
} from '../../src/react';
import { createStore, rootReducer, server, type RootState } from '../../src';

// Integration: mount the full React binding layer — DatatriceProvider +
// WebClientProvider + the typed hooks — over a real store and a real
// Sockatrice WebClient. Unlike the unit specs (which stub the WebClient and
// exercise each piece alone), these tests construct a real `WebClient` via
// the real `attachResponseHandlers` bridge and prove the store identity
// threads end to end: provider -> nested provider -> consumer hooks ->
// WebClient response bridge -> back into the same store.

const TEST_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'integration',
  clientver: 'integration-1.0',
  clientfeatures: [],
};

const TEST_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: false,
  keepalive: 0,
};

afterEach(() => {
  cleanup();
  // WebClient is a singleton; drop the instance constructed by the provider
  // so each test starts from a clean slate.
  WebClient.dispose();
});

describe('React provider stack (integration)', () => {
  it('constructs a real WebClient from the provider store and exposes it via useWebClient', () => {
    let client: WebClient | undefined;
    function Probe() {
      client = useWebClient();
      return null;
    }

    render(
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    expect(client).toBeInstanceOf(WebClient);
    // The bridge wired all five response handlers into the client.
    expect(client!.response.session).toBeDefined();
    expect(client!.response.room).toBeDefined();
    expect(client!.response.game).toBeDefined();
    expect(client!.response.admin).toBeDefined();
    expect(client!.response.moderator).toBeDefined();
  });

  it('routes events through the real WebClient response bridge into the shared provider store', () => {
    let client: WebClient | undefined;
    function Probe() {
      client = useWebClient();
      const status = useAppSelector((s) => s.server.status);
      return <span data-testid="status">{status?.description ?? ''}</span>;
    }

    const { getByTestId } = render(
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    expect(getByTestId('status').textContent).toBe('');

    // Drive the real WebClient's response bridge — it must dispatch into the
    // same store DatatriceProvider built and the hooks read from.
    act(() => {
      client!.response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'bridged-in');
    });

    expect(getByTestId('status').textContent).toBe('bridged-in');
  });

  it('threads useAppDispatch and useAppSelector through the nested provider stack', () => {
    function Probe() {
      const dispatch = useAppDispatch();
      const status = useAppSelector((s) => s.server.status);
      return (
        <>
          <button
            onClick={() =>
              dispatch(
                server.Actions.updateStatus({
                  status: { state: WebsocketTypes.StatusEnum.CONNECTED, description: 'dispatched' },
                }),
              )
            }
          >
            go
          </button>
          <span data-testid="status">{status?.description ?? ''}</span>
        </>
      );
    }

    const { getByText, getByTestId } = render(
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    expect(getByTestId('status').textContent).toBe('');
    fireEvent.click(getByText('go'));
    expect(getByTestId('status').textContent).toBe('dispatched');
  });

  it('createTypedHooks operates on an extensions-augmented store across the provider stack', () => {
    const probe = createSlice({
      name: 'probe',
      initialState: { hits: 0 },
      reducers: {
        bump: (state) => {
          state.hits += 1;
        },
      },
    });
    type ExtState = RootState & { probe: { hits: number } };
    const { useAppSelector: useExtSelector, useAppDispatch: useExtDispatch } = createTypedHooks<ExtState>();

    function Probe() {
      const hits = useExtSelector((s) => s.probe.hits);
      const serverDefined = useExtSelector((s) => s.server !== undefined);
      const dispatch = useExtDispatch();
      return (
        <>
          <button onClick={() => dispatch(probe.actions.bump())}>bump</button>
          <span data-testid="hits">{hits}</span>
          <span data-testid="server">{String(serverDefined)}</span>
        </>
      );
    }

    const { getByText, getByTestId } = render(
      <DatatriceProvider extensions={{ probe: probe.reducer as Reducer }}>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    expect(getByTestId('hits').textContent).toBe('0');
    // Datatrice's own slices coexist with the host extension.
    expect(getByTestId('server').textContent).toBe('true');

    fireEvent.click(getByText('bump'));
    expect(getByTestId('hits').textContent).toBe('1');
    fireEvent.click(getByText('bump'));
    expect(getByTestId('hits').textContent).toBe('2');
  });

  it('external-store mode threads the supplied store through to the WebClient bridge', () => {
    const externalStore = createStore({ reducer: rootReducer });
    let seenStore: ReturnType<typeof useStore> | undefined;
    let client: WebClient | undefined;
    function Probe() {
      seenStore = useStore();
      client = useWebClient();
      const status = useAppSelector((s) => s.server.status);
      return <span data-testid="status">{status?.description ?? ''}</span>;
    }

    const { getByTestId } = render(
      <DatatriceProvider store={externalStore}>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    // The externally-supplied store is the one both providers operate on.
    expect(seenStore).toBe(externalStore);
    expect(client).toBeInstanceOf(WebClient);

    // ...and the real WebClient's response bridge is bound to that same store.
    act(() => {
      client!.response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'external-bridged');
    });

    expect(externalStore.getState().server.status.description).toBe('external-bridged');
    expect(getByTestId('status').textContent).toBe('external-bridged');
  });
});
