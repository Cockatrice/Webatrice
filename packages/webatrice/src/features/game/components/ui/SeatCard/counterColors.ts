import { CARD_COUNTER_COLOR_KEYS, PREFERENCE_DEFAULTS } from '@app/types';

// See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
export const COUNTER_TYPE_COUNT = 6;
export const COUNTER_TYPE_LABELS: ReadonlyArray<string> = ['A', 'B', 'C', 'D', 'E', 'F'];

export const DEFAULT_COUNTER_COLORS: ReadonlyArray<string> = CARD_COUNTER_COLOR_KEYS.map((key) => PREFERENCE_DEFAULTS[key]);

export function counterColorForId(id: number): string {
  const slot = ((id % COUNTER_TYPE_COUNT) + COUNTER_TYPE_COUNT) % COUNTER_TYPE_COUNT;
  return `var(--card-counter-${slot}, #${DEFAULT_COUNTER_COLORS[slot]})`;
}
