import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { createStore } from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';

vi.mock('./useKnownHosts');
vi.mock('react-i18next', async (orig) => {
  const actual = await orig<typeof import('react-i18next')>();
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) };
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
} = {}) {
  const onChange = vi.fn(args.onChange);
  vi.mocked(useKnownHosts).mockReturnValue(
    makeKnownHostsHook(args.knownHostsOverrides),
  );
  const webClient = createMockWebClient();
  const store = createStore<RootState>({
    reducer: reducer as never,
    preloadedState: connectedState as never,
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
});
