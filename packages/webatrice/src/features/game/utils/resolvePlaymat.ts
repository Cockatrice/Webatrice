import type { games } from '@cockatrice/datatrice';

import { PlaymatFallbackBehavior, PlaymatMode, type PlaymatSettings } from '@app/hooks';

export function samePlaymat(a: games.Playmat | null, b: games.Playmat | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.cardName === b.cardName
    && a.cardProviderId === b.cardProviderId
    && a.params.marginPctL === b.params.marginPctL
    && a.params.marginPctR === b.params.marginPctR
    && a.params.verticalOffset === b.params.verticalOffset
    && a.params.zoom === b.params.zoom;
}

function pickFromCollection(
  settings: PlaymatSettings,
  rotationIndex: number,
  lastResolved: games.Playmat | null,
  random: () => number,
): games.Playmat | null {
  const list = settings.fallbackList;
  if (list.length === 0) {
    return null;
  }
  switch (settings.fallbackBehavior) {
    case PlaymatFallbackBehavior.ROUND_ROBIN:
      return list[rotationIndex % list.length];
    case PlaymatFallbackBehavior.RANDOM: {
      const candidates = list.length > 1 ? list.filter((entry) => !samePlaymat(entry, lastResolved)) : list;
      const pool = candidates.length > 0 ? candidates : list;
      return pool[Math.floor(random() * pool.length)];
    }
    default:
      return list[0];
  }
}

export function resolvePlaymat(
  deckPlaymat: games.Playmat | null,
  settings: PlaymatSettings,
  rotationIndex: number,
  lastResolved: games.Playmat | null = null,
  random: () => number = Math.random,
): games.Playmat | null {
  switch (settings.mode) {
    case PlaymatMode.OVERRIDE_DECK:
      return pickFromCollection(settings, rotationIndex, lastResolved, random);
    case PlaymatMode.DECK_ONLY:
      return deckPlaymat;
    default:
      return deckPlaymat ?? pickFromCollection(settings, rotationIndex, lastResolved, random);
  }
}

type CollectionSettings = Pick<PlaymatSettings, 'mode' | 'fallbackBehavior' | 'fallbackList'>;

export function sameCollectionSettings(a: CollectionSettings | undefined, b: CollectionSettings): boolean {
  return a !== undefined
    && a.mode === b.mode
    && a.fallbackBehavior === b.fallbackBehavior
    && a.fallbackList.length === b.fallbackList.length
    && a.fallbackList.every((entry, i) => samePlaymat(entry, b.fallbackList[i]));
}
