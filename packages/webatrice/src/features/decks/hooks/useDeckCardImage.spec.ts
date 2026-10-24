import { act, renderHook } from '@testing-library/react';

import { useDeckCardImage } from './useDeckCardImage';

describe('useDeckCardImage', () => {
  it('shows a placeholder until the current URL loads, including when returning to an earlier URL', () => {
    const { result, rerender } = renderHook(({ urls }) => useDeckCardImage(urls), { initialProps: { urls: ['a'] } });
    expect(result.current.loaded).toBe(false);
    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);
    rerender({ urls: ['b'] });
    expect(result.current.loaded).toBe(false);
    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);
    rerender({ urls: ['a'] });
    expect(result.current.loaded).toBe(false);
  });

  it('keeps the placeholder through fallback attempts and after exhausting candidates', () => {
    const { result } = renderHook(() => useDeckCardImage(['a', 'b']));
    act(() => result.current.onLoad());
    act(() => result.current.onError());
    expect(result.current).toMatchObject({ src: 'b', loaded: false });
    act(() => result.current.onError());
    expect(result.current).toMatchObject({ src: null, loaded: false });
  });

  it('recognizes a complete cached image but not a broken complete image', () => {
    const { result } = renderHook(() => useDeckCardImage(['a']));
    const image = document.createElement('img');
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 0, configurable: true } });
    act(() => result.current.ref(image));
    expect(result.current.loaded).toBe(false);
    Object.defineProperty(image, 'naturalWidth', { value: 488 });
    act(() => result.current.ref(image));
    expect(result.current.loaded).toBe(true);
  });
});
