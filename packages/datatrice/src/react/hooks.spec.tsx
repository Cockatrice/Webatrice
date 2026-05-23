import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { DatatriceProvider } from './DatatriceProvider';
import { useAppDispatch, useAppSelector, createTypedHooks } from './hooks';
import type { RootState } from '../store/rootReducer';

const wrapper = ({ children }: { children: ReactNode }) => (
  <DatatriceProvider>{children}</DatatriceProvider>
);

describe('default typed hooks bound to base RootState', () => {
  it('useAppSelector reads the base store shape', () => {
    const { result } = renderHook(() => useAppSelector((state) => state.server), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('useAppDispatch returns a callable dispatch', () => {
    const { result } = renderHook(() => useAppDispatch(), { wrapper });
    expect(typeof result.current).toBe('function');
    expect(() => result.current({ type: '@@TEST/NOOP' })).not.toThrow();
  });
});

describe('createTypedHooks<S>()', () => {
  it('returns hooks that read selectors against the host state shape', () => {
    type HostState = RootState & { custom: { value: number } };
    const { useAppSelector: useHostSelector } = createTypedHooks<HostState>();

    const { result } = renderHook(() => useHostSelector((state) => state.server), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('returns a dispatch that delegates to react-redux', () => {
    type HostState = RootState & { custom: { value: number } };
    const { useAppDispatch: useHostDispatch } = createTypedHooks<HostState>();

    const { result } = renderHook(() => useHostDispatch(), { wrapper });
    expect(typeof result.current).toBe('function');
    expect(() => result.current({ type: '@@TEST/NOOP' })).not.toThrow();
  });

  it('returns fresh hook references on each invocation', () => {
    const a = createTypedHooks<RootState>();
    const b = createTypedHooks<RootState>();
    // Each call returns a fresh object; the inner references come from
    // react-redux's `.withTypes()` which returns a new typed wrapper.
    expect(a).not.toBe(b);
    expect(a.useAppSelector).toBeDefined();
    expect(a.useAppDispatch).toBeDefined();
  });
});
