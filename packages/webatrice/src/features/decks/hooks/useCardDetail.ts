import { useEffect, useRef, useState } from 'react';

import { detailTargetKey, fetchScryfallDetail, type DetailTarget, type ScryfallDetail } from '@app/services';

import type { BrowsedCard } from '../cardDetail';
import type { DeckCard } from '../types';

export interface CardDetailState {
  detail: ScryfallDetail | null;
  detailLoading: boolean;
  browsed: BrowsedCard | null;
  pending: DetailTarget | null;
  browse: (next: BrowsedCard) => void;
  back: () => void;
}

export function useCardDetail(snapshot: DeckCard | null): CardDetailState {
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [browsed, setBrowsed] = useState<BrowsedCard | null>(null);
  const [pending, setPending] = useState<DetailTarget | null>(null);
  const pendingRef = useRef<DetailTarget | null>(null);
  pendingRef.current = pending;

  const snapshotKey = snapshot ? `${snapshot.name}::${snapshot.category}` : null;
  useEffect(() => {
    setBrowsed(null);
  }, [snapshotKey]);

  const target: DetailTarget | null = browsed ?? (snapshot
    ? { name: snapshot.name, scryfallId: snapshot.scryfallId }
    : null);
  const targetKey = target ? detailTargetKey(target) : null;

  useEffect(() => {
    if (!target) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setDetailLoading(true);
    const controller = new AbortController();
    fetchScryfallDetail(target.scryfallId, target.name, controller.signal)
      .then((data) => {
        setDetail(data);
        setDetailLoading(false);
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') {
          return;
        }
        setDetailLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the card identity (`targetKey`) changes
  }, [targetKey]);

  const browse = (next: BrowsedCard) => {
    setPending({ name: next.name, scryfallId: next.scryfallId });
    void (async () => {
      const fetched = await fetchScryfallDetail(next.scryfallId, next.name);
      const stillCurrent = pendingRef.current?.name === next.name
        && pendingRef.current?.scryfallId === next.scryfallId;
      if (!stillCurrent) {
        return;
      }
      setDetail(fetched);
      setBrowsed(next);
      setPending(null);
    })();
  };

  return {
    detail,
    detailLoading,
    browsed,
    pending,
    browse,
    back: () => setBrowsed(null),
  };
}
