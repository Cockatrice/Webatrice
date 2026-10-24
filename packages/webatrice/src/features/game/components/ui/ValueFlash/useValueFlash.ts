import { useState } from 'react';

import { useJustRewound } from '../ReplayRewindContext';

export interface ValueFlash {
  key: number;
  direction: 'gain' | 'loss';
}

export interface ValueFlashOptions {
  only?: 'loss';
}

export function useValueFlash(
  value: number | undefined,
  enabled: boolean,
  { only }: ValueFlashOptions = {},
): ValueFlash | null {
  const [previous, setPrevious] = useState(value);
  const [flash, setFlash] = useState<ValueFlash | null>(null);
  const justRewound = useJustRewound();
  if (value !== previous) {
    setPrevious(value);
    const direction = value !== undefined && previous !== undefined ? (value > previous ? 'gain' : 'loss') : null;
    if (enabled && !justRewound && direction && (only === undefined || direction === only)) {
      setFlash({ key: (flash?.key ?? 0) + 1, direction });
    } else if (!enabled || justRewound || !direction) {
      setFlash(null);
    }
  }
  return flash;
}
