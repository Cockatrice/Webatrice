import { act, renderHook } from '@testing-library/react';

import { PREFERENCE_DEFAULTS } from '@app/types';
import {
  boardAnimationsAllowed,
  chooseAnimations,
  resolveAnimation,
  useAnimationPreference,
  useApplyAnimationPolicy,
  usePrefersReducedMotion,
} from './useAnimationPreferences';
import { getSettings, settingsStore } from './useSettings';

function mockReducedMotion(reduce: boolean) {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const listeners = new Set<() => void>();
  let matches = reduce;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return query === '(prefers-reduced-motion: reduce)' && matches;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return {
    set: (next: boolean) => {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    restore: () => {
      if (original) {
        Object.defineProperty(window, 'matchMedia', original);
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
      }
    },
  };
}

const unchosen = { ...PREFERENCE_DEFAULTS, animationsChosen: false };

describe('resolveAnimation', () => {
  it('follows desktop\'s defaults, all on, without reduced motion', () => {
    expect(resolveAnimation(unchosen, 'arrowDrawAnimation', false)).toBe(true);
  });

  it('turns every animation off for reduced motion until the user has chosen', () => {
    expect(resolveAnimation(unchosen, 'tapAnimation', true)).toBe(false);
    expect(resolveAnimation({ ...unchosen, animationsChosen: true }, 'tapAnimation', true)).toBe(true);
    expect(resolveAnimation({ ...unchosen, animationsChosen: true, tapAnimation: false }, 'tapAnimation', false)).toBe(false);
  });
});

describe('boardAnimationsAllowed', () => {
  const allOff = { tapAnimation: false, arrowDrawAnimation: false, lifeCounterAnimations: false, battlefieldFlash: false };

  it('lets the board move while any of the four animations applies', () => {
    expect(boardAnimationsAllowed(unchosen, false)).toBe(true);
    expect(boardAnimationsAllowed({ ...unchosen, ...allOff, animationsChosen: true, arrowDrawAnimation: true }, true)).toBe(true);
  });

  it('stops it after "Disable all"', () => {
    expect(boardAnimationsAllowed({ ...unchosen, ...allOff, animationsChosen: true }, false)).toBe(false);
  });

  it('stops it under reduced motion until the user has chosen', () => {
    expect(boardAnimationsAllowed(unchosen, true)).toBe(false);
  });
});

describe('chooseAnimations', () => {
  it('records every animation as it shows, the change on top, and marks the choice made', () => {
    expect(chooseAnimations(unchosen, true, { battlefieldFlash: true })).toEqual({
      animationsChosen: true,
      tapAnimation: false,
      arrowDrawAnimation: false,
      lifeCounterAnimations: false,
      battlefieldFlash: true,
    });
  });
});

describe('useAnimationPreference', () => {
  let media: ReturnType<typeof mockReducedMotion>;

  afterEach(() => {
    media.restore();
    settingsStore.reset();
  });

  it('follows the system\'s reduced-motion setting live while nothing is chosen', async () => {
    media = mockReducedMotion(false);
    await getSettings();
    const { result } = renderHook(() => ({
      tap: useAnimationPreference('tapAnimation'),
      reduced: usePrefersReducedMotion(),
    }));
    expect(result.current).toEqual({ tap: true, reduced: false });

    act(() => media.set(true));
    expect(result.current).toEqual({ tap: false, reduced: true });
  });

  it('keeps the user\'s choice whatever the system says', async () => {
    media = mockReducedMotion(true);
    const settings = await getSettings();
    settingsStore.setValue(Object.assign(settings, { animationsChosen: true, tapAnimation: true }));
    const { result } = renderHook(() => useAnimationPreference('tapAnimation'));
    expect(result.current).toBe(true);
  });
});

describe('useApplyAnimationPolicy', () => {
  let media: ReturnType<typeof mockReducedMotion>;

  afterEach(() => {
    media.restore();
    settingsStore.reset();
    delete document.documentElement.dataset.animations;
  });

  it('publishes the board policy on the document root, following the system and the choice live', async () => {
    media = mockReducedMotion(false);
    const settings = await getSettings();
    renderHook(() => useApplyAnimationPolicy());
    expect(document.documentElement.dataset.animations).toBe('on');

    act(() => media.set(true));
    expect(document.documentElement.dataset.animations).toBe('off');

    act(() => settingsStore.setValue(Object.assign(settings, chooseAnimations(settings, true, { tapAnimation: true }))));
    expect(document.documentElement.dataset.animations).toBe('on');

    act(() => settingsStore.setValue(Object.assign(settings, {
      animationsChosen: true,
      tapAnimation: false,
      arrowDrawAnimation: false,
      lifeCounterAnimations: false,
      battlefieldFlash: false,
    })));
    expect(document.documentElement.dataset.animations).toBe('off');
  });
});
