import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { ReplayRewindProvider } from '../ReplayRewindContext';
import { useValueFlash } from './useValueFlash';

describe('useValueFlash', () => {
  it('does not flash for the value it starts with', () => {
    const { result } = renderHook(() => useValueFlash(20, true));
    expect(result.current).toBeNull();
  });

  it('flashes a gain or a loss for each change, with a fresh key every time', () => {
    const { result, rerender } = renderHook(({ value }) => useValueFlash(value, true), { initialProps: { value: 20 } });
    rerender({ value: 17 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });
    rerender({ value: 17 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });
    rerender({ value: 15 });
    expect(result.current).toEqual({ key: 2, direction: 'loss' });
    rerender({ value: 19 });
    expect(result.current).toEqual({ key: 3, direction: 'gain' });
  });

  it('does not flash while disabled, nor when the value first appears', () => {
    const disabled = renderHook(({ value }) => useValueFlash(value, false), { initialProps: { value: 20 } });
    disabled.rerender({ value: 10 });
    expect(disabled.result.current).toBeNull();

    const appearing = renderHook(({ value }) => useValueFlash(value, true), {
      initialProps: { value: undefined as number | undefined },
    });
    appearing.rerender({ value: 40 });
    expect(appearing.result.current).toBeNull();
  });

  it('in loss-only mode, neither flashes a gain nor cuts off a running flash with one', () => {
    const { result, rerender } = renderHook(({ value }) => useValueFlash(value, true, { only: 'loss' }), {
      initialProps: { value: 20 },
    });
    rerender({ value: 17 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });
    rerender({ value: 19 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });
    rerender({ value: 18 });
    expect(result.current).toEqual({ key: 2, direction: 'loss' });
  });

  it('skips the change a replay rewind made, and flashes the ones after it', () => {
    let rewinds = 0;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ReplayRewindProvider, { value: () => rewinds }, children);
    const { result, rerender } = renderHook(({ value }) => useValueFlash(value, true), {
      initialProps: { value: 20 },
      wrapper,
    });
    rerender({ value: 17 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });

    rewinds++;
    rerender({ value: 12 });
    expect(result.current).toBeNull();

    rerender({ value: 10 });
    expect(result.current).toEqual({ key: 1, direction: 'loss' });
  });
});
