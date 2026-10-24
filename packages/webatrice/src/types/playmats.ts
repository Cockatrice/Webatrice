import type { games } from '@cockatrice/datatrice';

export const PlaymatVisibility = {
  NONE: 0,
  OWN_ONLY: 1,
  ALL: 2,
} as const;
export type PlaymatVisibility = typeof PlaymatVisibility[keyof typeof PlaymatVisibility];

export const PlaymatMode = {
  OVERRIDE_DECK: 0,
  FALLBACK: 1,
  DECK_ONLY: 2,
} as const;
export type PlaymatMode = typeof PlaymatMode[keyof typeof PlaymatMode];

export const PlaymatFallbackBehavior = {
  FIXED: 0,
  ROUND_ROBIN: 1,
  RANDOM: 2,
} as const;
export type PlaymatFallbackBehavior = typeof PlaymatFallbackBehavior[keyof typeof PlaymatFallbackBehavior];

export interface PlaymatSettings {
  visibility: PlaymatVisibility;
  mode: PlaymatMode;
  fallbackBehavior: PlaymatFallbackBehavior;
  fallbackList: readonly games.Playmat[];
}

export const DEFAULT_PLAYMAT_SETTINGS: PlaymatSettings = Object.freeze({
  visibility: PlaymatVisibility.ALL,
  mode: PlaymatMode.FALLBACK,
  fallbackBehavior: PlaymatFallbackBehavior.FIXED,
  fallbackList: Object.freeze([]),
});

export const PLAYMAT_NAME_MAX_LENGTH = 255;
