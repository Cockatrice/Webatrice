import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { createStore, server } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

vi.mock('./useKnownHosts');
vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>();
  // Surface the interpolation `mode` so fire-time content is assertable
  // (the real ICU string isn't formatted in the test env).
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, opts?: { mode?: string }) => (opts?.mode ? `${k}:${opts.mode}` : k),
    }),
  };
});

// Capture the toast handle so we can assert what content `fireToast` opens with.
const { openToast } = vi.hoisted(() => ({ openToast: vi.fn() }));
vi.mock('@app/components', async (orig) => {
  const actual = await orig<typeof import('@app/components')>();
  return {
    ...actual,
    useToast: () => ({ openToast, closeToast: vi.fn(), removeToast: vi.fn() }),
  };
});

import { rootReducerMap, type RootState } from '../../store';
import { connectedState, createMockWebClient } from '../../__test-utils__';
import { ToastProvider } from '../../components/Toast/ToastContext';
import { makeHost, makeKnownHostsHook } from './__mocks__/useKnownHosts';
import { LoadingState } from '@app/hooks';

import { useKnownHosts } from './useKnownHosts';
import { useKnownHostsComponent } from './useKnownHostsComponent';

const reducer = combineReducers(rootReducerMap);

function setup(args: {
  onChange?: (host: any) => void;
  knownHostsOverrides?: Partial<ReturnType<typeof makeKnownHostsHook>>;
  serverOverrides?: Partial<RootState['server']>;
} = {}) {
  const onChange = vi.fn(args.onChange);
  vi.mocked(useKnownHosts).mockReturnValue(
    makeKnownHostsHook(args.knownHostsOverrides),
  );
  const webClient = createMockWebClient();
  const preloadedState = args.serverOverrides
    ? { ...connectedState, server: { ...(connectedState.server as any), ...args.serverOverrides } }
    : connectedState;
  const store = createStore<RootState>({
    reducer: reducer as never,
    preloadedState: preloadedState as never,
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <ToastProvider>{children}</ToastProvider>
        </WebClientContext>
      </Provider>
    );
  }
  const { result } = renderHook(() => useKnownHostsComponent({ onChange }), {
    wrapper: Wrapper,
  });
  return { result, webClient, store, onChange };
}

describe('useKnownHostsComponent', () => {
  beforeEach(() => {
    openToast.mockClear();
  });

  it('exposes hosts and selectedHost from useKnownHosts and fires testConnection on mount', () => {
    const host = makeHost();
    const { result, webClient, onChange } = setup({
      knownHostsOverrides: { value: { hosts: [host], selectedHost: host } as any },
    });

    expect(result.current.hosts).toEqual([host]);
    expect(result.current.selectedHost).toBe(host);
    expect(onChange).toHaveBeenCalledWith(host);
    expect(webClient.request.authentication.testConnection).toHaveBeenCalled();
  });

  // Regression: a disconnect must not re-probe. Each probe is a full WebSocket
  // that counts against Servatrice's per-IP connection cap (max_users_per_address,
  // default 4), so re-probing on every disconnect trips "too many connections".
  it('does not re-fire testConnection when the connection drops (disconnected)', () => {
    const host = makeHost();
    const { webClient, store } = setup({
      knownHostsOverrides: { value: { hosts: [host], selectedHost: host } as any },
    });

    const testConnection = vi.mocked(webClient.request.authentication.testConnection);
    const beforeDisconnect = testConnection.mock.calls.length;

    act(() => {
      store.dispatch(server.Actions.disconnected());
    });

    // A disconnect adds no new probe.
    expect(testConnection).toHaveBeenCalledTimes(beforeDisconnect);
  });

  it('re-probes exactly once on a fresh mount even when a prior probe already succeeded', () => {
    const host = makeHost();
    const { webClient } = setup({
      knownHostsOverrides: { value: { hosts: [host], selectedHost: host } as any },
      serverOverrides: { testConnectionStatus: 'success' },
    });

    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(1);
  });

  it('returns empty hosts when useKnownHosts is still loading', () => {
    const { result } = setup({
      knownHostsOverrides: { status: LoadingState.LOADING, value: undefined },
    });

    expect(result.current.hosts).toEqual([]);
    expect(result.current.selectedHost).toBeUndefined();
  });

  it('onPick selects the host, notifies onChange, and re-tests the connection', async () => {
    const a = makeHost({ id: 1, name: 'A' });
    const b = makeHost({ id: 2, name: 'B' });
    const select = vi.fn().mockResolvedValue(undefined);
    const { result, webClient, onChange } = setup({
      knownHostsOverrides: {
        value: { hosts: [a, b], selectedHost: a } as any,
        select,
      },
    });

    onChange.mockClear();
    vi.mocked(webClient.request.authentication.testConnection).mockClear();

    await act(async () => {
      await result.current.onPick(2);
    });

    expect(onChange).toHaveBeenCalledWith(b);
    expect(select).toHaveBeenCalledWith(2);
    expect(webClient.request.authentication.testConnection).toHaveBeenCalled();
  });

  it('refreshConnection re-tests the currently selected host', () => {
    const host = makeHost();
    const { result, webClient } = setup({
      knownHostsOverrides: { value: { hosts: [host], selectedHost: host } as any },
    });

    vi.mocked(webClient.request.authentication.testConnection).mockClear();

    act(() => {
      result.current.refreshConnection();
    });

    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(1);
  });

  it('refreshConnection is a no-op when no host is selected', () => {
    const { result, webClient } = setup({
      knownHostsOverrides: { value: { hosts: [], selectedHost: undefined } as any },
    });

    vi.mocked(webClient.request.authentication.testConnection).mockClear();

    act(() => {
      result.current.refreshConnection();
    });

    expect(webClient.request.authentication.testConnection).not.toHaveBeenCalled();
  });

  it('openAddKnownHostDialog and closeKnownHostDialog toggle dialog state', () => {
    const { result } = setup();

    act(() => {
      result.current.openAddKnownHostDialog();
    });
    expect(result.current.dialogState.open).toBe(true);
    expect(result.current.dialogState.edit).toBeNull();

    act(() => {
      result.current.closeKnownHostDialog();
    });
    expect(result.current.dialogState.open).toBe(false);
  });

  it('openEditKnownHostDialog seeds dialogState.edit with the row to edit', () => {
    const host = makeHost({ id: 5, name: 'Edit Me' });
    const { result } = setup();

    act(() => {
      result.current.openEditKnownHostDialog(host);
    });

    expect(result.current.dialogState.open).toBe(true);
    expect(result.current.dialogState.edit).toBe(host);
  });

  it('handleDialogSubmit creates a new host when no id is supplied', async () => {
    const add = vi.fn().mockResolvedValue(makeHost({ id: 99 }));
    const { result } = setup({ knownHostsOverrides: { add } });

    await act(async () => {
      await result.current.handleDialogSubmit({
        name: 'New',
        host: 'new.example',
        port: '4747',
      });
    });

    expect(add).toHaveBeenCalledWith({
      name: 'New',
      host: 'new.example',
      port: '4747',
      editable: true,
    });
    expect(result.current.dialogState.open).toBe(false);
  });

  it('handleDialogRemove is a no-op for hosts without an id', async () => {
    const remove = vi.fn();
    const { result } = setup({ knownHostsOverrides: { remove } });

    await act(async () => {
      await result.current.handleDialogRemove(makeHost({ id: undefined }));
    });

    expect(remove).not.toHaveBeenCalled();
  });

  it('fires the toast with the current mode computed at fire time (created / edited / deleted)', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const { result } = setup({ knownHostsOverrides: { add, update, remove } });

    await act(async () => {
      await result.current.handleDialogSubmit({ name: 'New', host: 'new.example', port: '4747' });
    });
    expect(openToast).toHaveBeenLastCalledWith('KnownHosts.toast:created');

    await act(async () => {
      await result.current.handleDialogSubmit({ id: 5, name: 'Edit', host: 'edit.example', port: '4747' });
    });
    expect(openToast).toHaveBeenLastCalledWith('KnownHosts.toast:edited');

    await act(async () => {
      await result.current.handleDialogRemove(makeHost({ id: 7 }));
    });
    expect(openToast).toHaveBeenLastCalledWith('KnownHosts.toast:deleted');
  });
});
