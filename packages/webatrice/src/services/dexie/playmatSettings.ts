import { games } from '@cockatrice/datatrice';
import {
  DEFAULT_PLAYMAT_SETTINGS, PlaymatVisibility, PlaymatMode, PlaymatFallbackBehavior, PLAYMAT_NAME_MAX_LENGTH, type PlaymatSettings,
} from '@app/types';

export const LEGACY_PLAYMAT_SETTINGS_KEY = 'webatrice.playmatSettings';

const oneOf = <T extends number>(values: Record<string, T>, value: unknown, fallback: T): T =>
  (Object.values(values) as unknown[]).includes(value) ? (value as T) : fallback;

function parsePlaymat(value: unknown): games.Playmat | null {
  const entry = value as Partial<games.Playmat> | null;
  if (!entry || typeof entry.cardName !== 'string' || !entry.cardName.trim() || entry.cardName.length > PLAYMAT_NAME_MAX_LENGTH) {
    return null;
  }
  return {
    cardName: entry.cardName.trim(),
    cardProviderId: typeof entry.cardProviderId === 'string' ? entry.cardProviderId.slice(0, PLAYMAT_NAME_MAX_LENGTH) : '',
    params: games.clampPlaymatParams({ ...games.DEFAULT_PLAYMAT_PARAMS, ...entry.params }),
  };
}

export function parsePlaymatSettings(raw: string | null): PlaymatSettings {
  let stored: Partial<PlaymatSettings> = {};
  try {
    stored = raw ? JSON.parse(raw) ?? {} : {};
  } catch {
    stored = {};
  }
  return {
    visibility: oneOf(PlaymatVisibility, stored.visibility, DEFAULT_PLAYMAT_SETTINGS.visibility),
    mode: oneOf(PlaymatMode, stored.mode, DEFAULT_PLAYMAT_SETTINGS.mode),
    fallbackBehavior: oneOf(PlaymatFallbackBehavior, stored.fallbackBehavior, DEFAULT_PLAYMAT_SETTINGS.fallbackBehavior),
    fallbackList: Array.isArray(stored.fallbackList)
      ? stored.fallbackList.map(parsePlaymat).filter((entry): entry is games.Playmat => entry !== null)
      : [],
  };
}

