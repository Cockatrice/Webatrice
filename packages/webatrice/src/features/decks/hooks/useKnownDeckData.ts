import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useRecentDecks } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { deckSummaryRevision, deckSummaryScope, readDeckSummary, type CachedDeckSummary } from '../deckSummaryCache';
import { flattenFolder } from '../deckTree';
import type { HydratedDeck } from '../types';

export function useKnownDeckData(deckId: number | null) {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const scope = useAppSelector((state) => deckSummaryScope(state, webClient));
  const root = useAppSelector(server.Selectors.getBackendDecks)?.root;
  const tree = useMemo(() => (scope && root ? flattenFolder(root, '').find((deck) => deck.id === deckId) : undefined),
    [scope, root, deckId]);
  const recent = useRecentDecks().find((deck) => deck.deckId === deckId);
  const creationTime = tree?.creationTime;
  const [cached, setCached] = useState<CachedDeckSummary>();
  useEffect(() => {
    if (!scope || deckId == null || creationTime == null) {
      return;
    }
    let active = true;
    const revision = deckSummaryRevision(scope, deckId);
    void readDeckSummary(scope, deckId, creationTime).then((row) => {
      if (active && revision === deckSummaryRevision(scope, deckId)) {
        setCached(row);
      }
    });
    return () => {
      active = false;
    };
  }, [scope, deckId, creationTime]);
  const summary = cached?.scope === scope && cached?.deckId === deckId && cached?.creationTime === creationTime
    ? cached.summary : undefined;
  return useMemo(() => {
    const deck: HydratedDeck = {
      name: tree?.name ?? recent?.name ?? t('SharedDeck.untitled'),
      format: summary?.format ?? recent?.format ?? '',
      bannerCard: tree?.bannerCardName ?? summary?.bannerCard ?? recent?.bannerCard,
      bannerCardProviderId: tree?.bannerCardName ? tree.bannerCardProvider
        : summary?.bannerCard ? summary.bannerCardProviderId : recent?.bannerCardProviderId,
      cards: [],
      meta: { v: 1, updatedAt: '', bracketLevel: summary?.bracketLevel ?? recent?.bracketLevel },
    };
    return {
      deck,
      colors: tree?.colorIdentity ?? recent?.colors,
      cardCount: summary?.cardCount ?? recent?.cardCount,
      tags: tree?.tags ?? summary?.tags ?? [],
    };
  }, [tree, recent, summary, t]);
}
