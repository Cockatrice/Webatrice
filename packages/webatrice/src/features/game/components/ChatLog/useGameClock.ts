import { useEffect, useState } from 'react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useGameReadOnly } from '../ui/GameReadOnlyContext';

export function useGameClock(gameId: number | undefined): number {
  const readOnly = useGameReadOnly();
  const secondsElapsed = useAppSelector((state) =>
    gameId != null ? games.Selectors.getSecondsElapsed(state, gameId) : 0,
  );
  const [displaySeconds, setDisplaySeconds] = useState(secondsElapsed ?? 0);

  useEffect(() => {
    setDisplaySeconds(secondsElapsed ?? 0);
  }, [secondsElapsed]);

  useEffect(() => {
    if (gameId == null || readOnly) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameId, readOnly]);

  return displaySeconds;
}
