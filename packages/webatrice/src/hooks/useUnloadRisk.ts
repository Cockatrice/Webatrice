import { useEffect, useRef } from 'react';

import { setUnloadRisk } from '../services/unloadGuard';

export function useUnloadRisk(active: boolean): void {
  const key = useRef<object>({});

  useEffect(() => {
    const risk = key.current;
    setUnloadRisk(risk, active);
    return () => setUnloadRisk(risk, false);
  }, [active]);
}
