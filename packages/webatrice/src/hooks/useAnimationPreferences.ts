import { useLayoutEffect, useSyncExternalStore } from 'react';

import type { Preferences } from '@app/types';
import { usePreference } from './useSettings';

export const ANIMATION_PREFERENCE_KEYS = [
  'tapAnimation',
  'arrowDrawAnimation',
  'lifeCounterAnimations',
  'battlefieldFlash',
] as const;
export type AnimationPreferenceKey = (typeof ANIMATION_PREFERENCE_KEYS)[number];

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function reducedMotionQuery(): MediaQueryList | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : undefined;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

export function systemPrefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, systemPrefersReducedMotion, () => false);
}

export function resolveAnimation(
  preferences: Pick<Preferences, AnimationPreferenceKey | 'animationsChosen'>,
  key: AnimationPreferenceKey,
  reducedMotion: boolean,
): boolean {
  return animationApplies(preferences[key], preferences.animationsChosen, reducedMotion);
}

function animationApplies(value: boolean, animationsChosen: boolean, reducedMotion: boolean): boolean {
  return animationsChosen ? value : value && !reducedMotion;
}

export function useAnimationPreference(key: AnimationPreferenceKey): boolean {
  const animationsChosen = usePreference('animationsChosen');
  const value = usePreference(key);
  const reducedMotion = usePrefersReducedMotion();
  return animationApplies(value, animationsChosen, reducedMotion);
}

export function boardAnimationsAllowed(
  preferences: Pick<Preferences, AnimationPreferenceKey | 'animationsChosen'>,
  reducedMotion: boolean,
): boolean {
  return ANIMATION_PREFERENCE_KEYS.some((key) => resolveAnimation(preferences, key, reducedMotion));
}

export function useBoardAnimations(): boolean {
  const preferences = {
    animationsChosen: usePreference('animationsChosen'),
    tapAnimation: usePreference('tapAnimation'),
    arrowDrawAnimation: usePreference('arrowDrawAnimation'),
    lifeCounterAnimations: usePreference('lifeCounterAnimations'),
    battlefieldFlash: usePreference('battlefieldFlash'),
  };
  return boardAnimationsAllowed(preferences, usePrefersReducedMotion());
}

export function useApplyAnimationPolicy(): void {
  const allowed = useBoardAnimations();
  useLayoutEffect(() => {
    document.documentElement.dataset.animations = allowed ? 'on' : 'off';
  }, [allowed]);
}

export function chooseAnimations(
  preferences: Pick<Preferences, AnimationPreferenceKey | 'animationsChosen'>,
  reducedMotion: boolean,
  changes: Partial<Record<AnimationPreferenceKey, boolean>>,
): Partial<Preferences> {
  const patch: Partial<Preferences> = { animationsChosen: true };
  for (const key of ANIMATION_PREFERENCE_KEYS) {
    patch[key] = changes[key] ?? resolveAnimation(preferences, key, reducedMotion);
  }
  return patch;
}
