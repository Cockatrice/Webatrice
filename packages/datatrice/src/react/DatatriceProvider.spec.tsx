import { render } from '@testing-library/react';
import { useStore, useDispatch, useSelector } from 'react-redux';
import { createSlice } from '@reduxjs/toolkit';
import type { Reducer } from '@reduxjs/toolkit';

import { DatatriceProvider } from './DatatriceProvider';
import { createStore } from '../store/createStore';
import { rootReducer, type RootState } from '../store/rootReducer';

// Inline probe that pulls a value out of the active store via react-redux —
// gives us an assertion target without exposing the store from the Provider.
function StoreProbe({ onStore }: { onStore: (store: ReturnType<typeof useStore>) => void }) {
  const store = useStore();
  onStore(store);
  return null;
}

describe('DatatriceProvider', () => {
  it('creates a store with the default rootReducer when no extensions are passed', () => {
    let captured: ReturnType<typeof useStore> | undefined;
    render(
      <DatatriceProvider>
        <StoreProbe onStore={(s) => {
          captured = s;
        }} />
      </DatatriceProvider>,
    );

    const state = captured!.getState() as RootState;
    expect(state.server).toBeDefined();
    expect(state.rooms).toBeDefined();
    expect(state.games).toBeDefined();
  });

  it('applies preloadedState to the default reducer shape', () => {
    let captured: ReturnType<typeof useStore> | undefined;
    render(
      <DatatriceProvider preloadedState={{ server: { sortUsersBy: { field: 'name', order: 'ASC' } } } as Partial<RootState>}>
        <StoreProbe onStore={(s) => {
          captured = s;
        }} />
      </DatatriceProvider>,
    );

    const state = captured!.getState() as RootState;
    expect(state.server.sortUsersBy).toMatchObject({ field: 'name', order: 'ASC' });
  });

  it('merges host extensions into the rootReducer at mount time', () => {
    const probeSlice = createSlice({
      name: 'probe',
      initialState: { hits: 0 },
      reducers: {
        bump: (state) => {
          state.hits += 1;
        },
      },
    });
    type ExtState = { probe: ReturnType<typeof probeSlice.reducer> };

    let captured: ReturnType<typeof useStore> | undefined;
    render(
      <DatatriceProvider extensions={{ probe: probeSlice.reducer as Reducer }}>
        <StoreProbe onStore={(s) => {
          captured = s;
        }} />
      </DatatriceProvider>,
    );

    expect((captured!.getState() as ExtState).probe.hits).toBe(0);
    captured!.dispatch(probeSlice.actions.bump());
    expect((captured!.getState() as ExtState).probe.hits).toBe(1);
  });

  it('keeps Datatrice slices alive alongside extensions', () => {
    const probeSlice = createSlice({
      name: 'probe',
      initialState: { hits: 0 },
      reducers: { bump: (state) => {
        state.hits += 1;
      } },
    });

    let captured: ReturnType<typeof useStore> | undefined;
    render(
      <DatatriceProvider extensions={{ probe: probeSlice.reducer as Reducer }}>
        <StoreProbe onStore={(s) => {
          captured = s;
        }} />
      </DatatriceProvider>,
    );

    const state = captured!.getState() as RootState & { probe: { hits: number } };
    expect(state.server).toBeDefined();
    expect(state.rooms).toBeDefined();
    expect(state.games).toBeDefined();
    expect(state.probe).toEqual({ hits: 0 });
  });

  describe('external-store mode', () => {
    it('uses the supplied store instead of constructing one', () => {
      const externalStore = createStore({ reducer: rootReducer });
      let captured: ReturnType<typeof useStore> | undefined;
      render(
        <DatatriceProvider store={externalStore}>
          <StoreProbe onStore={(s) => {
            captured = s;
          }} />
        </DatatriceProvider>,
      );

      expect(captured).toBe(externalStore);
    });

    it('preserves dispatches against the external store', () => {
      // The merged reducer below feeds state-with-`probe` back through `rootReducer`,
      // which triggers a benign Redux warning about the unknown key. Silence it so
      // intentional test setup doesn't pollute stderr.
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const probeSlice = createSlice({
        name: 'probe',
        initialState: { hits: 0 },
        reducers: { bump: (state) => {
          state.hits += 1;
        } },
      });
      const externalStore = createStore({
        reducer: ((state, action) => ({
          ...rootReducer(state, action),
          probe: probeSlice.reducer(state?.probe, action),
        })) as unknown as Reducer<RootState & { probe: { hits: number } }>,
      });

      let captured: ReturnType<typeof useStore> | undefined;
      render(
        <DatatriceProvider store={externalStore}>
          <StoreProbe onStore={(s) => {
            captured = s;
          }} />
        </DatatriceProvider>,
      );

      captured!.dispatch(probeSlice.actions.bump());
      const state = externalStore.getState() as RootState & { probe: { hits: number } };
      expect(state.probe.hits).toBe(1);
    });
  });

  it('exposes useDispatch + useSelector to children', () => {
    let dispatchedActions: { type: string }[] = [];

    function Inner() {
      const dispatch = useDispatch();
      const status = useSelector((state: RootState) => state.server.status);
      dispatchedActions.push({ type: 'rendered' });
      // Verify dispatch is callable without crashing.
      dispatch({ type: '@@TEST/NOOP' });
      return <span data-testid="status">{status?.description ?? ''}</span>;
    }

    const { getByTestId } = render(
      <DatatriceProvider>
        <Inner />
      </DatatriceProvider>,
    );

    expect(getByTestId('status')).toBeDefined();
    expect(dispatchedActions.length).toBeGreaterThan(0);
  });

  describe('edge cases', () => {
    it('nested DatatriceProviders → inner provider shadows the outer store', () => {
      const outer = createStore({ reducer: rootReducer });
      const inner = createStore({ reducer: rootReducer });

      let captured: ReturnType<typeof useStore> | undefined;
      render(
        <DatatriceProvider store={outer}>
          <DatatriceProvider store={inner}>
            <StoreProbe onStore={(s) => {
              captured = s;
            }} />
          </DatatriceProvider>
        </DatatriceProvider>,
      );

      expect(captured).toBe(inner);
      expect(captured).not.toBe(outer);
    });

    it('switching the `store` prop after mount → children see the new store', () => {
      const a = createStore({ reducer: rootReducer });
      const b = createStore({ reducer: rootReducer });

      const captured: Array<ReturnType<typeof useStore>> = [];
      const probe = <StoreProbe onStore={(s) => captured.push(s)} />;

      const { rerender } = render(
        <DatatriceProvider store={a}>{probe}</DatatriceProvider>,
      );
      expect(captured.at(-1)).toBe(a);

      rerender(
        <DatatriceProvider store={b}>{probe}</DatatriceProvider>,
      );
      expect(captured.at(-1)).toBe(b);
    });

    it('extensions prop is memoized at mount → later changes to extensions are ignored', () => {
      const first = createSlice({
        name: 'probe',
        initialState: { value: 'first' },
        reducers: {},
      });
      const second = createSlice({
        name: 'probe',
        initialState: { value: 'second' },
        reducers: {},
      });

      let captured: ReturnType<typeof useStore> | undefined;
      const probe = <StoreProbe onStore={(s) => {
        captured = s;
      }} />;
      const { rerender } = render(
        <DatatriceProvider extensions={{ probe: first.reducer as Reducer }}>{probe}</DatatriceProvider>,
      );
      expect((captured!.getState() as RootState & { probe: { value: string } }).probe.value).toBe('first');

      rerender(
        <DatatriceProvider extensions={{ probe: second.reducer as Reducer }}>{probe}</DatatriceProvider>,
      );
      // Internal store is `useState`-memoized; re-rendering with new extensions
      // does not rebuild it. Consumers who want to swap reducers must remount.
      expect((captured!.getState() as RootState & { probe: { value: string } }).probe.value).toBe('first');
    });

    it('renders children when no props at all are passed', () => {
      const { getByText } = render(
        <DatatriceProvider>
          <span>just children</span>
        </DatatriceProvider>,
      );
      expect(getByText('just children')).toBeDefined();
    });
  });
});
