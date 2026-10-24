import { useEffect, useMemo } from 'react';



import type { BracketAssessment } from '@app/types';



import { deckFingerprint } from '../bracket';

import type { DeckCard } from '../types';



export function useBracketCache(

  cards: readonly DeckCard[],

  assessment: BracketAssessment | undefined,

  persist: (assessment: BracketAssessment | undefined) => void,

  enabled: boolean,

): number | undefined {

  const fingerprint = useMemo(() => deckFingerprint([...cards]), [cards]);

  const stale = assessment != null && assessment.fingerprint !== fingerprint;

  useEffect(() => {

    if (stale) {

      persist(undefined);

    }

  }, [stale, persist]);

  return enabled && assessment && !stale ? assessment.level : undefined;

}

