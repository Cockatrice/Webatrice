import { useCallback, useEffect, useState } from 'react';

import { LoadingState, useSettings } from '@app/hooks';

import { clearLoginArt, createLoginArt, readLoginArt, writeLoginArt, type LoginArtChoice } from './loginArt';

export interface LoginArt {
  enabled: boolean;
  name: string;
  url: string | null;
  failed: boolean;
  onError: () => void;
  shuffle: () => void;
}

let visitArt: LoginArtChoice | undefined;
let visitPreloadScheduled = false;

export function forgetLoginArt(): void {
  visitArt = undefined;
  visitPreloadScheduled = false;
}

export function useLoginArt(random: () => number = Math.random): LoginArt {
  const settings = useSettings();
  const enabled = settings.status === LoadingState.READY && settings.value?.signInCardArt !== false;
  const [art, setArt] = useState(() => {
    visitArt ??= readLoginArt();
    if (!visitArt && enabled) {
      visitArt = createLoginArt(random);
      writeLoginArt(visitArt);
    }
    return { choice: visitArt, failed: false };
  });

  const onError = useCallback(() => setArt((a) => {
    if (a.choice) {
      clearLoginArt(a.choice);
    }
    return { ...a, failed: true };
  }), []);
  const shuffle = useCallback(() => {
    setArt((a) => {
      const choice = createLoginArt(random, a.choice?.attribution);
      visitArt = choice;
      writeLoginArt(choice);
      return { choice, failed: false };
    });
  }, [random]);

  useEffect(() => {
    if (!enabled || art.choice) {
      return;
    }
    const choice = createLoginArt(random);
    visitArt = choice;
    writeLoginArt(choice);
    setArt({ choice, failed: false });
  }, [art.choice, enabled, random]);

  useEffect(() => {
    if (!enabled || !art.choice || visitPreloadScheduled) {
      return;
    }
    visitPreloadScheduled = true;
    const shown = art.choice;
    let secondFrame = 0;
    let preloadStarted = false;
    let active = true;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        preloadStarted = true;
        const next = createLoginArt(random, shown.attribution);
        const image = new Image();
        image.onload = () => {
          const stored = readLoginArt();
          if (active && (!stored || stored.url === shown.url)) {
            writeLoginArt(next);
          }
        };
        image.src = next.url;
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (!preloadStarted) {
        visitPreloadScheduled = false;
      }
    };
  }, [art.choice, enabled, random]);

  return {
    enabled,
    name: art.choice?.attribution ?? '',
    url: enabled && !art.failed ? art.choice?.url ?? null : null,
    failed: art.failed,
    onError,
    shuffle,
  };
}
