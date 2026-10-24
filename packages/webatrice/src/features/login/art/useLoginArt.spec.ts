import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';

import { LoadingState } from '@app/hooks';
import { makeSettings, makeSettingsHook } from '../../../hooks/__mocks__/useSettings';

vi.mock('../../../hooks/useSettings');

import { useSettings } from '../../../hooks/useSettings';
import { LOGIN_ART_CARDS, LOGIN_ART_STORAGE_KEY, readLoginArt } from './loginArt';
import { forgetLoginArt, useLoginArt } from './useLoginArt';

beforeEach(() => {
  forgetLoginArt();
  window.localStorage.clear();
  vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
});

afterEach(() => vi.unstubAllGlobals());

interface FrameControl {
  pending: () => number;
  runAfterFirstPaint: () => void;
}

function controlAnimationFrames(): FrameControl {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  const runNext = (time: number) => {
    const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (entry) {
      frames.delete(entry[0]);
      entry[1](time);
    }
  };
  return {
    pending: () => frames.size,
    runAfterFirstPaint: () => act(() => {
      runNext(0);
      runNext(16);
    }),
  };
}

describe('useLoginArt', () => {
  test('starts on a curated card with its art crop URL', () => {
    const { result } = renderHook(() => useLoginArt(() => 0));
    expect(result.current.name).toBe(LOGIN_ART_CARDS[0]);
    expect(result.current.url).toContain('version=art_crop');
    expect(result.current.failed).toBe(false);
  });

  test('falls back after an image error and recovers on shuffle', () => {
    const { result } = renderHook(() => useLoginArt(() => 0));
    act(() => result.current.onError());
    expect(result.current.failed).toBe(true);

    act(() => result.current.shuffle());
    expect(result.current.failed).toBe(false);
    expect(result.current.name).not.toBe(LOGIN_ART_CARDS[0]);
  });

  test('keeps the same art when the login page remounts during the visit', () => {
    const first = renderHook(() => useLoginArt(() => 0.5));
    act(() => first.result.current.shuffle());
    const shown = first.result.current.name;
    first.unmount();

    const second = renderHook(() => useLoginArt(() => 0));
    expect(second.result.current.name).toBe(shown);
  });

  test('preloads and persists a different card after first paint for the next visit', () => {
    const frames = controlAnimationFrames();
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_url: string) {
        this.onload?.();
      }
    });
    const first = renderHook(() => useLoginArt(() => 0));
    const shown = first.result.current.name;

    expect(readLoginArt()?.attribution).toBe(shown);
    frames.runAfterFirstPaint();
    const next = readLoginArt();
    expect(next?.attribution).not.toBe(shown);
    expect(next).toEqual({
      attribution: LOGIN_ART_CARDS[1],
      url: expect.stringContaining('version=art_crop'),
    });

    first.unmount();
    forgetLoginArt();
    const nextVisit = renderHook(() => useLoginArt(() => 0.75));
    expect(nextVisit.result.current.name).toBe(LOGIN_ART_CARDS[1]);
    expect(nextVisit.result.current.url).toBe(next?.url);
  });

  test('keeps the shown art for the next visit when background preloading fails', () => {
    const frames = controlAnimationFrames();
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      src = '';
    });
    const first = renderHook(() => useLoginArt(() => 0));
    frames.runAfterFirstPaint();
    first.unmount();
    forgetLoginArt();

    const nextVisit = renderHook(() => useLoginArt(() => 0.75));
    expect(nextVisit.result.current.name).toBe(LOGIN_ART_CARDS[0]);
  });

  test('still schedules the next art after StrictMode replays the effect', () => {
    const frames = controlAnimationFrames();
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_url: string) {
        this.onload?.();
      }
    });

    renderHook(() => useLoginArt(() => 0), { wrapper: StrictMode });
    expect(frames.pending()).toBe(1);
    frames.runAfterFirstPaint();
    expect(readLoginArt()?.attribution).toBe(LOGIN_ART_CARDS[1]);
  });

  test('does not promote a late preload after the art preference is disabled', () => {
    const frames = controlAnimationFrames();
    let completePreload = () => {};
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      set src(_url: string) {
        completePreload = () => this.onload?.();
      }
    });
    const hook = renderHook(() => useLoginArt(() => 0));
    const shown = readLoginArt();
    frames.runAfterFirstPaint();

    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ value: makeSettings({ signInCardArt: false }) }));
    hook.rerender();
    act(() => completePreload());

    expect(readLoginArt()).toEqual(shown);
  });

  test('requests no art while the preference is off', () => {
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame');
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ value: makeSettings({ signInCardArt: false }) }));
    const { result } = renderHook(() => useLoginArt(() => 0));
    expect(result.current.enabled).toBe(false);
    expect(result.current.url).toBeNull();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LOGIN_ART_STORAGE_KEY)).toBeNull();
  });

  test('requests no art until the preferences have loaded', () => {
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ status: LoadingState.LOADING, value: undefined }));
    const { result } = renderHook(() => useLoginArt(() => 0));
    expect(result.current.url).toBeNull();
  });

  test('drops the URL after an image error', () => {
    const { result } = renderHook(() => useLoginArt(() => 0));
    act(() => result.current.onError());
    expect(result.current.url).toBeNull();
    expect(readLoginArt()).toBeUndefined();
  });
});
