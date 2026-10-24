import { act, renderHook } from '@testing-library/react';

import { VIEW_MODE_STORAGE_KEY, readStoredViewMode, useDeckListViewMode } from './useDeckListViewMode';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useDeckListViewMode', () => {
  it('defaults to the card layout and persists a change', () => {
    const { result } = renderHook(() => useDeckListViewMode());
    expect(result.current[0]).toBe('card');

    act(() => result.current[1]('compact'));

    expect(result.current[0]).toBe('compact');
    expect(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('compact');
  });

  it('restores a stored choice and ignores invalid values', () => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'compact');
    expect(readStoredViewMode()).toBe('compact');
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'grid');
    expect(readStoredViewMode()).toBe('card');
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useDeckListViewMode());
    expect(result.current[0]).toBe('card');
    act(() => result.current[1]('compact'));
    expect(result.current[0]).toBe('compact');
  });
});
