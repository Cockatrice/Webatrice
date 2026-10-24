import { useEffect, useMemo, useState } from 'react';

import type { BracketAssessment } from '@app/types';

import {
  analyzeBracket,
  deckFingerprint,
  fromBracketAssessment,
  isCompleteAnalysis,
  toBracketAssessment,
  type BracketReport,
  type UnavailableSource,
} from '../bracket';
import type { DeckCard } from '../types';

export type BracketAssessmentState =
  | { status: 'consentRequired' }
  | { status: 'loading' }
  | { status: 'complete'; report: BracketReport }
  | { status: 'degraded'; report: BracketReport; unavailable: UnavailableSource[] }
  | { status: 'error'; message: string };

export function useBracketAssessment(
  cards: DeckCard[],
  cachedAssessment: BracketAssessment | undefined,
  persist: ((assessment: BracketAssessment | undefined) => void) | undefined,
  lookupsAllowed: boolean,
): BracketAssessmentState & { retry: () => void } {
  const fingerprint = useMemo(() => deckFingerprint(cards), [cards]);
  const [state, setState] = useState<BracketAssessmentState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (cachedAssessment && cachedAssessment.fingerprint === fingerprint) {
      setState({ status: 'complete', report: fromBracketAssessment(cachedAssessment) });
      return () => {
        cancelled = true;
      };
    }

    if (!lookupsAllowed) {
      setState({ status: 'consentRequired' });
      if (cachedAssessment) {
        persist?.(undefined);
      }
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading' });
    analyzeBracket(cards)
      .then((analysis) => {
        if (cancelled) {
          return;
        }
        if (isCompleteAnalysis(analysis)) {
          setState({ status: 'complete', report: analysis.report });
          persist?.(toBracketAssessment(analysis.report, fingerprint));
        } else {
          setState({ status: 'degraded', report: analysis.report, unavailable: analysis.unavailable });
          persist?.(undefined);
        }
      })
      .catch((e) => {
        if (cancelled) {
          return;
        }
        setState({ status: 'error', message: e instanceof Error ? e.message : '' });
        persist?.(undefined);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the deck `fingerprint`, consent and explicit retries
  }, [fingerprint, attempt, lookupsAllowed]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
