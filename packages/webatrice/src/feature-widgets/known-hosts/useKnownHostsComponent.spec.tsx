import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { createStore, server } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

vi.mock('./useKnownHosts');
vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, opts?: { mode?: string }) => (opts?.mode ? `${k}:${opts.mode}` : k),
    }),
  };
});

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
  const { result, rerender } = renderHook(() => useKnownHostsComponent({ onChange }), {
    wrapper: Wrapper,
  });
  return { result, rerender, webClient, store, onChange };
}

describe('useKnownHostsComponent', () => {
  it('retries when the user deliberately re-picks a host after a failed probe', async () => {
    const host = makeHost({ id: 4 });
    const { result, store, webClient, rerender } = setup({ knownHostsOverrides: {
      value: { hosts: [host], selectedHost: host },
    } });
    act(() => {
      store.dispatch(server.Actions.testConnectionFailed());
    });
    await act(async () => result.current.onPick(4));
    rerender();
    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(2);
  });

  it('probes a picked host only once when the selection effect also runs', async () => {
    const first = makeHost({ id: 1 });
    const second = makeHost({ id: 2, host: 'second.example' });
    const select = vi.fn().mockResolvedValue(undefined);
    const { result, rerender, webClient } = setup({ knownHostsOverrides: {
      value: { hosts: [first, second], selectedHost: first }, select,
    } });
    await act(async () => result.current.onPick(2));
    vi.mocked(useKnownHosts).mockReturnValue(makeKnownHostsHook({ value: { hosts: [first, second], selectedHost: second }, select }));
    rerender();
    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(2);
  });

  it('does not probe again when the selected host is refreshed with new metadata', () => {
    const host = makeHost({ id: 4 });
    const { rerender, webClient } = setup({ knownHostsOverrides: { value: { hosts: [host], selectedHost: host } } });
    const refreshed = makeHost({ ...host, supportsHashedPassword: true });
    vi.mocked(useKnownHosts).mockReturnValue(makeKnownHostsHook({ value: { hosts: [refreshed], selectedHost: refreshed } }));
    rerender();
    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(1);
    const changed = makeHost({ ...refreshed, port: '1234' });
    vi.mocked(useKnownHosts).mockReturnValue(makeKnownHostsHook({ value: { hosts: [changed], selectedHost: changed } }));
    rerender();
    expect(webClient.request.authentication.testConnection).toHaveBeenCalledTimes(2);
  });

  it('selects the host created in the add dialog', async () => {
    const select = vi.fn().mockResolvedValue(undefined);
    const add = vi.fn().mockResolvedValue(makeHost({ id: 42 }));
    const { result } = setup({ knownHostsOverrides: { add, select } });
    await act(async () => result.current.handleDialogSubmit({ name: 'New', host: 'new.example', port: '443' }));
    expect(select).toHaveBeenCalledWith(42);
  });

  it.each([undefined, 5])('persists the submitted desktop port when saving host %s', async (id) => {
    const add = vi.fn().mockResolvedValue(makeHost());
    const update = vi.fn().mockResolvedValue(makeHost());
    const { result } = setup({ knownHostsOverrides: { add, update } });
    await act(async () => {
      await result.current.handleDialogSubmit({ id, name: 'TCP', host: 'server.example', port: '443', desktopPort: '4747' });
    });
    if (id) {
      expect(update).toHaveBeenCalledWith(id, expect.objectContaining({ desktopPort: '4747' }));
    } else {
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ desktopPort: '4747' }));
    }
  });

  it('clears the saved desktop port when the field is emptied', async () => {
    const update = vi.fn().mockResolvedValue(makeHost());
    const { result } = setup({ knownHostsOverrides: { update } });
    await act(async () => {
      await result.current.handleDialogSubmit({ id: 5, name: 'TCP', host: 'server.example', port: '443', desktopPort: '' });
    });
    expect(update).toHaveBeenCalledWith(5, expect.objectContaining({ desktopPort: undefined }));
  });

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
    const add = vi.fn().mockResolvedValue(makeHost({ id: 99 }));
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
